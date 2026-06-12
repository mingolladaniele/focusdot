use serde::{Deserialize, Serialize};

fn default_notifications_enabled() -> bool {
    true
}

fn default_overtime_tracking_enabled() -> bool {
    false
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub auto_start_next_focus_after_break: bool,
    #[serde(default = "default_notifications_enabled")]
    pub notifications_enabled: bool,
    #[serde(default = "default_overtime_tracking_enabled")]
    pub overtime_tracking_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_start_next_focus_after_break: false,
            notifications_enabled: true,
            overtime_tracking_enabled: false,
        }
    }
}
