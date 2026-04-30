use punto::presets::{Preset, PresetError, PresetInput, PresetStore};

#[test]
fn creates_preset_with_trimmed_name() {
    let preset = Preset::from_input(PresetInput {
        name: " Focus ".to_string(),
        focus_minutes: 25,
        break_minutes: 5,
        cycles: 1,
        auto_start_next: false,
    })
    .expect("valid preset");

    assert_eq!(preset.name, "Focus");
    assert_eq!(preset.focus_minutes, 25);
    assert_eq!(preset.break_minutes, 5);
}

#[test]
fn rejects_empty_name_and_zero_minutes() {
    assert!(Preset::from_input(PresetInput {
        name: " ".to_string(),
        focus_minutes: 25,
        break_minutes: 5,
        cycles: 1,
        auto_start_next: false,
    })
    .is_err());

    assert!(Preset::from_input(PresetInput {
        name: "Focus".to_string(),
        focus_minutes: 0,
        break_minutes: 5,
        cycles: 1,
        auto_start_next: false,
    })
    .is_err());
}

#[test]
fn rejects_zero_cycles() {
    let err = Preset::from_input(PresetInput {
        name: "Focus".to_string(),
        focus_minutes: 25,
        break_minutes: 5,
        cycles: 0,
        auto_start_next: false,
    })
    .expect_err("zero cycles rejected");

    assert_eq!(err, PresetError::InvalidCycles);
}

#[test]
fn store_adds_and_removes_presets_without_limit() {
    let mut store = PresetStore::default();
    let first = store
        .add(PresetInput {
            name: "Focus".to_string(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 1,
            auto_start_next: false,
        })
        .expect("first preset");
    let second = store
        .add(PresetInput {
            name: "Deep Work".to_string(),
            focus_minutes: 55,
            break_minutes: 5,
            cycles: 1,
            auto_start_next: false,
        })
        .expect("second preset");

    assert_eq!(store.all().len(), 2);

    store.remove(first.id);

    assert_eq!(store.all().len(), 1);
    assert_eq!(store.all()[0].id, second.id);
}

#[test]
fn preset_stores_cycles_and_auto_start_next() {
    let mut store = PresetStore::default();
    let p = store
        .add(PresetInput {
            name: "Deep work".into(),
            focus_minutes: 25,
            break_minutes: 5,
            cycles: 4,
            auto_start_next: true,
        })
        .expect("preset added");
    assert_eq!(p.cycles, 4);
    assert!(p.auto_start_next);
}

#[test]
fn preset_defaults_cycles_to_one_and_auto_start_to_false() {
    let raw = r#"{"presets":[{"id":"00000000-0000-0000-0000-000000000001","name":"Old","focusMinutes":25,"breakMinutes":5}]}"#;
    let store: PresetStore = serde_json::from_str(raw).expect("decodes legacy presets");
    let p = &store.all()[0];
    assert_eq!(p.cycles, 1);
    assert!(!p.auto_start_next);
}
