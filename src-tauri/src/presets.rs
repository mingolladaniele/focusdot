use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: Uuid,
    pub name: String,
    pub focus_minutes: u32,
    pub break_minutes: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetInput {
    pub name: String,
    pub focus_minutes: u32,
    pub break_minutes: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PresetStore {
    presets: Vec<Preset>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PresetError {
    #[error("name, focus minutes, and break minutes are required")]
    InvalidInput,
}

impl Preset {
    pub fn from_input(input: PresetInput) -> Result<Self, PresetError> {
        let name = input.name.trim().to_string();
        if name.is_empty() || input.focus_minutes == 0 || input.break_minutes == 0 {
            return Err(PresetError::InvalidInput);
        }

        Ok(Self {
            id: Uuid::new_v4(),
            name,
            focus_minutes: input.focus_minutes,
            break_minutes: input.break_minutes,
        })
    }
}

impl PresetStore {
    pub fn add(&mut self, input: PresetInput) -> Result<Preset, PresetError> {
        let preset = Preset::from_input(input)?;
        self.presets.push(preset.clone());
        Ok(preset)
    }

    pub fn remove(&mut self, id: Uuid) {
        self.presets.retain(|preset| preset.id != id);
    }

    pub fn all(&self) -> &[Preset] {
        &self.presets
    }
}
