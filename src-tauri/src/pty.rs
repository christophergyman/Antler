//! PTY (Pseudo-Terminal) module for spawning interactive terminal processes
//!
//! This module provides a minimal Rust bridge for PTY operations.
//! All business logic remains in TypeScript - this only exposes native PTY capabilities.

use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::thread;
use tauri::{AppHandle, Emitter, State};

/// State for managing active PTY sessions
pub struct PtyState {
    sessions: Mutex<HashMap<u32, PtySession>>,
    next_id: AtomicU32,
}

struct PtySession {
    #[allow(dead_code)]
    pair: PtyPair,
    #[allow(dead_code)]
    child: Box<dyn portable_pty::Child + Send + Sync>,
    writer: Mutex<Box<dyn Write + Send>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: AtomicU32::new(1),
        }
    }
}

/// Event payload for PTY data output
#[derive(Clone, Serialize)]
struct PtyDataEvent {
    id: u32,
    data: String,
}

/// Event payload for PTY exit
#[derive(Clone, Serialize)]
struct PtyExitEvent {
    id: u32,
    code: Option<u32>,
}

/// Options for spawning a PTY
#[derive(Deserialize)]
pub struct SpawnOptions {
    cmd: String,
    args: Vec<String>,
    cwd: String,
    cols: u16,
    rows: u16,
    #[serde(default)]
    env: HashMap<String, String>,
}

/// Spawn a new PTY process
#[tauri::command]
pub async fn spawn_pty(
    app: AppHandle,
    state: State<'_, PtyState>,
    options: SpawnOptions,
) -> Result<u32, String> {
    let pty_system = native_pty_system();

    let size = PtySize {
        rows: options.rows,
        cols: options.cols,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&options.cmd);
    cmd.args(&options.args);
    cmd.cwd(&options.cwd);

    // Add environment variables
    for (key, value) in &options.env {
        cmd.env(key, value);
    }

    // Set TERM environment variable for proper terminal emulation
    cmd.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let id = state.next_id.fetch_add(1, Ordering::SeqCst);

    // Clone reader for the output thread
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    // Take the writer ONCE and store it for reuse
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get writer: {}", e))?;

    // Store the session with the writer
    {
        let mut sessions = state.sessions.lock();
        sessions.insert(
            id,
            PtySession {
                pair,
                child,
                writer: Mutex::new(writer),
            },
        );
    }

    // Spawn a thread to read PTY output and emit events
    let app_clone = app.clone();
    let id_clone = id;
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // EOF - process exited
                    let _ = app_clone.emit("pty-exit", PtyExitEvent { id: id_clone, code: None });
                    break;
                }
                Ok(n) => {
                    // Convert to string (lossy for invalid UTF-8)
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit("pty-data", PtyDataEvent { id: id_clone, data });
                }
                Err(e) => {
                    eprintln!("PTY read error: {}", e);
                    let _ = app_clone.emit("pty-exit", PtyExitEvent { id: id_clone, code: None });
                    break;
                }
            }
        }
    });

    Ok(id)
}

/// Write data to a PTY
#[tauri::command]
pub async fn write_pty(
    state: State<'_, PtyState>,
    id: u32,
    data: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("PTY session {} not found", id))?;

    // Use the stored writer instead of taking a new one
    let mut writer = session.writer.lock();

    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {}", e))?;

    writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY: {}", e))?;

    Ok(())
}

/// Resize a PTY
#[tauri::command]
pub async fn resize_pty(
    state: State<'_, PtyState>,
    id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("PTY session {} not found", id))?;

    session
        .pair
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))?;

    Ok(())
}

/// Kill a PTY process
#[tauri::command]
pub async fn kill_pty(state: State<'_, PtyState>, id: u32) -> Result<(), String> {
    let mut sessions = state.sessions.lock();

    if let Some(mut session) = sessions.remove(&id) {
        // Try to kill the child process
        let _ = session.child.kill();
    }

    Ok(())
}

/// Get list of active PTY session IDs
#[tauri::command]
pub async fn list_pty_sessions(state: State<'_, PtyState>) -> Result<Vec<u32>, String> {
    let sessions = state.sessions.lock();
    Ok(sessions.keys().copied().collect())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pty_state_default() {
        let state = PtyState::default();

        // Initial state should have no sessions
        let sessions = state.sessions.lock();
        assert!(sessions.is_empty());

        // Next ID should start at 1
        assert_eq!(state.next_id.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn test_pty_state_id_generation() {
        let state = PtyState::default();

        // Each fetch_add should increment the ID
        let id1 = state.next_id.fetch_add(1, Ordering::SeqCst);
        let id2 = state.next_id.fetch_add(1, Ordering::SeqCst);
        let id3 = state.next_id.fetch_add(1, Ordering::SeqCst);

        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
        assert_eq!(id3, 3);
    }

    #[test]
    fn test_spawn_options_deserialization() {
        let json = r#"{
            "cmd": "/bin/bash",
            "args": ["-l"],
            "cwd": "/home/user",
            "cols": 80,
            "rows": 24,
            "env": {"CUSTOM_VAR": "value"}
        }"#;

        let options: SpawnOptions = serde_json::from_str(json).unwrap();

        assert_eq!(options.cmd, "/bin/bash");
        assert_eq!(options.args, vec!["-l"]);
        assert_eq!(options.cwd, "/home/user");
        assert_eq!(options.cols, 80);
        assert_eq!(options.rows, 24);
        assert_eq!(options.env.get("CUSTOM_VAR"), Some(&"value".to_string()));
    }

    #[test]
    fn test_spawn_options_with_default_env() {
        let json = r#"{
            "cmd": "/bin/sh",
            "args": [],
            "cwd": "/",
            "cols": 120,
            "rows": 40
        }"#;

        let options: SpawnOptions = serde_json::from_str(json).unwrap();

        assert_eq!(options.cmd, "/bin/sh");
        assert!(options.env.is_empty());
    }

    #[test]
    fn test_pty_data_event_serialization() {
        let event = PtyDataEvent {
            id: 42,
            data: "Hello, World!".to_string(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"id\":42"));
        assert!(json.contains("\"data\":\"Hello, World!\""));
    }

    #[test]
    fn test_pty_exit_event_serialization() {
        let event_with_code = PtyExitEvent {
            id: 1,
            code: Some(0),
        };

        let json = serde_json::to_string(&event_with_code).unwrap();
        assert!(json.contains("\"id\":1"));
        assert!(json.contains("\"code\":0"));

        let event_without_code = PtyExitEvent {
            id: 2,
            code: None,
        };

        let json = serde_json::to_string(&event_without_code).unwrap();
        assert!(json.contains("\"id\":2"));
        assert!(json.contains("\"code\":null"));
    }
}
