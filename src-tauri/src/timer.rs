use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Phase {
    Idle,
    Focus,
    Overtime,
    Break,
}

pub fn total_focus_duration_minutes(focus_minutes: u32, overtime_seconds: u32) -> u32 {
    focus_minutes + overtime_seconds.div_ceil(60)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimerSnapshot {
    pub phase: Phase,
    pub running: bool,
    pub remaining_seconds: u32,
    pub focus_minutes: u32,
    pub break_minutes: u32,
    pub cycles_remaining: u32,
    pub auto_start_next: bool,
    pub overtime_seconds: u32,
}

/// Periodic `timer-tick` is only needed while a phase countdown is actively running.
pub fn should_emit_periodic_timer_tick(snapshot: &TimerSnapshot) -> bool {
    snapshot.phase != Phase::Idle && snapshot.running
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Timer {
    phase: Phase,
    remaining_seconds: u32,
    focus_minutes: u32,
    break_minutes: u32,
    /// Preset `cycles` value for the current session (0 when idle).
    total_cycles: u32,
    cycles_remaining: u32,
    auto_start_next: bool,
    running: bool,
    overtime_enabled: bool,
    overtime_seconds: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TickResult {
    pub timer: Timer,
    pub event: Option<TimerEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimerEvent {
    pub timer: Timer,
    pub completed_focus_minutes: Option<u32>,
    pub entered_overtime: bool,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TimerError {
    #[error("minutes must be greater than zero")]
    InvalidMinutes,
    #[error("timer is idle")]
    Idle,
    #[error("timer is already running")]
    AlreadyRunning,
    #[error("not on a break")]
    WrongPhase,
}

impl Timer {
    pub fn new() -> Self {
        Self {
            phase: Phase::Idle,
            remaining_seconds: 0,
            focus_minutes: 0,
            break_minutes: 0,
            total_cycles: 0,
            cycles_remaining: 0,
            auto_start_next: false,
            running: false,
            overtime_enabled: false,
            overtime_seconds: 0,
        }
    }

    pub fn start_focus(
        mut self,
        focus_minutes: u32,
        break_minutes: u32,
        cycles: u32,
        auto_start_next: bool,
        overtime_enabled: bool,
    ) -> Result<Self, TimerError> {
        if focus_minutes == 0 || break_minutes == 0 || cycles == 0 {
            return Err(TimerError::InvalidMinutes);
        }

        self.phase = Phase::Focus;
        self.remaining_seconds = focus_minutes * 60;
        self.focus_minutes = focus_minutes;
        self.break_minutes = break_minutes;
        self.total_cycles = cycles;
        self.cycles_remaining = cycles - 1;
        self.auto_start_next = auto_start_next;
        self.overtime_enabled = overtime_enabled;
        self.overtime_seconds = 0;
        self.running = true;
        Ok(self)
    }

    /// Updates the in-session auto-start flag. When idle, returns `self` unchanged.
    pub fn with_auto_start_next(mut self, enabled: bool) -> Self {
        if self.phase != Phase::Idle {
            self.auto_start_next = enabled;
        }
        self
    }

    /// Updates overtime tracking for the current session (Focus phase only).
    pub fn with_overtime_enabled(mut self, enabled: bool) -> Self {
        if self.phase == Phase::Focus {
            self.overtime_enabled = enabled;
        }
        self
    }

    pub fn pause(mut self) -> Result<Self, TimerError> {
        if self.phase == Phase::Idle {
            return Err(TimerError::Idle);
        }

        self.running = false;
        Ok(self)
    }

    pub fn resume(mut self) -> Result<Self, TimerError> {
        if self.phase == Phase::Idle {
            return Err(TimerError::Idle);
        }
        if self.running {
            return Err(TimerError::AlreadyRunning);
        }

        self.running = true;
        Ok(self)
    }

    pub fn stop(self) -> Self {
        Self::new()
    }

    pub fn end_overtime_start_break(mut self) -> Result<Self, TimerError> {
        if self.phase != Phase::Overtime {
            return Err(TimerError::WrongPhase);
        }
        self.phase = Phase::Break;
        self.remaining_seconds = self.break_minutes * 60;
        self.overtime_seconds = 0;
        self.running = true;
        Ok(self)
    }

    /// Ends the current break early. If another focus cycle remains (`cycles_remaining > 0`),
    /// starts that focus immediately—regardless of `auto_start_next` (that flag only affects
    /// automatic transition when the break countdown finishes).
    pub fn skip_break(mut self) -> Result<Self, TimerError> {
        if self.phase != Phase::Break {
            return Err(TimerError::WrongPhase);
        }
        if self.cycles_remaining > 0 {
            self.cycles_remaining -= 1;
            self.phase = Phase::Focus;
            self.remaining_seconds = self.focus_minutes * 60;
            self.running = true;
        } else {
            self.phase = Phase::Idle;
            self.remaining_seconds = 0;
            self.cycles_remaining = 0;
            self.auto_start_next = false;
            self.running = false;
        }
        Ok(self)
    }

    pub fn tick(mut self, elapsed_seconds: u32) -> TickResult {
        if !self.running || self.phase == Phase::Idle {
            return TickResult {
                timer: self,
                event: None,
            };
        }

        if self.phase == Phase::Overtime {
            self.overtime_seconds += elapsed_seconds;
            return TickResult {
                timer: self,
                event: None,
            };
        }

        if elapsed_seconds < self.remaining_seconds {
            self.remaining_seconds -= elapsed_seconds;
            return TickResult {
                timer: self,
                event: None,
            };
        }

        match self.phase {
            Phase::Focus => {
                if self.overtime_enabled {
                    self.phase = Phase::Overtime;
                    self.remaining_seconds = 0;
                    self.overtime_seconds = 0;
                    self.running = true;
                    TickResult {
                        timer: self.clone(),
                        event: Some(TimerEvent {
                            timer: self.clone(),
                            completed_focus_minutes: None,
                            entered_overtime: true,
                        }),
                    }
                } else {
                    self.phase = Phase::Break;
                    self.remaining_seconds = self.break_minutes * 60;
                    let event_timer = self.clone();
                    TickResult {
                        timer: self.clone(),
                        event: Some(TimerEvent {
                            timer: event_timer,
                            completed_focus_minutes: Some(self.focus_minutes),
                            entered_overtime: false,
                        }),
                    }
                }
            }
            Phase::Break => {
                if self.auto_start_next {
                    if self.cycles_remaining > 0 {
                        self.cycles_remaining -= 1;
                        self.phase = Phase::Focus;
                        self.remaining_seconds = self.focus_minutes * 60;
                        self.running = true;
                    } else if self.total_cycles == 1 {
                        self.phase = Phase::Focus;
                        self.remaining_seconds = self.focus_minutes * 60;
                        self.running = true;
                    } else {
                        self.phase = Phase::Idle;
                        self.remaining_seconds = 0;
                        self.cycles_remaining = 0;
                        self.total_cycles = 0;
                        self.auto_start_next = false;
                        self.running = false;
                    }
                } else {
                    self.phase = Phase::Idle;
                    self.remaining_seconds = 0;
                    self.cycles_remaining = 0;
                    self.total_cycles = 0;
                    self.auto_start_next = false;
                    self.running = false;
                }
                TickResult {
                    timer: self,
                    event: None,
                }
            }
            Phase::Overtime | Phase::Idle => TickResult {
                timer: self,
                event: None,
            },
        }
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    pub fn remaining_seconds(&self) -> u32 {
        self.remaining_seconds
    }

    pub fn is_running(&self) -> bool {
        self.running
    }

    pub fn snapshot(&self) -> TimerSnapshot {
        TimerSnapshot {
            phase: self.phase,
            running: self.running,
            remaining_seconds: self.remaining_seconds,
            focus_minutes: self.focus_minutes,
            break_minutes: self.break_minutes,
            cycles_remaining: self.cycles_remaining,
            auto_start_next: self.auto_start_next,
            overtime_seconds: self.overtime_seconds,
        }
    }
}

impl Default for Timer {
    fn default() -> Self {
        Self::new()
    }
}
