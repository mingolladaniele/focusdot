use std::path::PathBuf;
use std::sync::Mutex;

use chrono::{DateTime, Utc};
use tauri::AppHandle;

use crate::history::History;
use crate::presets::PresetStore;
use crate::timer::Timer;

pub struct Core {
    pub timer: Timer,
    pub history: History,
    pub presets: PresetStore,
    pub focus_started_at: Option<DateTime<Utc>>,
    pub history_path: PathBuf,
    pub presets_path: PathBuf,
}

pub struct AppState {
    pub inner: Mutex<Core>,
    pub app: AppHandle,
}

impl AppState {
    pub fn new(app: AppHandle, history_path: PathBuf, presets_path: PathBuf) -> Self {
        let history = crate::storage::load_json::<History>(&history_path).unwrap_or_default();
        let presets = crate::storage::load_json::<PresetStore>(&presets_path).unwrap_or_default();

        Self {
            inner: Mutex::new(Core {
                timer: Timer::new(),
                history,
                presets,
                focus_started_at: None,
                history_path,
                presets_path,
            }),
            app,
        }
    }
}
