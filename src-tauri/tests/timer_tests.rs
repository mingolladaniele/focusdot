use focusdot::timer::{
    should_emit_periodic_timer_tick, Phase, Timer, TimerError, TimerEvent, TimerSnapshot,
};

#[test]
fn starts_focus_session_from_minutes() {
    let timer = Timer::new();

    let timer = timer.start_focus(25, 5, 1, false, false).expect("timer starts");

    assert_eq!(timer.phase(), Phase::Focus);
    assert_eq!(timer.remaining_seconds(), 25 * 60);
    assert!(timer.is_running());
}

#[test]
fn rejects_zero_cycles() {
    let err = Timer::new()
        .start_focus(25, 5, 0, false, false)
        .expect_err("zero cycles are invalid");

    assert_eq!(err, TimerError::InvalidMinutes);
}

#[test]
fn pauses_and_resumes_without_losing_remaining_time() {
    let timer = Timer::new()
        .start_focus(25, 5, 1, false, false)
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
        .start_focus(1, 5, 1, false, false)
        .expect("timer starts");

    let TimerEvent {
        timer,
        completed_focus_minutes,
        entered_overtime,
    } = timer.tick(60).event.expect("event");

    assert_eq!(completed_focus_minutes, Some(1));
    assert!(!entered_overtime);
    assert_eq!(timer.phase(), Phase::Break);
    assert_eq!(timer.remaining_seconds(), 5 * 60);
    assert!(timer.is_running());
}

#[test]
fn stop_returns_to_idle() {
    let timer = Timer::new()
        .start_focus(25, 5, 1, false, false)
        .expect("timer starts");

    let timer = timer.stop();

    assert_eq!(timer.phase(), Phase::Idle);
    assert_eq!(timer.remaining_seconds(), 0);
    assert!(!timer.is_running());
}

#[test]
fn snapshot_reports_phase_running_and_remaining() {
    let timer = Timer::new().start_focus(25, 5, 1, false, false).expect("start");
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
    let timer = Timer::new().start_focus(1, 1, 2, true, false).expect("starts");

    let after_focus = timer.tick(60); // focus completes -> break begins
    assert_eq!(after_focus.timer.phase(), Phase::Break);

    let after_break = after_focus.timer.tick(60); // break completes -> next focus begins
    assert_eq!(after_break.timer.phase(), Phase::Focus);
    assert_eq!(after_break.timer.remaining_seconds(), 60);
    assert!(after_break.timer.is_running());
}

#[test]
fn break_completion_single_cycle_auto_start_starts_next_focus() {
    let timer = Timer::new().start_focus(1, 1, 1, true, false).expect("starts");
    let after_focus = timer.tick(60);
    assert_eq!(after_focus.timer.phase(), Phase::Break);

    let after_break = after_focus.timer.tick(60);
    assert_eq!(after_break.timer.phase(), Phase::Focus);
    assert_eq!(after_break.timer.remaining_seconds(), 60);
    assert!(after_break.timer.is_running());
}

#[test]
fn break_completion_multi_cycle_auto_start_stops_after_final_break() {
    let timer = Timer::new().start_focus(1, 1, 2, true, false).expect("starts");
    let t = timer.tick(60).timer; // -> break
    let t = t.tick(60).timer; // -> focus (auto)
    let t = t.tick(60).timer; // -> break
    let t = t.tick(60).timer; // -> idle (final break, no more rounds)
    assert_eq!(t.phase(), Phase::Idle);
    assert!(!t.is_running());
}

#[test]
fn single_cycle_auto_start_repeats_more_than_once() {
    let mut t = Timer::new().start_focus(1, 1, 1, true, false).unwrap();
    for _ in 0..2 {
        t = t.tick(60).timer; // end focus -> break
        assert_eq!(t.phase(), Phase::Break);
        t = t.tick(60).timer; // end break -> focus again
        assert_eq!(t.phase(), Phase::Focus);
    }
}

