use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::stats::Stats;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NotificationCopy {
    pub title: String,
    pub body: String,
}

pub fn focus_complete_message(stats: &Stats, break_minutes: u32) -> NotificationCopy {
    let templates = [
        (
            "Nice focus sprint",
            format!(
                "{} min today. Take {} min to reset.",
                stats.focus_minutes_today, break_minutes
            ),
        ),
        (
            "You are on track",
            format!(
                "{} sessions done. {} min break, then back in.",
                stats.sessions_today, break_minutes
            ),
        ),
        (
            "Strong momentum",
            format!(
                "{} min banked today. Enjoy {} min break.",
                stats.focus_minutes_today, break_minutes
            ),
        ),
    ];
    let idx = stats.sessions_today % templates.len();
    NotificationCopy {
        title: templates[idx].0.to_string(),
        body: templates[idx].1.clone(),
    }
}

pub fn break_complete_message(stats: &Stats) -> NotificationCopy {
    let templates = [
        (
            "Break complete",
            format!(
                "{} sessions today. Keep the {} day streak alive.",
                stats.sessions_today, stats.current_streak_days
            ),
        ),
        (
            "Ready to focus",
            format!(
                "{} min logged today. Streak: {} days.",
                stats.focus_minutes_today, stats.current_streak_days
            ),
        ),
    ];
    let idx = stats.sessions_today % templates.len();
    NotificationCopy {
        title: templates[idx].0.to_string(),
        body: templates[idx].1.clone(),
    }
}

pub fn notify_focus_complete(
    app: &AppHandle,
    stats: &Stats,
    break_minutes: u32,
) -> Result<(), String> {
    let copy = focus_complete_message(stats, break_minutes);
    app.notification()
        .builder()
        .title(&copy.title)
        .body(&copy.body)
        .show()
        .map_err(|e| e.to_string())
}

pub fn notify_break_complete(app: &AppHandle, stats: &Stats) -> Result<(), String> {
    let copy = break_complete_message(stats);
    app.notification()
        .builder()
        .title(&copy.title)
        .body(&copy.body)
        .show()
        .map_err(|e| e.to_string())
}
