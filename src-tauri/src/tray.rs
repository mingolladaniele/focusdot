use std::sync::Arc;

use chrono::Utc;
use tauri::image::Image;
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use uuid::Uuid;

use crate::state::AppState;
use crate::timer::{Phase, TimerSnapshot};
use crate::window_layout::show_main_window_bottom_right;

const ICON_SIZE: u32 = 32;

/// RGBA disk with 1px edge feather; outside = transparent.
fn circular_icon_with_size(fill: (u8, u8, u8), pixel_size: u32) -> Image<'static> {
    let size = pixel_size as i32;
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
    Image::new_owned(buf, pixel_size, pixel_size)
}

fn circular_icon(fill: (u8, u8, u8)) -> Image<'static> {
    circular_icon_with_size(fill, ICON_SIZE)
}

/// Large idle dot for the window/taskbar icon (Windows scales small tray assets poorly).
pub fn window_title_icon() -> Image<'static> {
    circular_icon_with_size((255, 255, 255), 256)
}

pub fn icon_for_phase(phase: Phase) -> Image<'static> {
    match phase {
        Phase::Idle => circular_icon((255, 255, 255)),
        Phase::Focus | Phase::Overtime => circular_icon((43, 182, 115)),
        Phase::Break => circular_icon((74, 144, 226)),
    }
}

/// Tooltip shown when hovering the tray icon (Windows / macOS; Linux unsupported by tray-icon),
/// e.g. `focusdot · Focus · 12 min left · 2/4`.
pub fn tray_tooltip(snapshot: &TimerSnapshot) -> String {
    let mut parts = vec!["focusdot".to_string()];
    match snapshot.phase {
        Phase::Idle => parts.push("Idle".to_string()),
        Phase::Focus | Phase::Break => {
            let label = if snapshot.phase == Phase::Focus { "Focus" } else { "Break" };
            parts.push(label.to_string());
            parts.push(format!("{} min left", snapshot.remaining_seconds.div_ceil(60)));
        }
        Phase::Overtime => {
            parts.push("Overtime".to_string());
            parts.push(format!("+{} min", snapshot.overtime_seconds / 60));
        }
    }
    if snapshot.phase != Phase::Idle && snapshot.total_cycles > 1 {
        let current = snapshot.total_cycles - snapshot.cycles_remaining;
        parts.push(format!("{}/{}", current, snapshot.total_cycles));
    }
    if snapshot.phase != Phase::Idle && !snapshot.running {
        parts.push("paused".to_string());
    }
    parts.join(" · ")
}

/// Session controls for the tray menu, mirroring the dashboard: the primary action for the
/// current state first, then Stop where it means something different from the primary.
/// Breaks cannot be paused and overtime has a single exit, so neither offers Pause.
pub fn session_menu_items(snapshot: &TimerSnapshot) -> Vec<(&'static str, &'static str)> {
    match snapshot.phase {
        Phase::Idle => vec![],
        Phase::Focus if snapshot.running => vec![("pause", "Pause"), ("stop", "Stop")],
        Phase::Focus => vec![("resume", "Resume"), ("stop", "Stop")],
        Phase::Break if snapshot.break_continues_to_focus() => {
            vec![("skip_break", "Start focus now"), ("stop", "Stop")]
        }
        Phase::Break => vec![("skip_break", "End break")],
        Phase::Overtime => vec![("stop", "Finish focus")],
    }
}

/// Build root tray menu (presets submenu + controls).
pub fn build_root_menu<R: Runtime>(
    handle: &AppHandle<R>,
    state: &Arc<AppState>,
) -> tauri::Result<Menu<R>> {
    let core = state.inner.lock().expect("state mutex poisoned");
    let snapshot = core.timer.snapshot();
    let phase = snapshot.phase;
    let presets_snapshot = core.presets.all().to_vec();
    let quick = core.presets.quick_start().cloned();
    drop(core);

    let mut items: Vec<Box<dyn IsMenuItem<R>>> = Vec::new();

    if phase == Phase::Idle {
        if let Some(p) = &quick {
            let text = format!("Start {} ({}m focus / {}m break)", p.name, p.focus_minutes, p.break_minutes);
            let start = MenuItem::with_id(handle, "quick_start", text, true, None::<&str>)?;
            items.push(Box::new(start));
        }
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
    }

    for (id, label) in session_menu_items(&snapshot) {
        items.push(Box::new(MenuItem::with_id(handle, id, label, true, None::<&str>)?));
    }

    let settings = MenuItem::with_id(handle, "settings", "Settings & dashboard", true, None::<&str>)?;
    items.push(Box::new(settings));

    let sep = PredefinedMenuItem::separator(handle)?;
    items.push(Box::new(sep));

    let quit = MenuItem::with_id(handle, "exit", "Quit focusdot", true, None::<&str>)?;
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
                show_main_window_bottom_right(&window);
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
            let phase = {
                let mut c = match state.inner.lock() {
                    Ok(g) => g,
                    Err(_) => return,
                };
                if c.timer.phase() == Phase::Overtime {
                    let snap = crate::finalize_overtime_session(&mut c);
                    snap.phase
                } else {
                    c.timer = c.timer.clone().stop();
                    c.focus_started_at = None;
                    Phase::Idle
                }
            };
            let _ = set_tray_icon_phase(app, phase);
            let _ = refresh_tray_menu(app, state);
            if let Ok(c) = state.inner.lock() {
                let snap = c.timer.snapshot();
                drop(c);
                let _ = app.emit("timer-tick", &snap);
            }
        }
        "skip_break" => {
            let phase = {
                let mut c = match state.inner.lock() {
                    Ok(g) => g,
                    Err(_) => return,
                };
                match c.timer.clone().skip_break() {
                    Ok(t) => {
                        c.timer = t;
                        match c.timer.phase() {
                            Phase::Focus => c.focus_started_at = Some(Utc::now()),
                            Phase::Idle => c.focus_started_at = None,
                            Phase::Break | Phase::Overtime => {}
                        }
                        c.timer.phase()
                    }
                    Err(_) => return,
                }
            };
            let _ = set_tray_icon_phase(app, phase);
            let _ = refresh_tray_menu(app, state);
            if let Ok(c) = state.inner.lock() {
                let snap = c.timer.snapshot();
                drop(c);
                let _ = app.emit("timer-tick", &snap);
            }
        }
        "quick_start" => {
            start_and_notify(app, state, crate::quick_start_in_core);
        }
        s if s.starts_with("preset:") => {
            if let Ok(uid) = Uuid::parse_str(s.trim_start_matches("preset:")) {
                start_and_notify(app, state, |core| crate::start_preset_in_core(core, uid));
            }
        }
        _ => {}
    }
}

