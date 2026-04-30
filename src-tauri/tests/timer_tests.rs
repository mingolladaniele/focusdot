use focusdot::timer::{
    should_emit_periodic_timer_tick, Phase, Timer, TimerError, TimerEvent, TimerSnapshot,
};

#[test]
fn starts_focus_session_from_minutes() {
    let timer = Timer::new();

    let timer = timer.start_focus(25, 5, 1, false).expect("timer starts");

    assert_eq!(timer.phase(), Phase::Focus);
    assert_eq!(timer.remaining_seconds(), 25 * 60);
    assert!(timer.is_running());
}

#[test]
fn rejects_zero_cycles() {
    let err = Timer::new()
        .start_focus(25, 5, 0, false)
        .expect_err("zero cycles are invalid");

    assert_eq!(err, TimerError::InvalidMinutes);
}

#[test]
fn pauses_and_resumes_without_losing_remaining_time() {
    let timer = Timer::new()
        .start_focus(25, 5, 1, false)
        .expect("timer starts");
    let timer = timer.tick(60).timer.pause().expect("timer pauses");

    assert_eq!(timer.remaining_seconds(), 24 * 60);
    assert!(!timer.is_running());

    let timer = timer.resume().expect("timer resumes");

    assert!(timer.is_running());
    assert_eq!(timer.remaining_seconds(), 24 * 60);
}

#[test]
fn focus_completion_records_event_and_switches_to_break() {
    let timer = Timer::new()
        .start_focus(1, 5, 1, false)
        .expect("timer starts");

    let TimerEvent {
        timer,
        completed_focus_minutes,
    } = timer.tick(60).event.expect("event");

    assert_eq!(completed_focus_minutes, Some(1));
    assert_eq!(timer.phase(), Phase::Break);
    assert_eq!(timer.remaining_seconds(), 5 * 60);
    assert!(timer.is_running());
}

#[test]
fn stop_returns_to_idle() {
    let timer = Timer::new()
        .start_focus(25, 5, 1, false)
        .expect("timer starts");

    let timer = timer.stop();

    assert_eq!(timer.phase(), Phase::Idle);
    assert_eq!(timer.remaining_seconds(), 0);
    assert!(!timer.is_running());
}

#[test]
fn snapshot_reports_phase_running_and_remaining() {
    let timer = Timer::new().start_focus(25, 5, 1, false).expect("start");
    let timer = timer.tick(45).timer;

    let snap: TimerSnapshot = timer.snapshot();

    assert_eq!(snap.phase, Phase::Focus);
    assert!(snap.running);
    assert_eq!(snap.remaining_seconds, 25 * 60 - 45);
    assert_eq!(snap.focus_minutes, 25);
    assert_eq!(snap.break_minutes, 5);
    assert_eq!(snap.cycles_remaining, 0);
    assert!(!snap.auto_start_next);
}

#[test]
fn break_completion_starts_next_focus_when_auto_cycle_enabled() {
    // 2 cycles, auto-start next: focus(1) -> break(1) -> focus(1) -> break(1) -> idle.
    let timer = Timer::new().start_focus(1, 1, 2, true).expect("starts");

    let after_focus = timer.tick(60); // focus completes -> break begins
    assert_eq!(after_focus.timer.phase(), Phase::Break);

    let after_break = after_focus.timer.tick(60); // break completes -> next focus begins
    assert_eq!(after_break.timer.phase(), Phase::Focus);
    assert_eq!(after_break.timer.remaining_seconds(), 60);
    assert!(after_break.timer.is_running());
}

#[test]
fn break_completion_returns_to_idle_after_last_cycle() {
    let timer = Timer::new()
        .start_focus(1, 1, 1, true) // 1 cycle only
        .expect("starts");
    let timer = timer.tick(60).timer; // focus -> break
    let timer = timer.tick(60).timer; // break -> idle (no more cycles)
    assert_eq!(timer.phase(), Phase::Idle);
    assert!(!timer.is_running());
}

#[test]
fn break_completion_returns_to_idle_when_auto_cycle_disabled() {
    let timer = Timer::new()
        .start_focus(1, 1, 5, false) // 5 cycles available but auto disabled
        .expect("starts");
    let timer = timer.tick(60).timer;
    let timer = timer.tick(60).timer;
    assert_eq!(timer.phase(), Phase::Idle);
}

#[test]
fn periodic_tick_emits_only_when_not_idle_and_running() {
    let idle = TimerSnapshot {
        phase: Phase::Idle,
        running: false,
        remaining_seconds: 0,
        focus_minutes: 0,
        break_minutes: 0,
        cycles_remaining: 0,
        auto_start_next: false,
    };
    assert!(!should_emit_periodic_timer_tick(&idle));

    let running_focus = Timer::new()
        .start_focus(25, 5, 1, false)
        .expect("start")
        .snapshot();
    assert!(should_emit_periodic_timer_tick(&running_focus));

    let paused_focus = Timer::new()
        .start_focus(25, 5, 1, false)
        .expect("start")
        .pause()
        .expect("pause")
        .snapshot();
    assert_eq!(paused_focus.phase, Phase::Focus);
    assert!(!paused_focus.running);
    assert!(!should_emit_periodic_timer_tick(&paused_focus));
}
