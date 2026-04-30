use std::sync::Arc;

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use tauri::menu::IsMenuItem;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use uuid::Uuid;

use crate::state::AppState;
use crate::timer::Phase;

fn rgba_icon(r: u8, g: u8, b: u8) -> Image<'static> {
    let mut buf = vec![0u8; 32 * 32 * 4];
    for px in buf.chunks_mut(4) {
        px[0] = r;
        px[1] = g;
        px[2] = b;
        px[3] = 255;
    }
    Image::new_owned(buf, 32, 32)
}

pub fn icon_for_phase(phase: Phase) -> Image<'static> {
    match phase {
        Phase::Focus => rgba_icon(80, 180, 80),
        Phase::Break => rgba_icon(80, 140, 220),
        Phase::Idle => rgba_icon(140, 140, 140),
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Build root tray menu (presets submenu + controls).
pub fn build_root_menu<R: Runtime>(
    handle: &AppHandle<R>,
    state: &Arc<AppState>,
) -> tauri::Result<Menu<R>> {
    let pause = MenuItem::with_id(handle, "pause", "Pause", true, None::<&str>)?;
    let resume = MenuItem::with_id(handle, "resume", "Resume", true, None::<&str>)?;
    let stop = MenuItem::with_id(handle, "stop", "Stop", true, None::<&str>)?;
    let stats = MenuItem::with_id(handle, "stats", "View statistics", true, None::<&str>)?;
    let settings = MenuItem::with_id(handle, "settings", "Settings / edit presets", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(handle)?;
    let exit = MenuItem::with_id(handle, "exit", "Exit", true, None::<&str>)?;

    let core = state.inner.lock().expect("state mutex poisoned");

    let preset_items: Vec<MenuItem<R>> = core
        .presets
        .all()
        .iter()
        .map(|p| {
            let id = format!("preset:{}", p.id);
            let text = format!("Start {} ({}m / {}m)", p.name, p.focus_minutes, p.break_minutes);
            MenuItem::with_id(handle, id, text, true, None::<&str>)
        })
        .collect::<tauri::Result<_>>()?;

    let preset_refs: Vec<&dyn IsMenuItem<R>> =
        preset_items.iter().map(|i| i as &dyn IsMenuItem<R>).collect();

    let submenu = Submenu::with_items(handle, "Presets", true, &preset_refs)?;

    Menu::with_items(
        handle,
        &[
            &submenu,
            &pause,
            &resume,
            &stop,
            &stats,
            &settings,
            &sep,
            &exit,
        ],
    )
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, state: &Arc<AppState>, event: &tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    match id {
        "stats" | "settings" => show_main_window(app),
        "exit" => app.exit(0),
        "pause" => {
            if let Ok(mut c) = state.inner.lock() {
                if let Ok(t) = c.timer.clone().pause() {
                    c.timer = t;
                }
            }
            let _ = app.emit("timer-changed", ());
        }
        "resume" => {
            if let Ok(mut c) = state.inner.lock() {
                if let Ok(t) = c.timer.clone().resume() {
                    c.timer = t;
                }
            }
            let _ = app.emit("timer-changed", ());
        }
        "stop" => {
            if let Ok(mut c) = state.inner.lock() {
                c.timer = c.timer.clone().stop();
                c.focus_started_at = None;
            }
            let _ = app.emit("timer-changed", ());
        }
        s if s.starts_with("preset:") => {
            let rest = s.trim_start_matches("preset:");
            if let Ok(uid) = Uuid::parse_str(rest) {
                if let Ok(mut c) = state.inner.lock() {
                    if let Some(preset) = c.presets.all().iter().find(|p| p.id == uid) {
                        let fm = preset.focus_minutes;
                        let bm = preset.break_minutes;
                        if let Ok(t) = c.timer.clone().stop().start_focus(fm, bm) {
                            c.timer = t;
                            c.focus_started_at = Some(chrono::Utc::now());
                        }
                    }
                }
            }
            let _ = app.emit("timer-changed", ());
        }
        _ => {}
    }
}

/// First tray install (setup).
pub fn install_tray<R: Runtime>(app: &mut tauri::App<R>, state: Arc<AppState>) -> tauri::Result<()> {
    let handle = app.handle().clone();
    let menu = build_root_menu(&handle, &state)?;
    let phase = {
        let core = state.inner.lock().expect("state mutex poisoned");
        core.timer.phase()
    };
    let icon = icon_for_phase(phase);

    let state_for_menu = state.clone();
    TrayIconBuilder::with_id("punto_tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = tray.app_handle().emit("tray-open", ());
            }
        })
        .on_menu_event(move |app, event| {
            handle_menu_event(app, &state_for_menu, &event);
        })
        .build(app)?;

    Ok(())
}

pub fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>, state: &Arc<AppState>) -> tauri::Result<()> {
    let menu = build_root_menu(app, state)?;
    if let Some(tray) = app.tray_by_id("punto_tray") {
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

pub fn set_tray_icon_phase<R: Runtime>(app: &AppHandle<R>, phase: Phase) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id("punto_tray") {
        tray.set_icon(Some(icon_for_phase(phase)))?;
    }
    Ok(())
}
