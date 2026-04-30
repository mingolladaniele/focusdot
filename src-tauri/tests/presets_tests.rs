use uuid::Uuid;

use focusdot::presets::{PresetError, PresetInput, PresetStore};

#[test]
fn creates_preset_with_trimmed_name() {
    let mut store = PresetStore::default();
    let preset = store
        .upsert(PresetInput {
            id: None,
            name: " Focus ".to_string(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 1,
        })
        .expect("valid preset");

    assert_eq!(preset.name, "Focus");
    assert_eq!(preset.focus_minutes, 25);
    assert_eq!(preset.break_minutes, 5);
}

#[test]
fn rejects_empty_name_and_zero_minutes() {
    let mut store = PresetStore::default();
    assert!(store
        .upsert(PresetInput {
            id: None,
            name: " ".to_string(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 1,
        })
        .is_err());

    assert!(store
        .upsert(PresetInput {
            id: None,
            name: "Focus".to_string(),
            focus_minutes: 0,
            break_minutes: 5,
            cycles: 1,
        })
        .is_err());
}

#[test]
fn rejects_zero_cycles() {
    let mut store = PresetStore::default();
    let err = store
        .upsert(PresetInput {
            id: None,
            name: "Focus".to_string(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 0,
        })
        .expect_err("zero cycles rejected");

    assert_eq!(err, PresetError::InvalidCycles);
}

#[test]
fn store_adds_and_removes_presets_without_limit() {
    let mut store = PresetStore::default();
    let first = store
        .upsert(PresetInput {
            id: None,
            name: "Focus".to_string(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 1,
        })
        .expect("first preset");
    let second = store
        .upsert(PresetInput {
            id: None,
            name: "Deep Work".to_string(),
            focus_minutes: 55,
            break_minutes: 5,
            cycles: 1,
        })
        .expect("second preset");

    assert_eq!(store.all().len(), 2);

    store.remove(first.id);

    assert_eq!(store.all().len(), 1);
    assert_eq!(store.all()[0].id, second.id);
}

#[test]
fn preset_stores_cycles() {
    let mut store = PresetStore::default();
    let p = store
        .upsert(PresetInput {
            id: None,
            name: "Deep work".into(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 4,
        })
        .expect("preset added");
    assert_eq!(p.cycles, 4);
}

#[test]
fn preset_defaults_cycles_to_one_when_missing_in_json() {
    let raw = r#"{"presets":[{"id":"00000000-0000-0000-0000-000000000001","name":"Old","focusMinutes":25,"breakMinutes":5}]}"#;
    let store: PresetStore = serde_json::from_str(raw).expect("decodes legacy presets");
    let p = &store.all()[0];
    assert_eq!(p.cycles, 1);
}

#[test]
fn upsert_updates_existing_preset_by_id() {
    let mut store = PresetStore::default();
    let created = store
        .upsert(PresetInput {
            id: None,
            name: "One".into(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 2,
        })
        .expect("created");

    let updated = store
        .upsert(PresetInput {
            id: Some(created.id),
            name: "Renamed".into(),
            focus_minutes: 50,
            break_minutes: 10,
            cycles: 3,
        })
        .expect("updated");

    assert_eq!(updated.id, created.id);
    assert_eq!(updated.name, "Renamed");
    assert_eq!(updated.focus_minutes, 50);
    assert_eq!(updated.break_minutes, 10);
    assert_eq!(updated.cycles, 3);
    assert_eq!(store.all().len(), 1);
}

#[test]
fn upsert_with_unknown_id_returns_not_found() {
    let mut store = PresetStore::default();
    let err = store
        .upsert(PresetInput {
            id: Some(Uuid::nil()),
            name: "Nope".into(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 1,
        })
        .expect_err("unknown id");

    assert_eq!(err, PresetError::NotFound);
}
