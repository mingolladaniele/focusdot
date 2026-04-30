use std::sync::Arc;

use chrono::Utc;
use tauri::image::Image;
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use uuid::Uuid;

use crate::state::AppState;
use crate::timer::Phase;

const ICON_SIZE: u32 = 32;

/// 32×32 RGBA disk with 1px edge feather; outside = transparent.
fn circular_icon(fill: (u8, u8, u8)) -> Image<'static> {
    let size = ICON_SIZE as i32;
    let radius = (size as f32) / 2.0 - 1.0;
    let centre = (size as f32 - 1.0) / 2.0;
    let mut buf = vec![0u8; (size * size * 4) as usize];
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - centre;
            let dy = y as f32 - centre;
            let dist = (dx * dx + dy * dy).sqrt();
            let alpha = if dist <= radius - 1.0 {
                255.0
            } else if dist <= radius {
                255.0 * (radius - dist).max(0.0)
            } else {
                0.0
            };
            let i = ((y * size + x) * 4) as usize;
            buf[i] = fill.0;
            buf[i + 1] = fill.1;
            buf[i + 2] = fill.2;
            buf[i + 3] = alpha as u8;
        }
    }
    Image::new_owned(buf, ICON_SIZE, ICON_SIZE)
}

pub fn icon_for_phase(phase: Phase) -> Image<'static> {
    match phase {
        Phase::Idle => circular_icon((255, 255, 255)),
        Phase::Focus => circular_icon((43, 182, 115)),
        Phase::Break => circular_icon((74, 144, 226)),
    }
}

/// Build root tray menu (presets submenu + controls).
pub fn build_root_menu<R: Runtime>(
    handle: &AppHandle<R>,
    state: &Arc<AppState>,
) -> tauri::Result<Menu<R>> {
    let core = state.inner.lock().expect("state mutex poisoned");
    let phase = core.timer.phase();
    let running = core.timer.is_running();
    let presets_snapshot = core.presets.all().to_vec();
    drop(core);

    let mut items: Vec<Box<dyn IsMenuItem<R>>> = Vec::new();

    if phase == Phase::Idle {
        let preset_items: Vec<MenuItem<R>> = presets_snapshot
            .iter()
            .map(|p| {
                let id = format!("preset:{}", p.id);
                let text = format!("{} · {}m / {}m", p.name, p.focus_minutes, p.break_minutes);
                MenuItem::with_id(handle, id, text, true, None::<&str>)
            })
            .collect::<tauri::Result<_>>()?;
        let preset_refs: Vec<&dyn IsMenuItem<R>> =
            preset_items.iter().map(|i| i as &dyn IsMenuItem<R>).collect();
        let presets = Submenu::with_items(
            handle,
            "Start preset",
            !presets_snapshot.is_empty(),
            &preset_refs,
        )?;
        items.push(Box::new(presets));
    } else if running {
        let pause = MenuItem::with_id(
            handle,
            "pause",
            "Pause (keep remaining time)",
            true,
            None::<&str>,
        )?;
        items.push(Box::new(pause));
    } else {
        let resume = MenuItem::with_id(handle, "resume", "Resume", true, None::<&str>)?;
        items.push(Box::new(resume));
    }

    if phase != Phase::Idle {
        let stop = MenuItem::with_id(
            handle,
            "stop",
            "Stop (reset to idle)",
            true,
            None::<&str>,
        )?;
        items.push(Box::new(stop));
    }

    let settings = MenuItem::with_id(handle, "settings", "Settings", true, None::<&str>)?;
    items.push(Box::new(settings));

    let sep = PredefinedMenuItem::separator(handle)?;
    items.push(Box::new(sep));

    let quit = MenuItem::with_id(handle, "exit", "Quit Punto", true, None::<&str>)?;
    items.push(Box::new(quit));

    let refs: Vec<&dyn IsMenuItem<R>> = items.iter().map(|b| b.as_ref()).collect();
    Menu::with_items(handle, &refs)
}

pub fn handle_menu_event<R: Runtime>(
    app: &AppHandle<R>,
    state: &Arc<AppState>,
    event: &tauri::menu::MenuEvent,
) {
    let id = event.id().as_ref();
    match id {
        "exit" => app.exit(0),
        "settings" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "pause" => {
            if let Ok(mut c) = state.inner.lock() {
                if let Ok(t) = c.timer.clone().pause() {
                    c.timer = t;
                }
            }
            let _ = refresh_tray_menu(app, state);
            if let Ok(c) = state.inner.lock() {
                let snap = c.timer.snapshot();
                drop(c);
                let _ = app.emit("timer-tick", &snap);
            }
        }
        "resume" => {
            if let Ok(mut c) = state.inner.lock() {
                if let Ok(t) = c.timer.clone().resume() {
                    c.timer = t;
                }
            }
            let _ = refresh_tray_menu(app, state);
            if let Ok(c) = state.inner.lock() {
                let snap = c.timer.snapshot();
                drop(c);
                let _ = app.emit("timer-tick", &snap);
            }
        }
        "stop" => {
            if let Ok(mut c) = state.inner.lock() {
                c.timer = c.timer.clone().stop();
                c.focus_started_at = None;
            }
            let _ = set_tray_icon_phase(app, Phase::Idle);
            let _ = refresh_tray_menu(app, state);
            if let Ok(c) = state.inner.lock() {
                let snap = c.timer.snapshot();
                drop(c);
                let _ = app.emit("timer-tick", &snap);
            }
        }
        s if s.starts_with("preset:") => {
            let rest = s.trim_start_matches("preset:");
            if let Ok(uid) = Uuid::parse_str(rest) {
                if let Ok(mut c) = state.inner.lock() {
                    if let Some(preset) = c.presets.all().iter().find(|p| p.id == uid).cloned() {
                        if let Ok(t) = c.timer.clone().stop().start_focus(
                            preset.focus_minutes,
                            preset.break_minutes,
                            preset.cycles,
                            c.settings.auto_start_next_focus_after_break,
                        ) {
                            c.timer = t;
                            c.focus_started_at = Some(Utc::now());
                        }
                    }
                }
            }
            let _ = set_tray_icon_phase(app, Phase::Focus);
            let _ = refresh_tray_menu(app, state);
            if let Ok(c) = state.inner.lock() {
                let snap = c.timer.snapshot();
                drop(c);
                let _ = app.emit("timer-tick", &snap);
            }
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
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(w) = tray.app_handle().get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
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
