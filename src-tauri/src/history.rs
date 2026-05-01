use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct History {
    pub sessions: Vec<FocusSession>,
}

/// One completed focus block. JSON uses camelCase; `alias` keeps snake_case files valid.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSession {
    #[serde(alias = "started_at")]
    pub started_at: DateTime<Utc>,
    #[serde(alias = "duration_minutes")]
    pub duration_minutes: u32,
    #[serde(default)]
    pub starred: bool,
}