fn start_and_notify<R: Runtime>(
    app: &AppHandle<R>,
    state: &Arc<AppState>,
    start: impl FnOnce(&mut crate::state::Core) -> Result<TimerSnapshot, String>,
) {
    let snap = {
        let mut c = match state.inner.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        match start(&mut c) {
            Ok(snap) => snap,
            Err(_) => return,
        }
    };
    let _ = set_tray_icon_phase(app, snap.phase);
    let _ = refresh_tray_menu(app, state);
    let _ = app.emit("timer-tick", &snap);
}

/// First tray install (setup).
pub fn install_tray<R: Runtime>(app: &mut tauri::App<R>, state: Arc<AppState>) -> tauri::Result<()> {
    let handle = app.handle().clone();
    let menu = build_root_menu(&handle, &state)?;
    let snapshot = {
        let core = state.inner.lock().expect("state mutex poisoned");
        core.timer.snapshot()
    };
    let icon = icon_for_phase(snapshot.phase);

    let state_for_menu = state.clone();
    TrayIconBuilder::with_id("focusdot_tray")
        .icon(icon)
        .tooltip(tray_tooltip(&snapshot))
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
                    show_main_window_bottom_right(&w);
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
    let snapshot = state.inner.lock().expect("state mutex poisoned").timer.snapshot();
    if let Some(tray) = app.tray_by_id("focusdot_tray") {
        tray.set_menu(Some(menu))?;
        let _ = tray.set_tooltip(Some(tray_tooltip(&snapshot)));
    }
    Ok(())
}

pub fn set_tray_tooltip<R: Runtime>(app: &AppHandle<R>, text: &str) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id("focusdot_tray") {
        tray.set_tooltip(Some(text))?;
    }
    Ok(())
}

pub fn set_tray_icon_phase<R: Runtime>(app: &AppHandle<R>, phase: Phase) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id("focusdot_tray") {
        tray.set_icon(Some(icon_for_phase(phase)))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{session_menu_items, tray_tooltip};
    use crate::timer::Timer;

    fn ids(t: &Timer) -> Vec<&'static str> {
        session_menu_items(&t.snapshot()).into_iter().map(|(id, _)| id).collect()
    }

    #[test]
    fn menu_offers_one_primary_action_per_state() {
        let idle = Timer::new();
        assert!(ids(&idle).is_empty());

        let focus = Timer::new().start_focus(1, 1, 2, false, true).unwrap();
        assert_eq!(ids(&focus), ["pause", "stop"]);
        assert_eq!(ids(&focus.clone().pause().unwrap()), ["resume", "stop"]);

        let brk = Timer::new().start_focus(1, 1, 2, false, false).unwrap().tick(60).timer;
        assert_eq!(ids(&brk), ["skip_break", "stop"]);

        let last_break = Timer::new().start_focus(1, 1, 1, false, false).unwrap().tick(60).timer;
        assert_eq!(session_menu_items(&last_break.snapshot()), [("skip_break", "End break")]);

        let overtime = focus.tick(60).timer;
        assert_eq!(session_menu_items(&overtime.snapshot()), [("stop", "Finish focus")]);
    }

    #[test]
    fn tooltip_idle() {
        assert_eq!(tray_tooltip(&Timer::new().snapshot()), "focusdot · Idle");
    }

    #[test]
    fn tooltip_shows_minutes_left_rounded_up() {
        let t = Timer::new().start_focus(25, 5, 1, false, false).unwrap().tick(30).timer;
        assert_eq!(tray_tooltip(&t.snapshot()), "focusdot · Focus · 25 min left");
        let t = t.tick(31).timer;
        assert_eq!(tray_tooltip(&t.snapshot()), "focusdot · Focus · 24 min left");
    }

    #[test]
    fn tooltip_shows_cycle_and_pause() {
        let t = Timer::new().start_focus(25, 5, 4, false, false).unwrap().pause().unwrap();
        assert_eq!(
            tray_tooltip(&t.snapshot()),
            "focusdot · Focus · 25 min left · 1/4 · paused"
        );
    }

    #[test]
    fn tooltip_overtime() {
        let t = Timer::new()
            .start_focus(1, 5, 1, false, true)
            .unwrap()
            .tick(60)
            .timer
            .tick(125)
            .timer;
        assert_eq!(tray_tooltip(&t.snapshot()), "focusdot · Overtime · +2 min");
    }
}
