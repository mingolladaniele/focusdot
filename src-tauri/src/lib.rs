pub mod autostart;
pub mod history;
pub mod notifications;
pub mod presets;
pub mod settings;
mod state;
pub mod stats;
pub mod storage;
pub mod timer;
mod tray;

use std::sync::Arc;
use std::thread;
use std::time::Duration;

use chrono::Utc;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};

use crate::history::{FocusSession, History};
use crate::notifications::{notify_break_complete, notify_focus_complete};
use crate::presets::{Preset, PresetInput};
use crate::state::AppState;
use crate::stats::Stats;
use crate::storage::save_json;
use crate::timer::{Phase, TimerSnapshot};
use crate::tray::{install_tray, refresh_tray_menu, set_tray_icon_phase, window_title_icon};

fn data_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .resolve("FocusDot", BaseDirectory::AppData)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_presets(state: tauri::State<'_, Arc<AppState>>) -> Result<Vec<Preset>, String> {
    let core = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(core.presets.all().to_vec())
}

#[tauri::command]
fn save_preset(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    input: PresetInput,
) -> Result<Preset, String> {
    let preset = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        let p = core.presets.upsert(input).map_err(|e| e.to_string())?;
        save_json(&core.presets_path, &core.presets).map_err(|e| e.to_string())?;
        p
    };
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    Ok(preset)
}

