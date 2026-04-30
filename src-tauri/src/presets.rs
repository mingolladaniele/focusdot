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

    pub fn remove(&mut self, id: Uuid) {
        self.presets.retain(|preset| preset.id != id);
    }

    pub fn all(&self) -> &[Preset] {
        &self.presets
    }
}