#[test]
fn with_auto_start_next_changes_break_completion_without_idle_reset() {
    let timer = Timer::new().start_focus(1, 1, 1, true, false).expect("starts");
    let on_break = timer.tick(60).timer;
    assert_eq!(on_break.phase(), Phase::Break);

    let toggled_off = on_break.with_auto_start_next(false);
    let after_break = toggled_off.tick(60).timer;
    assert_eq!(after_break.phase(), Phase::Idle);
    assert!(!after_break.is_running());
}

#[test]
fn with_auto_start_next_turning_on_enables_auto_after_break() {
    let timer = Timer::new().start_focus(1, 1, 1, false, false).expect("starts");
    let on_break = timer.tick(60).timer;
    assert_eq!(on_break.phase(), Phase::Break);

    let toggled_on = on_break.with_auto_start_next(true);
    let after_break = toggled_on.tick(60).timer;
    assert_eq!(after_break.phase(), Phase::Focus);
    assert!(after_break.is_running());
}

#[test]
fn break_completion_returns_to_idle_when_auto_cycle_disabled() {
    let timer = Timer::new()
        .start_focus(1, 1, 5, false, false) // 5 cycles available but auto disabled
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
        overtime_seconds: 0,
    };
    assert!(!should_emit_periodic_timer_tick(&idle));

    let running_focus = Timer::new()
        .start_focus(25, 5, 1, false, false)
        .expect("start")
        .snapshot();
    assert!(should_emit_periodic_timer_tick(&running_focus));

    let paused_focus = Timer::new()
        .start_focus(25, 5, 1, false, false)
        .expect("start")
        .pause()
        .expect("pause")
        .snapshot();
    assert_eq!(paused_focus.phase, Phase::Focus);
    assert!(!paused_focus.running);
    assert!(!should_emit_periodic_timer_tick(&paused_focus));
}

#[test]
fn skip_break_on_idle_errors_wrong_phase() {
    let err = Timer::new().skip_break().expect_err("idle is not break");
    assert_eq!(err, TimerError::WrongPhase);
}

#[test]
fn skip_break_mid_multi_cycle_with_auto_start_goes_to_focus() {
    let timer = Timer::new().start_focus(1, 1, 2, true, false).expect("starts");
    let timer = timer.tick(60).timer; // focus completes -> break
    assert_eq!(timer.phase(), Phase::Break);

    let timer = timer.skip_break().expect("skip break");

    assert_eq!(timer.phase(), Phase::Focus);
    assert_eq!(timer.remaining_seconds(), 60);
    assert_eq!(timer.snapshot().cycles_remaining, 0);
    assert!(timer.is_running());
}

#[test]
fn skip_break_mid_multi_cycle_without_auto_start_still_goes_to_focus() {
    let timer = Timer::new().start_focus(1, 1, 2, false, false).expect("starts");
    let timer = timer.tick(60).timer;
    assert_eq!(timer.phase(), Phase::Break);

    let timer = timer.skip_break().expect("skip break");

    assert_eq!(timer.phase(), Phase::Focus);
    assert_eq!(timer.remaining_seconds(), 60);
    assert_eq!(timer.snapshot().cycles_remaining, 0);
    assert!(timer.is_running());
}

#[test]
fn skip_break_on_final_break_goes_idle() {
    let timer = Timer::new()
        .start_focus(1, 1, 1, true, false)
        .expect("starts");
    let timer = timer.tick(60).timer; // focus -> break (cycles_remaining == 0)

    let timer = timer.skip_break().expect("skip break");

    assert_eq!(timer.phase(), Phase::Idle);
    assert!(!timer.is_running());
    assert_eq!(timer.remaining_seconds(), 0);
}

