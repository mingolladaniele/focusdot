use std::collections::HashSet;

use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::history::History;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub sessions_today: usize,
    pub focus_minutes_today: u32,
    pub focus_minutes_this_week: u32,
    pub focus_minutes_this_month: u32,
    pub focus_minutes_this_year: u32,
    pub current_streak_days: u32,
}

pub fn calculate_stats(history: &History, now: DateTime<Utc>) -> Stats {
    let now_local = now.with_timezone(&Local);
    let today = now_local.date_naive();
    let current_week = now_local.iso_week();

    let sessions_today = history
        .sessions
        .iter()
        .filter(|session| session.started_at.with_timezone(&Local).date_naive() == today)
        .count();

    let focus_minutes_today: u32 = history
        .sessions
        .iter()
        .filter(|session| session.started_at.with_timezone(&Local).date_naive() == today)
        .map(|session| session.duration_minutes)
        .sum::<u32>();

    let focus_minutes_this_week: u32 = history
        .sessions
        .iter()
        .filter(|session| session.started_at.with_timezone(&Local).iso_week() == current_week)
        .map(|session| session.duration_minutes)
        .sum::<u32>();

    let focus_minutes_this_month: u32 = history
        .sessions
        .iter()
        .filter(|session| {
            let d = session.started_at.with_timezone(&Local);
            d.year() == now_local.year() && d.month() == now_local.month()
        })
        .map(|session| session.duration_minutes)
        .sum::<u32>();

    let focus_minutes_this_year: u32 = history
        .sessions
        .iter()
        .filter(|session| {
            session.started_at.with_timezone(&Local).year() == now_local.year()
        })
        .map(|session| session.duration_minutes)
        .sum::<u32>();

    let session_dates: HashSet<NaiveDate> = history
        .sessions
        .iter()
        .map(|session| session.started_at.with_timezone(&Local).date_naive())
        .collect();
    let mut current_streak_days = 0u32;
    let mut cursor = today;
    while session_dates.contains(&cursor) {
        current_streak_days += 1;
        cursor = match cursor.checked_sub_signed(Duration::days(1)) {
            Some(date) => date,
            None => break,
        };
    }

    Stats {
        sessions_today,
        focus_minutes_today,
        focus_minutes_this_week,
        focus_minutes_this_month,
        focus_minutes_this_year,
        current_streak_days,
    }
}
