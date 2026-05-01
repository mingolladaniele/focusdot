use focusdot::settings::AppSettings;

#[test]
fn notifications_enabled_defaults_true_when_field_missing() {
    let json = r#"{"autoStartNextFocusAfterBreak":true}"#;
    let s: AppSettings = serde_json::from_str(json).unwrap();
    assert!(s.notifications_enabled);
}

#[test]
fn notifications_enabled_round_trips() {
    let s = AppSettings {
        auto_start_next_focus_after_break: true,
        notifications_enabled: false,
    };
    let v = serde_json::to_value(&s).unwrap();
    let back: AppSettings = serde_json::from_value(v).unwrap();
    assert_eq!(back, s);
}
