use serde::{de::DeserializeOwned, Serialize};
use std::{fs, io, path::Path};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("storage io error: {0}")]
    Io(#[from] io::Error),
    #[error("storage json error: {0}")]
    Json(#[from] serde_json::Error),
}

pub fn save_json<T: Serialize>(path: &Path, value: &T) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let json = serde_json::to_string_pretty(value)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn load_json<T: DeserializeOwned + Default>(path: &Path) -> Result<T, StorageError> {
    if !path.exists() {
        return Ok(T::default());
    }

    let json = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&json)?)
}
