use std::{
    fs::OpenOptions,
    io::Write,
    net::{SocketAddr, TcpStream},
    path::Path,
    process::Command,
    sync::{Arc, Mutex},
    time::Duration,
};

use serde::Serialize;
use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tauri_plugin_http::reqwest;
use thiserror::Error;

const ENGINE_PORT: u16 = 8000;
const DESKTOP_LOG_FILE: &str = "desktop-bootstrap.log";
const ENGINE_STARTUP_TIMEOUT: Duration = Duration::from_secs(45);

type SidecarState = Arc<Mutex<Option<CommandChild>>>;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppPaths {
    app_config_dir: String,
    cache_dir: String,
    log_dir: String,
    model_dir: String,
    resources_dir: Option<String>,
    documents_dir: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapPayload {
    app_version: String,
    engine_base_url: String,
    platform: String,
    updater_available: bool,
    paths: AppPaths,
}

#[derive(Debug, Error)]
enum AppError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

fn append_text_log(log_dir: &Path, scope: &str, message: &str) {
    let _ = std::fs::create_dir_all(log_dir);
    let log_path = log_dir.join(DESKTOP_LOG_FILE);
    let timestamp = chrono_like_timestamp();

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{timestamp}] [{scope}] {message}");
    }
}

fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default();

    timestamp.to_string()
}

fn is_port_reachable(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn engine_supports_capabilities(port: u16, log_dir: &Path) -> bool {
    let url = format!("http://127.0.0.1:{port}/capabilities");
    let result = tauri::async_runtime::block_on(async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(1))
            .build()
            .map_err(|error| error.to_string())?;
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|error| error.to_string())?;
        Ok::<bool, String>(response.status().is_success())
    });

    match result {
        Ok(true) => {
            append_text_log(log_dir, "native", "existing engine passed capability check");
            true
        }
        Ok(false) => {
            append_text_log(
                log_dir,
                "native",
                "existing engine is missing required capabilities",
            );
            false
        }
        Err(error) => {
            append_text_log(
                log_dir,
                "native",
                &format!("capability check failed for existing engine: {error}"),
            );
            false
        }
    }
}

