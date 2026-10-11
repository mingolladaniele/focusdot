use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

fn default_cycles() -> u32 {
    1
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: Uuid,
    pub name: String,
    pub focus_minutes: u32,
    pub break_minutes: u32,
    #[serde(default = "default_cycles")]
    pub cycles: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetInput {
    #[serde(default)]
    pub id: Option<Uuid>,
    pub name: String,
    pub focus_minutes: u32,
    pub break_minutes: u32,
    #[serde(default = "default_cycles")]
    pub cycles: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PresetStore {
    presets: Vec<Preset>,
    /// Preset started most recently; drives the one-click Start in tray and dashboard.
    #[serde(default, rename = "lastUsedId", skip_serializing_if = "Option::is_none")]
    last_used_id: Option<Uuid>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PresetError {
    #[error("name, focus minutes, and break minutes are required")]
    InvalidInput,
    #[error("cycles must be at least 1")]
    InvalidCycles,
    #[error("preset not found")]
    NotFound,
}

fn validate_body(input: &PresetInput) -> Result<(String, u32, u32, u32), PresetError> {
    let name = input.name.trim().to_string();
    if name.is_empty() || input.focus_minutes == 0 || input.break_minutes == 0 {
        return Err(PresetError::InvalidInput);
    }
    if input.cycles == 0 {
        return Err(PresetError::InvalidCycles);
    }
    Ok((name, input.focus_minutes, input.break_minutes, input.cycles))
}

impl Preset {
    fn new_from_input(input: PresetInput) -> Result<Self, PresetError> {
        let (name, focus_minutes, break_minutes, cycles) = validate_body(&input)?;
        Ok(Self {
            id: Uuid::new_v4(),
            name,
            focus_minutes,
            break_minutes,
            cycles,
        })
    }
}

impl PresetStore {
    pub fn upsert(&mut self, input: PresetInput) -> Result<Preset, PresetError> {
        match input.id {
            Some(id) => {
                if !self.presets.iter().any(|p| p.id == id) {
                    return Err(PresetError::NotFound);
                }
                let (name, focus_minutes, break_minutes, cycles) = validate_body(&input)?;
                let updated = Preset {
                    id,
                    name,
                    focus_minutes,
                    break_minutes,
                    cycles,
                };
                if let Some(slot) = self.presets.iter_mut().find(|p| p.id == id) {
                    *slot = updated.clone();
                }
                Ok(updated)
            }
            None => {
                let preset = Preset::new_from_input(input)?;
                self.presets.push(preset.clone());
                Ok(preset)
            }
        }
    }

    /// Store used on first launch, so a timer can be started without any setup.
    pub fn with_defaults() -> Self {
        let mut store = Self::default();
        store
            .upsert(PresetInput {
                id: None,
                name: "Pomodoro".to_string(),
                focus_minutes: 25,
                break_minutes: 5,
                cycles: 1,
            })
            .expect("default preset is valid");
        store
    }

    pub fn remove(&mut self, id: Uuid) {
        self.presets.retain(|preset| preset.id != id);
        if self.last_used_id == Some(id) {
            self.last_used_id = None;
        }
    }

    pub fn get(&self, id: Uuid) -> Option<&Preset> {
        self.presets.iter().find(|p| p.id == id)
    }

    pub fn mark_used(&mut self, id: Uuid) {
        if self.get(id).is_some() {
            self.last_used_id = Some(id);
        }
    }

    /// Last used preset, falling back to the first one.
    pub fn quick_start(&self) -> Option<&Preset> {
        self.last_used_id
            .and_then(|id| self.get(id))
            .or_else(|| self.presets.first())
    }

    pub fn all(&self) -> &[Preset] {
        &self.presets
    }
}
