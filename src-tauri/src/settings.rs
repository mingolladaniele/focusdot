use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub auto_start_next_focus_after_break: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_start_next_focus_after_break: false,
        }
    }
}