#[cfg(target_os = "windows")]
fn stop_processes_on_port(port: u16, log_dir: &Path) -> Result<(), AppError> {
    let command = format!("netstat -ano | findstr LISTENING | findstr :{port}");
    let output = Command::new("cmd").args(["/C", &command]).output()?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    let pids: Vec<String> = stdout
        .lines()
        .filter_map(|line| line.split_whitespace().last().map(str::to_string))
        .collect();

    if pids.is_empty() {
        append_text_log(log_dir, "native", "no stale engine pid found on target port");
        return Ok(());
    }

    for pid in pids {
        append_text_log(
            log_dir,
            "native",
            &format!("stopping stale engine pid {pid} on port {port}"),
        );
        let _ = Command::new("taskkill")
            .args(["/PID", &pid, "/F"])
            .output();
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn stop_processes_on_port(port: u16, log_dir: &Path) -> Result<(), AppError> {
    let command = format!("lsof -ti tcp:{port}");
    let output = Command::new("sh").args(["-lc", &command]).output()?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    let pids: Vec<String> = stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();

    if pids.is_empty() {
        append_text_log(log_dir, "native", "no stale engine pid found on target port");
        return Ok(());
    }

    for pid in pids {
        append_text_log(
            log_dir,
            "native",
            &format!("stopping stale engine pid {pid} on port {port}"),
        );
        let _ = Command::new("kill").args(["-9", &pid]).output();
    }

    Ok(())
}

fn wait_for_port_to_close(port: u16, timeout: Duration, log_dir: &Path) -> bool {
    let deadline = std::time::Instant::now() + timeout;

    while std::time::Instant::now() < deadline {
        if !is_port_reachable(port) {
            append_text_log(log_dir, "native", &format!("port {port} is no longer reachable"));
            return true;
        }

        std::thread::sleep(Duration::from_millis(200));
    }

    append_text_log(
        log_dir,
        "native",
        &format!("timed out waiting for port {port} to close"),
    );
    false
}

fn wait_for_port(port: u16, timeout: Duration, log_dir: &Path) -> Result<(), AppError> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let deadline = std::time::Instant::now() + timeout;
    append_text_log(
        log_dir,
        "native",
        &format!("waiting for local engine port {port}"),
    );

    while std::time::Instant::now() < deadline {
        if TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok() {
            append_text_log(
                log_dir,
                "native",
                &format!("local engine port {port} is reachable"),
            );
            return Ok(());
        }

        std::thread::sleep(Duration::from_millis(200));
    }

    append_text_log(
        log_dir,
        "native",
        &format!("timed out waiting for local engine port {port}"),
    );
    Err(AppError::Message(format!(
        "Timed out waiting for the local engine on port {port}."
    )))
}

fn spawn_sidecar(app_handle: &tauri::AppHandle, state: &SidecarState) -> Result<(), AppError> {
    if state.lock().map_err(|_| AppError::Message("Failed to lock sidecar state.".into()))?.is_some()
    {
        return Ok(());
    }

    let app_config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(AppError::from)?;
    let cache_dir = app_handle.path().app_cache_dir().map_err(AppError::from)?;
    let log_dir = app_handle.path().app_log_dir().map_err(AppError::from)?;
    let model_dir = cache_dir.join("models");

    std::fs::create_dir_all(&app_config_dir)?;
    std::fs::create_dir_all(&cache_dir)?;
    std::fs::create_dir_all(&log_dir)?;
    std::fs::create_dir_all(&model_dir)?;

    if is_port_reachable(ENGINE_PORT) {
        if engine_supports_capabilities(ENGINE_PORT, &log_dir) {
            append_text_log(
                &log_dir,
                "native",
                &format!(
                    "engine port {} is already reachable; reusing compatible engine",
                    ENGINE_PORT
                ),
            );
            return Ok(());
        }

        append_text_log(
            &log_dir,
            "native",
            &format!(
                "engine port {} is in use by an incompatible engine; stopping stale process",
                ENGINE_PORT
            ),
        );
        stop_processes_on_port(ENGINE_PORT, &log_dir)?;

        if !wait_for_port_to_close(ENGINE_PORT, Duration::from_secs(5), &log_dir) {
            return Err(AppError::Message(
                "A stale background engine is still using port 8000. Close the old app process and try again."
                    .into(),
            ));
        }
    }

    append_text_log(
        &log_dir,
        "native",
        &format!(
            "spawn_sidecar begin; cache_dir={}, model_dir={}",
            cache_dir.display(),
            model_dir.display()
        ),
    );

    let mut command = app_handle
        .shell()
        .sidecar("engine")
        .map_err(|error| {
            append_text_log(
                &log_dir,
                "native",
                &format!("sidecar lookup failed: {error}"),
            );
            AppError::Message(error.to_string())
        })?;

    command = command
        .args(["--port", &ENGINE_PORT.to_string()])
        .env("NOISE_REDUCTION_APP_CONFIG_DIR", &app_config_dir)
        .env("NOISE_REDUCTION_CACHE_DIR", &cache_dir)
        .env("NOISE_REDUCTION_LOG_DIR", &log_dir)
        .env("NOISE_REDUCTION_MODEL_DIR", &model_dir);

    if let Some(resource_dir) = app_handle.path().resource_dir().ok() {
        command = command.env("NOISE_REDUCTION_RESOURCE_DIR", resource_dir);
    }
    append_text_log(&log_dir, "native", "sidecar command configured");

    let (mut receiver, child) = command
        .spawn()
        .map_err(|error| {
            append_text_log(
                &log_dir,
                "native",
                &format!("sidecar spawn failed: {error}"),
            );
            AppError::Message(error.to_string())
        })?;
    append_text_log(&log_dir, "native", "sidecar spawned");

    {
        let mut guard = state
            .lock()
            .map_err(|_| AppError::Message("Failed to store sidecar handle.".into()))?;
        *guard = Some(child);
    }

    let event_app = app_handle.clone();
    let event_log_dir = log_dir.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = receiver.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    append_text_log(
                        &event_log_dir,
                        "engine-stdout",
                        &String::from_utf8_lossy(&bytes),
                    );
                    let _ = event_app.emit(
                        "engine-stdout",
                        String::from_utf8_lossy(&bytes).to_string(),
                    );
                }
                CommandEvent::Stderr(bytes) => {
                    append_text_log(
                        &event_log_dir,
                        "engine-stderr",
                        &String::from_utf8_lossy(&bytes),
                    );
                    let _ = event_app.emit(
                        "engine-stderr",
                        String::from_utf8_lossy(&bytes).to_string(),
                    );
                }
                _ => {}
            }
        }
    });

    wait_for_port(ENGINE_PORT, ENGINE_STARTUP_TIMEOUT, &log_dir)?;
    Ok(())
}

