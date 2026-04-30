use punto::timer::{Phase, Timer, TimerEvent, TimerSnapshot};

#[test]
fn starts_focus_session_from_minutes() {
    let timer = Timer::new();

    let timer = timer.start_focus(25, 5).expect("timer starts");

    assert_eq!(timer.phase(), Phase::Focus);
    assert_eq!(timer.remaining_seconds(), 25 * 60);
    assert!(timer.is_running());
}

#[test]
fn pauses_and_resumes_without_losing_remaining_time() {
    let timer = Timer::new().start_focus(25, 5).expect("timer starts");
    let timer = timer.tick(60).timer.pause().expect("timer pauses");

    assert_eq!(timer.remaining_seconds(), 24 * 60);
    assert!(!timer.is_running());

    let timer = timer.resume().expect("timer resumes");

    assert!(timer.is_running());
    assert_eq!(timer.remaining_seconds(), 24 * 60);
}

#[test]
fn focus_completion_records_event_and_switches_to_break() {
    let timer = Timer::new().start_focus(1, 5).expect("timer starts");

    let TimerEvent { timer, completed_focus_minutes } = timer.tick(60).event.expect("event");

    assert_eq!(completed_focus_minutes, Some(1));
    assert_eq!(timer.phase(), Phase::Break);
    assert_eq!(timer.remaining_seconds(), 5 * 60);
    assert!(timer.is_running());
}

#[test]
fn stop_returns_to_idle() {
    let timer = Timer::new().start_focus(25, 5).expect("timer starts");

    let timer = timer.stop();

    assert_eq!(timer.phase(), Phase::Idle);
    assert_eq!(timer.remaining_seconds(), 0);
    assert!(!timer.is_running());
}

#[test]
fn snapshot_reports_phase_running_and_remaining() {
    let timer = Timer::new().start_focus(25, 5).expect("start");
    let timer = timer.tick(45).timer;

    let snap: TimerSnapshot = timer.snapshot();

    assert_eq!(snap.phase, Phase::Focus);
    assert!(snap.running);
    assert_eq!(snap.remaining_seconds, 25 * 60 - 45);
    assert_eq!(snap.focus_minutes, 25);
    assert_eq!(snap.break_minutes, 5);
}
