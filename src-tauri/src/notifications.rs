use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn notify_focus_complete(app: &AppHandle, break_minutes: u32) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Focus complete")
        .body(format!("Time for a {break_minutes} minute break."))
        .show()
        .map_err(|e| e.to_string())
}

pub fn notify_break_complete(app: &AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Break over")
        .body("Ready when you are.")
        .show()
        .map_err(|e| e.to_string())
}
