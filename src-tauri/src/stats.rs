use chrono::{DateTime, Datelike, Utc};
use serde::{Deserialize, Serialize};

use crate::history::History;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Stats {
    pub sessions_today: usize,
    pub focus_minutes_this_week: u32,
}

pub fn calculate_stats(history: &History, now: DateTime<Utc>) -> Stats {
    let today = now.date_naive();
    let current_week = now.iso_week();

    let sessions_today = history
        .sessions
        .iter()
        .filter(|session| session.started_at.date_naive() == today)
        .count();

    let focus_minutes_this_week = history
        .sessions
        .iter()
        .filter(|session| session.started_at.iso_week() == current_week)
        .map(|session| session.duration_minutes)
        .sum();

    Stats {
        sessions_today,
        focus_minutes_this_week,
    }
}
