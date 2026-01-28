//! Antler - Minimal Tauri backend
//!
//! All business logic lives in TypeScript.
//! Rust only hosts plugins for shell commands and filesystem access.
//! PTY commands are the one exception - they provide native terminal capabilities.

mod pty;

use pty::PtyState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyState::default())
        .invoke_handler(tauri::generate_handler![
            pty::spawn_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::kill_pty,
            pty::list_pty_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
