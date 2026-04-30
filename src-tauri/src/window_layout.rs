//! Place the main window in the monitor work area bottom-right (above taskbar on Windows).

use tauri::{PhysicalPosition, Position, Runtime, WebviewWindow};

/// Prefer the monitor whose work area contains the cursor (e.g. tray); else primary; else current.
fn pick_monitor<R: Runtime>(window: &WebviewWindow<R>) -> Option<tauri::Monitor> {
    if let Ok(cursor) = window.cursor_position() {
        let cx = cursor.x;
        let cy = cursor.y;
        if let Ok(monitors) = window.available_monitors() {
            for m in monitors {
                let wa = m.work_area();
                let left = wa.position.x as f64;
                let top = wa.position.y as f64;
                let right = left + f64::from(wa.size.width);
                let bottom = top + f64::from(wa.size.height);
                if cx >= left && cx < right && cy >= top && cy < bottom {
                    return Some(m);
                }
            }
        }
    }
    window.primary_monitor().ok().flatten().or_else(|| window.current_monitor().ok().flatten())
}

/// Top-left `PhysicalPosition` so the window's outer rect sits in the work area bottom-right.
fn bottom_right_in_work_area<R: Runtime>(window: &WebviewWindow<R>, monitor: &tauri::Monitor) -> Option<PhysicalPosition<i32>> {
    let outer = window.outer_size().ok()?;
    let w = outer.width as i32;
    let h = outer.height as i32;
    let wa = monitor.work_area();
    let x = wa.position.x + wa.size.width as i32 - w;
    let y = wa.position.y + wa.size.height as i32 - h;
    let x = x.max(wa.position.x);
    let y = y.max(wa.position.y);
    Some(PhysicalPosition::new(x, y))
}

/// Unminimize, snap to work-area bottom-right (near tray on typical Windows setups), show, focus.
pub fn show_main_window_bottom_right<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.unminimize();
    if let Some(m) = pick_monitor(window) {
        if let Some(pos) = bottom_right_in_work_area(window, &m) {
            let _ = window.set_position(Position::Physical(pos));
        }
    }
    let _ = window.show();
    let _ = window.set_focus();
}