#[test]
fn skip_break_while_break_paused_starts_focus_running() {
    let timer = Timer::new().start_focus(1, 1, 2, false, false).expect("starts");
    let timer = timer.tick(60).timer; // break, running
    let timer = timer.pause().expect("pause break");
    assert_eq!(timer.phase(), Phase::Break);
    assert!(!timer.is_running());

    let timer = timer.skip_break().expect("skip break");

    assert_eq!(timer.phase(), Phase::Focus);
    assert!(timer.is_running());
}

#[test]
fn total_focus_duration_includes_overtime_minutes_rounded_up() {
    assert_eq!(
        focusdot::timer::total_focus_duration_minutes(25, 0),
        25
    );
    assert_eq!(
        focusdot::timer::total_focus_duration_minutes(25, 1),
        26
    );
    assert_eq!(
        focusdot::timer::total_focus_duration_minutes(25, 60),
        26
    );
    assert_eq!(
        focusdot::timer::total_focus_duration_minutes(25, 61),
        27
    );
}

#[test]
fn focus_completion_with_overtime_enters_overtime_phase() {
    let timer = Timer::new()
        .start_focus(1, 5, 1, false, true)
        .expect("timer starts");

    let result = timer.tick(60);

    assert!(result.event.as_ref().map(|e| e.entered_overtime).unwrap_or(false));
    assert_eq!(result.event.as_ref().and_then(|e| e.completed_focus_minutes), None);
    assert_eq!(result.timer.phase(), Phase::Overtime);
    assert_eq!(result.timer.snapshot().overtime_seconds, 0);
    assert!(result.timer.is_running());
}

#[test]
fn overtime_ticks_increment_counter() {
    let timer = Timer::new()
        .start_focus(1, 5, 1, false, true)
        .expect("start");
    let timer = timer.tick(60).timer;

    let timer = timer.tick(3).timer;

    assert_eq!(timer.phase(), Phase::Overtime);
    assert_eq!(timer.snapshot().overtime_seconds, 3);
}

#[test]
fn end_overtime_start_break_transitions_to_break() {
    let timer = Timer::new()
        .start_focus(1, 5, 1, false, true)
        .expect("start");
    let timer = timer.tick(60).timer.tick(10).timer;

    let timer = timer.end_overtime_start_break().expect("end overtime");

    assert_eq!(timer.phase(), Phase::Break);
    assert_eq!(timer.remaining_seconds(), 5 * 60);
    assert_eq!(timer.snapshot().overtime_seconds, 0);
    assert!(timer.is_running());
}

#[test]
fn pauses_and_resumes_overtime_without_losing_elapsed() {
    let timer = Timer::new()
        .start_focus(1, 5, 1, false, true)
        .expect("start");
    let timer = timer.tick(60).timer.tick(30).timer;
    let timer = timer.pause().expect("pause");

    assert_eq!(timer.snapshot().overtime_seconds, 30);
    assert!(!timer.is_running());

    let timer = timer.resume().expect("resume").tick(5).timer;
    assert_eq!(timer.snapshot().overtime_seconds, 35);
}

#[test]
fn periodic_tick_emits_during_running_overtime() {
    let snap = Timer::new()
        .start_focus(1, 5, 1, false, true)
        .expect("start")
        .tick(60)
        .timer
        .snapshot();
    assert_eq!(snap.phase, Phase::Overtime);
    assert!(should_emit_periodic_timer_tick(&snap));
}

#[test]
fn with_overtime_enabled_updates_active_focus_session() {
    let timer = Timer::new()
        .start_focus(1, 5, 1, false, false)
        .expect("start");
    let timer = timer.with_overtime_enabled(true);
    let result = timer.tick(60);
    assert_eq!(result.timer.phase(), Phase::Overtime);
}

#[test]
fn end_overtime_start_break_errors_when_not_overtime() {
    let err = Timer::new()
        .start_focus(1, 5, 1, false, false)
        .expect("start")
        .end_overtime_start_break()
        .expect_err("not overtime");
    assert_eq!(err, TimerError::WrongPhase);
}