#[tauri::command]
fn delete_preset(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    id: uuid::Uuid,
) -> Result<(), String> {
    {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        core.presets.remove(id);
        save_json(&core.presets_path, &core.presets).map_err(|e| e.to_string())?;
    }
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_stats(state: tauri::State<'_, Arc<AppState>>) -> Result<Stats, String> {
    let core = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(crate::stats::calculate_stats(&core.history, Utc::now()))
}

#[tauri::command]
fn reset_history(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut core = state.inner.lock().map_err(|e| e.to_string())?;
    core.history = History::default();
    save_json(&core.history_path, &core.history).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_timer(state: tauri::State<'_, Arc<AppState>>) -> Result<TimerSnapshot, String> {
    let core = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(core.timer.snapshot())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppSettingsDto {
    auto_start_next_focus_after_break: bool,
}

#[tauri::command]
fn get_app_settings(state: tauri::State<'_, Arc<AppState>>) -> Result<AppSettingsDto, String> {
    let core = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(AppSettingsDto {
        auto_start_next_focus_after_break: core.settings.auto_start_next_focus_after_break,
    })
}

#[tauri::command]
fn set_auto_start_next_focus_after_break(
    state: tauri::State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    let mut core = state.inner.lock().map_err(|e| e.to_string())?;
    core.settings.auto_start_next_focus_after_break = enabled;
    save_json(&core.settings_path, &core.settings).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn start_preset(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    id: uuid::Uuid,
) -> Result<TimerSnapshot, String> {
    let snapshot = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        let preset = core
            .presets
            .all()
            .iter()
            .find(|p| p.id == id)
            .cloned()
            .ok_or_else(|| "preset not found".to_string())?;
        let auto_next = core.settings.auto_start_next_focus_after_break;
        let timer = core
            .timer
            .clone()
            .stop()
            .start_focus(
                preset.focus_minutes,
                preset.break_minutes,
                preset.cycles,
                auto_next,
            )
            .map_err(|e| e.to_string())?;
        core.timer = timer;
        core.focus_started_at = Some(Utc::now());
        core.timer.snapshot()
    };
    set_tray_icon_phase(&app, Phase::Focus).map_err(|e| e.to_string())?;
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    let _ = app.emit("timer-tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
fn pause_timer(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<TimerSnapshot, String> {
    let snapshot = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        let timer = core.timer.clone().pause().map_err(|e| e.to_string())?;
        core.timer = timer;
        core.timer.snapshot()
    };
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    let _ = app.emit("timer-tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
fn resume_timer(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<TimerSnapshot, String> {
    let snapshot = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        let timer = core.timer.clone().resume().map_err(|e| e.to_string())?;
        core.timer = timer;
        core.timer.snapshot()
    };
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    let _ = app.emit("timer-tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
fn stop_timer(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<TimerSnapshot, String> {
    let snapshot = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        core.timer = core.timer.clone().stop();
        core.focus_started_at = None;
        core.timer.snapshot()
    };
    set_tray_icon_phase(&app, Phase::Idle).map_err(|e| e.to_string())?;
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    let _ = app.emit("timer-tick", &snapshot);
    Ok(snapshot)
}

fn spawn_timer_loop(state: Arc<AppState>) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(1));
        let mut core = match state.inner.lock() {
            Ok(g) => g,
            Err(_) => continue,
        };
        let old_phase = core.timer.phase();
        let tick_result = core.timer.clone().tick(1);
        core.timer = tick_result.timer;
        let snapshot = core.timer.snapshot();

        if let Some(ev) = tick_result.event {
            if let Some(mins) = ev.completed_focus_minutes {
                let started = core.focus_started_at.unwrap_or_else(Utc::now);
                core.history.sessions.push(FocusSession {
                    started_at: started,
                    duration_minutes: mins,
                });
                let _ = save_json(&core.history_path, &core.history);
                core.focus_started_at = None;
                let bm = ev
                    .timer
                    .snapshot()
                    .remaining_seconds
                    .saturating_div(60)
                    .max(1);
                let stats = crate::stats::calculate_stats(&core.history, Utc::now());
                let app = state.app.clone();
                drop(core);
                let _ = notify_focus_complete(&app, &stats, bm);
                let _ = set_tray_icon_phase(&app, Phase::Break);
                let _ = refresh_tray_menu(&app, &state);
                let _ = app.emit("timer-tick", &snapshot);
                continue;
            }
        }

        if old_phase == Phase::Break && core.timer.phase() == Phase::Idle {
            let stats = crate::stats::calculate_stats(&core.history, Utc::now());
            let app = state.app.clone();
            drop(core);
            let _ = notify_break_complete(&app, &stats);
            let _ = set_tray_icon_phase(&app, Phase::Idle);
            let _ = refresh_tray_menu(&app, &state);
            let _ = app.emit("timer-tick", &snapshot);
            continue;
        }

        let new_phase = core.timer.phase();
        if old_phase == Phase::Break && new_phase == Phase::Focus {
            core.focus_started_at = Some(Utc::now());
        }
        drop(core);
        if new_phase != old_phase {
            let _ = set_tray_icon_phase(&state.app, new_phase);
            let _ = refresh_tray_menu(&state.app, &state);
        }
        let _ = state.app.emit("timer-tick", &snapshot);
    });
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let dir = data_dir(&handle).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            std::fs::create_dir_all(&dir).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            let history_path = dir.join("history.json");
            let presets_path = dir.join("presets.json");
            let settings_path = dir.join("settings.json");

            let state = Arc::new(AppState::new(
                handle.clone(),
                history_path,
                presets_path,
                settings_path,
            ));
            app.manage(state.clone());

            install_tray(app, state.clone()).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            spawn_timer_loop(state);

            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_icon(window_title_icon());
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_presets,
            save_preset,
            delete_preset,
            get_stats,
            reset_history,
            get_timer,
            get_app_settings,
            set_auto_start_next_focus_after_break,
            start_preset,
            pause_timer,
            resume_timer,
            stop_timer,
            autostart::is_autostart_enabled,
            autostart::set_autostart_enabled
        ])
        .build(tauri::generate_context!())
        .expect("failed to build focusdot");

    app.run(|handle, event| {
        if let tauri::RunEvent::WindowEvent { label, event: win_event, .. } = event {
            if label == "main" {
                match win_event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        if let Some(w) = handle.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    tauri::WindowEvent::Resized(_) => {
                        if let Some(w) = handle.get_webview_window("main") {
                            if w.is_minimized().unwrap_or(false) {
                                let _ = w.unminimize();
                                let _ = w.hide();
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    });
}
