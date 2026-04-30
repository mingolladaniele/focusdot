use chrono::{Local, TimeZone, Utc};
use punto::history::{FocusSession, History};
use punto::stats::calculate_stats;
use punto::storage::{load_json, save_json};

#[test]
fn saves_and_loads_history_json() {
    let temp = assert_fs::TempDir::new().expect("temp dir");
    let path = temp.path().join("history.json");
    let history = History {
        sessions: vec![FocusSession {
            started_at: Utc.with_ymd_and_hms(2026, 4, 30, 9, 0, 0).unwrap(),
            duration_minutes: 25,
        }],
    };

    save_json(&path, &history).expect("save history");
    let loaded: History = load_json(&path).expect("load history");

    assert_eq!(loaded, history);
}

#[test]
fn missing_json_file_returns_default_value() {
    let temp = assert_fs::TempDir::new().expect("temp dir");
    let path = temp.path().join("missing.json");

    let loaded: History = load_json(&path).expect("load missing history");

    assert_eq!(loaded, History::default());
}

#[test]
fn calculates_today_sessions_and_week_minutes() {
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 12, 0, 0).unwrap();
    let history = History {
        sessions: vec![
            FocusSession {
                started_at: Utc.with_ymd_and_hms(2026, 4, 30, 9, 0, 0).unwrap(),
                duration_minutes: 25,
            },
            FocusSession {
                started_at: Utc.with_ymd_and_hms(2026, 4, 29, 9, 0, 0).unwrap(),
                duration_minutes: 55,
            },
            FocusSession {
                started_at: Utc.with_ymd_and_hms(2026, 4, 20, 9, 0, 0).unwrap(),
                duration_minutes: 25,
            },
        ],
    };

    let stats = calculate_stats(&history, now);

    assert_eq!(stats.sessions_today, 1);
    assert_eq!(stats.focus_minutes_this_week, 80);
}

#[test]
fn calculates_focus_minutes_today() {
    use chrono::TimeZone;
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 12, 0, 0).unwrap();
    let history = History {
        sessions: vec![
            FocusSession {
                started_at: now,
                duration_minutes: 25,
            },
            FocusSession {
                started_at: now - chrono::Duration::hours(2),
                duration_minutes: 50,
            },
            FocusSession {
                started_at: now - chrono::Duration::days(1),
                duration_minutes: 25,
            },
        ],
    };
    let stats = calculate_stats(&history, now);
    assert_eq!(stats.focus_minutes_today, 75);
    assert_eq!(stats.sessions_today, 2);
}

#[test]
fn calculates_streak_days() {
    use chrono::TimeZone;
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 12, 0, 0).unwrap();
    let history = History {
        sessions: vec![
            FocusSession {
                started_at: now,
                duration_minutes: 25,
            },
            FocusSession {
                started_at: now - chrono::Duration::days(1),
                duration_minutes: 25,
            },
            FocusSession {
                started_at: now - chrono::Duration::days(2),
                duration_minutes: 25,
            },
            // Gap: no session 3 days ago.
            FocusSession {
                started_at: now - chrono::Duration::days(4),
                duration_minutes: 25,
            },
        ],
    };
    let stats = calculate_stats(&history, now);
    assert_eq!(stats.current_streak_days, 3);
}

#[test]
fn streak_is_zero_when_no_session_today() {
    use chrono::TimeZone;
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 12, 0, 0).unwrap();
    let history = History {
        sessions: vec![FocusSession {
            started_at: now - chrono::Duration::days(1),
            duration_minutes: 25,
        }],
    };
    let stats = calculate_stats(&history, now);
    assert_eq!(stats.current_streak_days, 0);
}

#[test]
fn uses_local_day_boundaries() {
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 0, 30, 0).unwrap();
    let history = History {
        sessions: vec![
            FocusSession {
                started_at: Utc.with_ymd_and_hms(2026, 4, 29, 23, 45, 0).unwrap(),
                duration_minutes: 20,
            },
            FocusSession {
                started_at: Utc.with_ymd_and_hms(2026, 4, 30, 0, 15, 0).unwrap(),
                duration_minutes: 30,
            },
        ],
    };

    let local_today = now.with_timezone(&Local).date_naive();
    let expected_sessions = history
        .sessions
        .iter()
        .filter(|session| session.started_at.with_timezone(&Local).date_naive() == local_today)
        .count();
    let expected_minutes: u32 = history
        .sessions
        .iter()
        .filter(|session| session.started_at.with_timezone(&Local).date_naive() == local_today)
        .map(|session| session.duration_minutes)
        .sum();

    let stats = calculate_stats(&history, now);
    assert_eq!(stats.sessions_today, expected_sessions);
    assert_eq!(stats.focus_minutes_today, expected_minutes);
}
