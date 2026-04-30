use punto::presets::{Preset, PresetInput, PresetStore};

#[test]
fn creates_preset_with_trimmed_name() {
    let preset = Preset::from_input(PresetInput {
        name: " Focus ".to_string(),
        focus_minutes: 25,
        break_minutes: 5,
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
    })
    .is_err());

    assert!(Preset::from_input(PresetInput {
        name: "Focus".to_string(),
        focus_minutes: 0,
        break_minutes: 5,
    })
    .is_err());
}

#[test]
fn store_adds_and_removes_presets_without_limit() {
    let mut store = PresetStore::default();
    let first = store
        .add(PresetInput {
            name: "Focus".to_string(),
            focus_minutes: 25,
            break_minutes: 5,
        })
        .expect("first preset");
    let second = store
        .add(PresetInput {
            name: "Deep Work".to_string(),
            focus_minutes: 55,
            break_minutes: 5,
        })
        .expect("second preset");

    assert_eq!(store.all().len(), 2);

    store.remove(first.id);

    assert_eq!(store.all().len(), 1);
    assert_eq!(store.all()[0].id, second.id);
}