#[tauri::command]
fn bootstrap_app(app_handle: tauri::AppHandle, state: tauri::State<'_, SidecarState>) -> Result<BootstrapPayload, AppError> {
    let log_dir = app_handle.path().app_log_dir().map_err(AppError::from)?;
    append_text_log(&log_dir, "native", "bootstrap_app called");
    spawn_sidecar(&app_handle, state.inner())?;

    let paths = AppPaths {
        app_config_dir: app_handle.path().app_config_dir()?.display().to_string(),
        cache_dir: app_handle.path().app_cache_dir()?.display().to_string(),
        log_dir: app_handle.path().app_log_dir()?.display().to_string(),
        model_dir: app_handle
            .path()
            .app_cache_dir()?
            .join("models")
            .display()
            .to_string(),
        resources_dir: app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|path| path.display().to_string()),
        documents_dir: app_handle
            .path()
            .document_dir()
            .ok()
            .map(|path| path.display().to_string()),
    };

    let payload = BootstrapPayload {
        app_version: app_handle.package_info().version.to_string(),
        engine_base_url: format!("http://127.0.0.1:{ENGINE_PORT}"),
        platform: std::env::consts::OS.to_string(),
        updater_available: false,
        paths,
    };
    append_text_log(
        &log_dir,
        "native",
        &format!("bootstrap_app returning engine url {}", payload.engine_base_url),
    );
    Ok(payload)
}

#[tauri::command]
fn log_client_event(
    app_handle: tauri::AppHandle,
    level: String,
    message: String,
) -> Result<(), AppError> {
    let log_dir = app_handle.path().app_log_dir().map_err(AppError::from)?;
    append_text_log(&log_dir, &format!("client-{level}"), &message);
    Ok(())
}

#[tauri::command]
async fn engine_request(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, SidecarState>,
    method: String,
    path: String,
    body: Option<String>,
) -> Result<String, AppError> {
    let log_dir = app_handle.path().app_log_dir().map_err(AppError::from)?;
    append_text_log(
        &log_dir,
        "native",
        &format!("engine_request {method} {path}"),
    );
    spawn_sidecar(&app_handle, state.inner())?;

    let url = format!("http://127.0.0.1:{ENGINE_PORT}{path}");
    let client = reqwest::Client::new();
    let request_builder = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        other => {
            return Err(AppError::Message(format!(
                "Unsupported engine request method: {other}"
            )))
        }
    };

    let request_builder = if let Some(payload) = body {
        request_builder
            .header("Content-Type", "application/json")
            .body(payload)
    } else {
        request_builder
    };

    let response = request_builder
        .send()
        .await
        .map_err(|error| AppError::Message(error.to_string()))?;
    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|error| AppError::Message(error.to_string()))?;

    append_text_log(
        &log_dir,
        "native",
        &format!("engine_request response {status} {path}"),
    );

    if !status.is_success() {
        return Err(AppError::Message(response_text));
    }

    Ok(response_text)
}

pub fn run() {
    let sidecar_state: SidecarState = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .manage(sidecar_state)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if let Ok(log_dir) = app.path().app_log_dir() {
                append_text_log(&log_dir, "native", "setup begin");
                if let Some(window) = app.get_webview_window("main") {
                    match window.clear_all_browsing_data() {
                        Ok(()) => append_text_log(
                            &log_dir,
                            "native",
                            "cleared webview browsing data",
                        ),
                        Err(error) => append_text_log(
                            &log_dir,
                            "native",
                            &format!("failed to clear webview browsing data: {error}"),
                        ),
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            engine_request,
            log_client_event
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<SidecarState>() {
                    if let Ok(mut guard) = state.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
