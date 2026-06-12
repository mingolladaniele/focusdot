use focusdot::notifications::{break_complete_message, focus_complete_message, NotificationCopy};
use focusdot::stats::Stats;

fn sample_stats() -> Stats {
    Stats {
        sessions_today: 2,
        focus_minutes_today: 50,
        focus_minutes_this_week: 180,
        focus_minutes_this_month: 400,
        focus_minutes_this_year: 1200,
        current_streak_days: 3,
    }
}

#[test]
fn focus_message_is_short_and_personalized() {
    let stats = sample_stats();
    let msg: NotificationCopy = focus_complete_message(&stats, 5);
    assert!(msg.title.len() <= 32);
    assert!(msg.body.contains("50"));
    assert!(msg.body.contains("5"));
}

#[test]
fn focus_message_rotation_is_deterministic_by_sessions_today() {
    let mut stats_a = sample_stats();
    stats_a.sessions_today = 0;
    let mut stats_b = sample_stats();
    stats_b.sessions_today = 3;
    let a = focus_complete_message(&stats_a, 5);
    let b = focus_complete_message(&stats_b, 5);
    assert_eq!(a, b);
}

#[test]
fn break_message_is_short_and_includes_stats() {
    let stats = sample_stats();
    let msg: NotificationCopy = break_complete_message(&stats);
    assert!(msg.title.len() <= 32);
    assert!(msg.body.contains("2"));
    assert!(msg.body.contains("3"));
}

#[test]
fn overtime_started_message_mentions_still_tracking() {
    let copy = focusdot::notifications::overtime_started_message();
    assert!(copy.title.to_lowercase().contains("pomodoro")
        || copy.title.to_lowercase().contains("focus"));
    assert!(copy.body.to_lowercase().contains("track")
        || copy.body.to_lowercase().contains("stop"));
}
