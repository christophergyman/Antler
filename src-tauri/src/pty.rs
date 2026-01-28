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
