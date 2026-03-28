#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let _app_handle = app.handle();
            // Sidecar spawn and lifecycle wiring belongs here after the Python
            // engine is packaged into src-tauri's externalBin target.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

