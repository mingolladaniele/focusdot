# Punto Cycles + UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-cycle Pomodoro sessions with optional auto-resume after break, granular daily stats, motivational notifications, a circular tray icon, taskbar-hidden minimize, settings entry from the right-click menu, and a project README.

**Architecture:** Extend `Timer` with an optional repeat count + auto-start-next flag stored on `Preset`. The timer loop, when a Break completes and the preset is set to repeat, starts the next Focus instead of going Idle. Notifications get short, Duolingo-style motivational copy with stats injected (focus minutes today, sessions today). On Windows, native notification click handlers are unreliable — Punto compensates by raising the dashboard window automatically when the focus timer completes (functionally equivalent to "click to open settings"). The tray icon is replaced with a small circular RGBA icon (white outline + grey fill in idle, full green fill in active). Window minimize is intercepted and converted to hide, removing the dashboard from the taskbar; `WS_EX_TOOLWINDOW` is not needed because the window starts hidden and only opens on user request.

**Tech Stack:** Rust (Tauri v2, `image::Image` raw RGBA, `WindowEvent::Resized`/`Focused` interception), TypeScript, vanilla CSS, Vitest.

---

## Priority and Dependencies

Execute in this order. Priority reflects user impact + unblock potential.

| # | Task | Priority | Depends on | Why |
|---|------|----------|------------|-----|
| 1 | Multi-cycle preset model (`cycles`, `auto_start_next`) | P0 | — | Foundation; downstream tray/notify/UI all read these fields |
| 2 | Timer auto-cycle in tick loop | P0 | 1 | Core behavior the user asked for (auto-start after break) |
| 3 | Granular daily stats (focus min today, sessions today, streak) | P0 | — | Independent; surfaces motivation in UI + notification |
| 4 | Motivational notifications (Duolingo-style copy) | P0 | 3 | Replaces bland strings; needs stats to inject numbers |
| 5 | Auto-show dashboard on focus complete (notification fallback) | P1 | 4 | Compensates for missing notification onclick on Windows |
| 6 | Right-click tray "Settings" entry | P1 | — | Independent; one menu item + handler |
| 7 | Circular white/green tray icon | P1 | — | Independent; pure rendering change |
| 8 | Minimize hides window from taskbar | P1 | — | Independent; window event interception |
| 9 | Settings UI: cycles input, auto-start toggle, granular stats | P1 | 1, 3 | Surfaces P0 work to the user |
| 10 | README.md | P2 | — | Standalone documentation; placeholder for icon |
| 11 | Final verify + new MSI | P0 | 1–9 | Ship gate |

P0 = ship-blocking; P1 = ship-blocking polish; P2 = documentation, ships in same MSI.

---

## AI Agent Workflow (MANDATORY)

These rules apply to every subagent and inline executor working on this codebase. They override convenience.

**Before writing any code in a task:**
1. Read the task fully. Read the spec section it implements.
2. Run the existing suite to confirm a clean baseline:
   ```powershell
   npm test
   ```
   If the baseline is broken, stop and report — do not start the task.

**While implementing:**
3. TDD: write the failing test first, run it, see it fail with the expected message, then implement.
4. Keep edits scoped to the task's `Files:` list. If you touch others, justify it in the commit message.
5. No `unwrap()` in non-test code unless commented; prefer `?` + `String` errors for Tauri commands.

**Before committing — verification gate (no exceptions):**
6. Run, in order, and require each to be green:
   ```powershell
   npm run typecheck
   npm run test:frontend
   npm run test:rust
   npm run build:prod
   ```
   `build:prod` runs `tsc && vite build --mode production` and emits the **production** frontend bundle under `dist/`. Do **not** substitute `npm run dev`, bare `vite`, or `npm run tauri dev` for this step — those are development-only and do not satisfy the gate.
7. For tasks that touch Rust (`src-tauri/**`), additionally run:
   ```powershell
   npm run build:installer
   ```
   This invokes **release** `tauri build` (via `scripts/run-tauri.ps1`; no dev profile). The MSI must finish (`Finished 1 bundle at ...`). If `cargo` is missing, the wrapper script `scripts/run-tauri.ps1` must be used (it sets PATH); never edit machine-wide environment.
8. If verification fails: do **not** commit. Fix forward in the same task or revert the working tree (`git restore .`).

**Commit hygiene:**
9. One conceptual change per commit. Use the task's commit command verbatim.
10. Never commit secrets, `.env`, `node_modules/`, `src-tauri/target/`, MSI bundles, or generated icons not already tracked.
11. Never `--force` push. Never edit `.git/config`.

**Reporting back (subagents):**
12. End status is one of `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`. Include the exact verification commands you ran and their tail output.
13. If you changed a public type (Rust struct, TS interface, Tauri command name), call it out — downstream tasks may need adjustment.

**Safety:**
14. No system-wide installs (no `winget install`, no global npm packages, no PATH edits in user profile). Project-local only.
15. Do not delete the user's data dir (`%AppData%\Punto\`); tests use `assert_fs::TempDir` exclusively.

---

## File Structure

- Modify `src-tauri/src/presets.rs`: add `cycles: u32` (1 = single, N = repeat N focus+break pairs) and `auto_start_next: bool` to `Preset` and `PresetInput`. Default cycles=1, auto_start_next=false. Backward compatible deserialization (use `#[serde(default)]`).
- Modify `src-tauri/src/timer.rs`: add `cycles_remaining: u32` and `auto_start_next: bool` to `Timer`; extend `start_focus` signature to accept these; `tick` on Break-completion either starts a new Focus (if `cycles_remaining > 0` AND `auto_start_next`) or returns to Idle.
- Modify `src-tauri/src/stats.rs`: extend `Stats` with `focus_minutes_today: u32` and `current_streak_days: u32`; add corresponding test cases.
- Modify `src-tauri/src/notifications.rs`: rewrite copy with emoji + stats; pick from a small fixed pool with deterministic rotation (seed = sessions_today). Title ≤ 30 chars, body ≤ 90 chars.
- Modify `src-tauri/src/tray.rs`: add `Settings` menu item that opens the dashboard; replace `rgba_icon` with `circular_icon` (32×32, anti-aliased disk).
- Modify `src-tauri/src/lib.rs`: pass new preset fields to `Timer::start_focus`; on focus-completion, show + focus the main window; intercept `WindowEvent::Resized` to detect minimize and hide instead.
- Modify `src-tauri/capabilities/default.json`: add `core:window:allow-unminimize` (needed because we restore from minimized state programmatically).
- Modify `src/main.ts`: render `cycles` + `auto_start_next` in preset list, add inputs to preset form, render `focus_minutes_today` + `current_streak_days` in stats card.
- Modify `index.html`: add the two preset form fields and two stats rows (no separate file).
- Modify `src/main.test.ts`: cover preset form parsing of cycles, stats rendering of new fields, snapshot rendering with cycles indicator.
- Modify `src/presets.ts`: parse cycles + auto_start_next from form; default cycles=1.
- Modify `src/stats.ts`: add formatters `formatFocusMinutesToday`, `formatStreakDays`.
- Create `README.md` at repo root.

---

### Task 1: Multi-Cycle Preset Model

**Files:**
- Modify: `src-tauri/src/presets.rs`
- Modify: `src-tauri/tests/presets_tests.rs`

- [x] **Step 1: Write the failing test for cycles + auto_start_next**

Append to `src-tauri/tests/presets_tests.rs`:

```rust
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
    // Decoding a JSON without the new fields must succeed and default sensibly.
    let raw = r#"{"presets":[{"id":"00000000-0000-0000-0000-000000000001","name":"Old","focusMinutes":25,"breakMinutes":5}]}"#;
    let store: PresetStore = serde_json::from_str(raw).expect("decodes legacy presets");
    let p = &store.all()[0];
    assert_eq!(p.cycles, 1);
    assert!(!p.auto_start_next);
}
```

- [x] **Step 2: Run test to confirm it fails**

```powershell
npm run test:rust -- presets_tests
```

Expected: compile error (`PresetInput` missing fields) or assertion failure.

- [x] **Step 3: Update `Preset` and `PresetInput`**

In `src-tauri/src/presets.rs`, change `Preset` and `PresetInput` to include the two fields with `#[serde(default = "...")]` defaults. Add helpers `default_cycles() -> u32 { 1 }` and `default_auto_start_next() -> bool { false }`. Also update validation: `cycles >= 1`. Replace the relevant struct definitions with:

```rust
fn default_cycles() -> u32 { 1 }
fn default_auto_start_next() -> bool { false }

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: Uuid,
    pub name: String,
    pub focus_minutes: u32,
    pub break_minutes: u32,
    #[serde(default = "default_cycles")]
    pub cycles: u32,
    #[serde(default = "default_auto_start_next")]
    pub auto_start_next: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetInput {
    pub name: String,
    pub focus_minutes: u32,
    pub break_minutes: u32,
    #[serde(default = "default_cycles")]
    pub cycles: u32,
    #[serde(default = "default_auto_start_next")]
    pub auto_start_next: bool,
}
```

In the `add` method, validate `cycles >= 1` (return `PresetError::InvalidCycles` — add this variant — when 0). Construct `Preset` from `PresetInput` carrying through the new fields. Update existing tests in `presets_tests.rs` that build `PresetInput` literals to include `cycles: 1, auto_start_next: false`.

- [x] **Step 4: Run all preset tests**

```powershell
npm run test:rust -- presets_tests
```

Expected: `test result: ok. 5 passed` (3 existing + 2 new).

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/presets.rs src-tauri/tests/presets_tests.rs
git commit -m "feat: add cycles and auto_start_next to presets"
```

---

### Task 2: Timer Auto-Cycle in Tick Loop

**Files:**
- Modify: `src-tauri/src/timer.rs`
- Modify: `src-tauri/tests/timer_tests.rs`
- Modify: `src-tauri/src/lib.rs` (call site only)
- Modify: `src-tauri/src/tray.rs` (call site only)

- [x] **Step 1: Write the failing tests**

Append to `src-tauri/tests/timer_tests.rs`:

```rust
#[test]
fn break_completion_starts_next_focus_when_auto_cycle_enabled() {
    // 2 cycles, auto-start next: focus(1) -> break(1) -> focus(1) -> break(1) -> idle.
    let timer = Timer::new()
        .start_focus(1, 1, 2, true)
        .expect("starts");

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
```

Update existing `start_focus(25, 5)` calls in this file to `start_focus(25, 5, 1, false)`.

- [x] **Step 2: Run tests, confirm failures**

```powershell
npm run test:rust -- timer_tests
```

Expected: compile error — `start_focus` takes 4 args.

- [x] **Step 3: Extend `Timer` and `start_focus`**

Edit `src-tauri/src/timer.rs`. Change `Timer` struct:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Timer {
    phase: Phase,
    remaining_seconds: u32,
    focus_minutes: u32,
    break_minutes: u32,
    running: bool,
    cycles_remaining: u32,
    auto_start_next: bool,
}
```

Add the two fields to `Self::new()` (both `0` / `false`). Extend `start_focus`:

```rust
pub fn start_focus(
    mut self,
    focus_minutes: u32,
    break_minutes: u32,
    cycles: u32,
    auto_start_next: bool,
) -> Result<Self, TimerError> {
    if focus_minutes == 0 || break_minutes == 0 {
        return Err(TimerError::InvalidMinutes);
    }
    if cycles == 0 {
        return Err(TimerError::InvalidMinutes);
    }
    self.phase = Phase::Focus;
    self.remaining_seconds = focus_minutes * 60;
    self.focus_minutes = focus_minutes;
    self.break_minutes = break_minutes;
    self.cycles_remaining = cycles - 1; // we are entering cycle 1, N-1 left after this one
    self.auto_start_next = auto_start_next;
    self.running = true;
    Ok(self)
}
```

Update `tick` Break→Idle branch:

```rust
Phase::Break => {
    if self.cycles_remaining > 0 && self.auto_start_next {
        self.cycles_remaining -= 1;
        self.phase = Phase::Focus;
        self.remaining_seconds = self.focus_minutes * 60;
        self.running = true;
        TickResult { timer: self, event: None }
    } else {
        self.phase = Phase::Idle;
        self.remaining_seconds = 0;
        self.running = false;
        self.cycles_remaining = 0;
        self.auto_start_next = false;
        TickResult { timer: self, event: None }
    }
}
```

Add `TimerSnapshot.cycles_remaining: u32` and `auto_start_next: bool`, populated from the timer in `snapshot()`. Update the snapshot test to include the new fields (assert `cycles_remaining == 0` for a single-cycle session).

- [x] **Step 4: Update call sites**

In `src-tauri/src/lib.rs`, find every `start_focus(...)` call (in `start_preset`) and pass `preset.cycles, preset.auto_start_next`. In `src-tauri/src/tray.rs`, the preset-launch branch in `handle_menu_event` does the same.

- [x] **Step 5: Run full Rust tests**

```powershell
npm run test:rust
```

Expected: `test result: ok. 8 passed` in `timer_tests` (5 existing + 3 new).

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/timer.rs src-tauri/tests/timer_tests.rs src-tauri/src/lib.rs src-tauri/src/tray.rs
git commit -m "feat: auto-start next focus after break when preset cycles >1"
```

---

### Task 3: Granular Daily Stats

**Files:**
- Modify: `src-tauri/src/stats.rs`
- Modify: `src-tauri/tests/history_stats_tests.rs`

- [x] **Step 1: Write failing tests**

Append to `src-tauri/tests/history_stats_tests.rs`:

```rust
#[test]
fn calculates_focus_minutes_today() {
    use chrono::TimeZone;
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 12, 0, 0).unwrap();
    let history = History {
        sessions: vec![
            FocusSession { started_at: now, duration_minutes: 25 },
            FocusSession { started_at: now - chrono::Duration::hours(2), duration_minutes: 50 },
            FocusSession { started_at: now - chrono::Duration::days(1), duration_minutes: 25 },
        ],
    };
    let stats = calculate_stats(&history, now);
    assert_eq!(stats.focus_minutes_today, 75);
    assert_eq!(stats.sessions_today, 2);
}

#[test]
fn calculates_streak_days() {
    use chrono::TimeZone;
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 12, 0, 0).unwrap();
    let history = History {
        sessions: vec![
            FocusSession { started_at: now, duration_minutes: 25 },
            FocusSession { started_at: now - chrono::Duration::days(1), duration_minutes: 25 },
            FocusSession { started_at: now - chrono::Duration::days(2), duration_minutes: 25 },
            // Gap: no session 3 days ago.
            FocusSession { started_at: now - chrono::Duration::days(4), duration_minutes: 25 },
        ],
    };
    let stats = calculate_stats(&history, now);
    assert_eq!(stats.current_streak_days, 3);
}

#[test]
fn streak_is_zero_when_no_session_today() {
    use chrono::TimeZone;
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 12, 0, 0).unwrap();
    let history = History {
        sessions: vec![
            FocusSession {
                started_at: now - chrono::Duration::days(1),
                duration_minutes: 25,
            },
        ],
    };
    let stats = calculate_stats(&history, now);
    assert_eq!(stats.current_streak_days, 0);
}
```

- [x] **Step 2: Run, confirm failure**

```powershell
npm run test:rust -- history_stats_tests
```

Expected: compile error (`focus_minutes_today` missing from `Stats`).

- [x] **Step 3: Extend `Stats` and `calculate_stats`**

Edit `src-tauri/src/stats.rs`:

```rust
use std::collections::HashSet;

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::history::History;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub sessions_today: usize,
    pub focus_minutes_today: u32,
    pub focus_minutes_this_week: u32,
    pub current_streak_days: u32,
}

pub fn calculate_stats(history: &History, now: DateTime<Utc>) -> Stats {
    let today: NaiveDate = now.date_naive();
    let current_week = now.iso_week();

    let sessions_today = history
        .sessions
        .iter()
        .filter(|s| s.started_at.date_naive() == today)
        .count();

    let focus_minutes_today: u32 = history
        .sessions
        .iter()
        .filter(|s| s.started_at.date_naive() == today)
        .map(|s| s.duration_minutes)
        .sum();

    let focus_minutes_this_week: u32 = history
        .sessions
        .iter()
        .filter(|s| s.started_at.iso_week() == current_week)
        .map(|s| s.duration_minutes)
        .sum();

    let session_dates: HashSet<NaiveDate> = history
        .sessions
        .iter()
        .map(|s| s.started_at.date_naive())
        .collect();

    let mut current_streak_days = 0u32;
    let mut cursor = today;
    while session_dates.contains(&cursor) {
        current_streak_days += 1;
        cursor = match cursor.checked_sub_signed(Duration::days(1)) {
            Some(d) => d,
            None => break,
        };
    }

    Stats {
        sessions_today,
        focus_minutes_today,
        focus_minutes_this_week,
        current_streak_days,
    }
}
```

Note `serde(rename_all = "camelCase")` so the JSON keys become `sessionsToday`, `focusMinutesToday`, etc. **This is a breaking change for the frontend** — the existing `get_stats` consumer uses `sessions_today` / `focus_minutes_this_week`. Update `src/main.ts` in the same task: rename the type fields to camelCase.

In `src/main.ts`, change `StatsResponse`:

```ts
type StatsResponse = {
  sessionsToday: number;
  focusMinutesToday: number;
  focusMinutesThisWeek: number;
  currentStreakDays: number;
};
```

…and update every field access (`stats.sessions_today` → `stats.sessionsToday`, etc.). Existing test in `src/main.test.ts` uses snake_case keys; rewrite the mock response in those tests too:

```ts
return Promise.resolve({
  sessionsToday: 2,
  focusMinutesToday: 50,
  focusMinutesThisWeek: 80,
  currentStreakDays: 3,
});
```

- [x] **Step 4: Run all tests**

```powershell
npm test
```

Expected: 8 frontend + 6 history_stats Rust tests pass (3 existing + 3 new).

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/stats.rs src-tauri/tests/history_stats_tests.rs src/main.ts src/main.test.ts
git commit -m "feat: granular daily stats with streak"
```

---

### Task 4: Motivational Notifications (Duolingo-Style)

**Files:**
- Modify: `src-tauri/src/notifications.rs`
- Modify: `src-tauri/src/lib.rs` (pass `Stats` into notify functions)
- Modify: `src-tauri/tests/notifications_tests.rs` (create file)

**Voice rules:** ≤ 30-char title, ≤ 90-char body, exactly one emoji per message, second-person ("you"), short verb-led sentences. Reference user-specific numbers (focus minutes today, sessions today). Rotate copy deterministically by `sessions_today % POOL.len()` so the same session count always produces the same message (testable).

- [x] **Step 1: Write the failing tests**

Create `src-tauri/tests/notifications_tests.rs`:

```rust
use punto::notifications::{
    focus_complete_message, break_complete_message, NotificationCopy,
};
use punto::stats::Stats;

fn stats(sessions_today: usize, minutes_today: u32, streak: u32) -> Stats {
    Stats {
        sessions_today,
        focus_minutes_today: minutes_today,
        focus_minutes_this_week: minutes_today,
        current_streak_days: streak,
    }
}

#[test]
fn focus_message_is_short_and_personalised() {
    let m: NotificationCopy = focus_complete_message(&stats(1, 25, 1), 5);
    assert!(m.title.chars().count() <= 30, "title too long: {:?}", m.title);
    assert!(m.body.chars().count() <= 90, "body too long: {:?}", m.body);
    assert!(m.body.contains("25"), "expected minutes injected: {:?}", m.body);
    assert!(m.body.contains("5"), "expected break minutes injected: {:?}", m.body);
}

#[test]
fn focus_message_rotates_by_sessions_today() {
    let a = focus_complete_message(&stats(1, 25, 0), 5);
    let b = focus_complete_message(&stats(2, 50, 0), 5);
    let c = focus_complete_message(&stats(1, 25, 0), 5);
    assert_eq!(a.body, c.body, "same sessions_today -> same body");
    assert_ne!(a.body, b.body, "different sessions_today -> different body");
}

#[test]
fn break_message_motivates_to_resume() {
    let m = break_complete_message(&stats(2, 50, 3));
    assert!(m.title.chars().count() <= 30);
    assert!(m.body.chars().count() <= 90);
    assert!(m.body.contains("3") || m.body.contains("50"), "expected stats injected");
}
```

- [x] **Step 2: Run, confirm failure**

```powershell
npm run test:rust -- notifications_tests
```

Expected: `unresolved import` for the new functions/types.

- [x] **Step 3: Implement copy functions**

Replace `src-tauri/src/notifications.rs` entirely with:

```rust
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::stats::Stats;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NotificationCopy {
    pub title: String,
    pub body: String,
}

const FOCUS_TEMPLATES: &[(&str, &str)] = &[
    ("Focus done 🎯",       "{minutes_today} min focused today. {break_minutes} min break — earned it."),
    ("Nice work 💪",        "Session #{sessions_today} done. Step away for {break_minutes} min."),
    ("Streak alive 🔥",     "{minutes_today} min today. Take {break_minutes}, then back at it."),
    ("Boom 🚀",             "Another one in the bag. {break_minutes} min off — see you soon."),
];

const BREAK_TEMPLATES: &[(&str, &str)] = &[
    ("Break over ☕",       "Ready when you are. {minutes_today} min today."),
    ("Back to it 🎯",       "{sessions_today} sessions done today. One more?"),
    ("Let's go 💥",         "Streak: {streak} day(s). Don't break it."),
    ("Eyes up 👀",          "Quick start, easy win. You've got this."),
];

fn render(template: (&str, &str), stats: &Stats, break_minutes: u32) -> NotificationCopy {
    let (title, body) = template;
    let body = body
        .replace("{minutes_today}", &stats.focus_minutes_today.to_string())
        .replace("{sessions_today}", &stats.sessions_today.to_string())
        .replace("{streak}", &stats.current_streak_days.to_string())
        .replace("{break_minutes}", &break_minutes.to_string());
    NotificationCopy { title: title.to_string(), body }
}

pub fn focus_complete_message(stats: &Stats, break_minutes: u32) -> NotificationCopy {
    let idx = (stats.sessions_today.saturating_sub(1)) % FOCUS_TEMPLATES.len();
    render(FOCUS_TEMPLATES[idx], stats, break_minutes)
}

pub fn break_complete_message(stats: &Stats) -> NotificationCopy {
    let idx = stats.sessions_today % BREAK_TEMPLATES.len();
    render(BREAK_TEMPLATES[idx], stats, 0)
}

pub fn notify_focus_complete(
    app: &AppHandle,
    stats: &Stats,
    break_minutes: u32,
) -> Result<(), String> {
    let copy = focus_complete_message(stats, break_minutes);
    app.notification()
        .builder()
        .title(copy.title)
        .body(copy.body)
        .show()
        .map_err(|e| e.to_string())
}

pub fn notify_break_complete(app: &AppHandle, stats: &Stats) -> Result<(), String> {
    let copy = break_complete_message(stats);
    app.notification()
        .builder()
        .title(copy.title)
        .body(copy.body)
        .show()
        .map_err(|e| e.to_string())
}
```

Make `notifications` and `stats` `pub mod` in `src-tauri/src/lib.rs` (already `pub`). Re-export `NotificationCopy` from the module (it is `pub` by being declared `pub`).

In `src-tauri/src/lib.rs`, update the call sites in `spawn_timer_loop`:
- After `save_json(&core.history_path, &core.history)`, compute `let stats = crate::stats::calculate_stats(&core.history, Utc::now());` BEFORE `drop(core)`. Pass `&stats` to `notify_focus_complete`.
- For the `notify_break_complete` branch, similarly compute `stats` from the locked history before dropping `core`.

(The cycles auto-restart from Task 2 happens BEFORE we reach the focus-complete event delivery; the event still fires once per focus completion, so notifications fire whether or not auto-cycle takes over.)

- [x] **Step 4: Run tests**

```powershell
npm run test:rust
```

Expected: `notifications_tests` 3 passed; total Rust suite green.

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/notifications.rs src-tauri/src/lib.rs src-tauri/tests/notifications_tests.rs
git commit -m "feat: motivational duolingo-style notifications with stats"
```

---

### Task 5: Auto-Show Dashboard on Focus Complete

> **Why this exists:** Tauri 2's notification plugin does not expose a click handler on Windows — `notify-rust` (the underlying crate) lacks support. The user requirement "click notification → settings" is approximated by automatically showing the dashboard window when the focus session completes. The dashboard then shows the up-to-date timer + stats, which is the same destination the user would land on by clicking.

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [x] **Step 1: Add the show-and-focus call**

In `spawn_timer_loop`, immediately AFTER `let _ = notify_focus_complete(&app, &stats, bm);`, add:

```rust
if let Some(w) = app.get_webview_window("main") {
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
}
```

(Do NOT add this for `notify_break_complete` — bringing the window forward during a focus session would interrupt deep work, which is the opposite of what the user wants.)

- [x] **Step 2: Add capability**

Edit `src-tauri/capabilities/default.json` so `permissions` contains:

```json
"core:default",
"core:window:allow-show",
"core:window:allow-set-focus",
"core:window:allow-hide",
"core:window:allow-unminimize",
"notification:default",
"autostart:default"
```

- [x] **Step 3: Compile**

```powershell
npm run test:rust
npm run build
```

Expected: green.

- [x] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: auto-show dashboard on focus complete (notification fallback)"
```

---

### Task 6: Right-Click Tray "Settings" Entry

**Files:**
- Modify: `src-tauri/src/tray.rs`

- [x] **Step 1: Add a `Settings` menu item before the separator**

In `build_root_menu`, after the per-phase Pause/Resume/Stop block and **before** the separator push, add:

```rust
let settings = MenuItem::with_id(handle, "settings", "Settings…", true, None::<&str>)?;
items.push(Box::new(settings));
```

- [x] **Step 2: Handle the event**

In `handle_menu_event`, add a match arm before `"exit"`:

```rust
"settings" => {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}
```

- [x] **Step 3: Compile + test**

```powershell
npm run test:rust
```

Expected: green.

- [x] **Step 4: Commit**

```bash
git add src-tauri/src/tray.rs
git commit -m "feat: tray menu Settings entry opens dashboard"
```

---

### Task 7: Circular White/Green Tray Icon

**Files:**
- Modify: `src-tauri/src/tray.rs`

- [x] **Step 1: Replace `rgba_icon` with a circular renderer**

Replace `rgba_icon` and `icon_for_phase` in `src-tauri/src/tray.rs` with:

```rust
const ICON_SIZE: u32 = 32;

/// Render a 32×32 RGBA disk. `fill` is the inner colour; the disk is
/// anti-aliased at the edge (1 px feather). Outside the disk: transparent.
fn circular_icon(fill: (u8, u8, u8)) -> Image<'static> {
    let size = ICON_SIZE as i32;
    let radius = (size / 2) as f32 - 1.0;
    let centre = (size as f32 - 1.0) / 2.0;
    let mut buf = vec![0u8; (size * size * 4) as usize];
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - centre;
            let dy = y as f32 - centre;
            let dist = (dx * dx + dy * dy).sqrt();
            let alpha = if dist <= radius - 1.0 {
                255.0
            } else if dist <= radius {
                255.0 * (radius - dist).max(0.0)
            } else {
                0.0
            };
            let i = ((y * size + x) * 4) as usize;
            buf[i] = fill.0;
            buf[i + 1] = fill.1;
            buf[i + 2] = fill.2;
            buf[i + 3] = alpha as u8;
        }
    }
    Image::new_owned(buf, ICON_SIZE, ICON_SIZE)
}

pub fn icon_for_phase(phase: Phase) -> Image<'static> {
    match phase {
        Phase::Idle => circular_icon((255, 255, 255)),  // white = idle
        Phase::Focus => circular_icon((43, 182, 115)),  // green = focus active
        Phase::Break => circular_icon((74, 144, 226)),  // blue = break (kept for clarity)
    }
}
```

The user requested "white circle becomes green when timer is active". Idle = white. Focus = green. Break stays blue (still an active state but visually distinct, so you know whether to come back yet). If reviewer pushes back on Break colour, reduce to white-or-green only — but the third state genuinely helps distinguish "stay away" (focus) from "come back soon" (break).

- [x] **Step 2: Compile**

```powershell
npm run test:rust
npm run build
```

- [x] **Step 3: Commit**

```bash
git add src-tauri/src/tray.rs
git commit -m "feat: circular tray icon (white=idle, green=focus, blue=break)"
```

---

### Task 8: Minimize Hides Window from Taskbar

**Files:**
- Modify: `src-tauri/src/lib.rs`

The dashboard already starts hidden and only opens on tray click. The remaining gap: when the user clicks the system minimize button, Windows leaves the icon in the taskbar. We intercept the resize event, detect the minimized state, and call `hide()` instead.

- [x] **Step 1: Extend the `app.run` handler**

Replace the existing `app.run(...)` block in `pub fn run()` with:

```rust
app.run(|handle, event| {
    if let tauri::RunEvent::WindowEvent { label, event: win_event, .. } = event {
        if label == "main" {
            match win_event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    if let Some(w) = handle.get_webview_window("main") {
                        let _ = w.hide();
                    }
                }
                tauri::WindowEvent::Resized(_) => {
                    if let Some(w) = handle.get_webview_window("main") {
                        if w.is_minimized().unwrap_or(false) {
                            let _ = w.unminimize();
                            let _ = w.hide();
                        }
                    }
                }
                _ => {}
            }
        }
    }
});
```

The `unminimize()` before `hide()` is required: hiding a minimized window leaves it in a zombie state where the next `show()` keeps it minimized.

- [x] **Step 2: Allow the new permission**

Edit `src-tauri/capabilities/default.json`. Ensure permissions include:
- `core:window:allow-is-minimized`
- `core:window:allow-unminimize`
- `core:window:allow-minimize` (defensive: needed if the user later wants to programmatically minimize)

If the file does not yet have them, add them as additional strings in the `permissions` array.

- [x] **Step 3: Compile + test**

```powershell
npm run test:rust
npm run build
```

- [x] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: minimize hides dashboard from taskbar"
```

---

### Task 9: Settings UI — Cycles, Auto-Start Toggle, Granular Stats

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/main.test.ts`
- Modify: `src/presets.ts`
- Modify: `src/presets.test.ts`
- Modify: `src/stats.ts`
- Modify: `src/stats.test.ts`

- [x] **Step 1: Failing test for parsePresetForm cycles**

Add to `src/presets.test.ts`:

```ts
it("parses cycles and auto_start_next from form", () => {
  const fd = new FormData();
  fd.set("name", "Long focus");
  fd.set("focusMinutes", "25");
  fd.set("breakMinutes", "5");
  fd.set("cycles", "4");
  fd.set("autoStartNext", "on");
  const result = parsePresetForm(fd);
  expect(result).toEqual({
    ok: true,
    value: {
      name: "Long focus",
      focusMinutes: 25,
      breakMinutes: 5,
      cycles: 4,
      autoStartNext: true,
    },
  });
});

it("defaults cycles to 1 and autoStartNext to false when fields absent", () => {
  const fd = new FormData();
  fd.set("name", "Simple");
  fd.set("focusMinutes", "25");
  fd.set("breakMinutes", "5");
  const result = parsePresetForm(fd);
  expect(result.ok && result.value.cycles).toBe(1);
  expect(result.ok && result.value.autoStartNext).toBe(false);
});
```

- [x] **Step 2: Failing test for new stats formatters**

Add to `src/stats.test.ts`:

```ts
import { formatFocusMinutesToday, formatStreakDays } from "./stats";

it("formats focus minutes today", () => {
  expect(formatFocusMinutesToday(0)).toBe("0m today");
  expect(formatFocusMinutesToday(45)).toBe("45m today");
  expect(formatFocusMinutesToday(125)).toBe("2h 5m today");
});

it("formats streak with day suffix", () => {
  expect(formatStreakDays(0)).toBe("No streak yet");
  expect(formatStreakDays(1)).toBe("1 day streak");
  expect(formatStreakDays(7)).toBe("7 day streak");
});
```

- [x] **Step 3: Run, confirm failures**

```powershell
npm run test:frontend
```

Expected: 4 failing tests.

- [x] **Step 4: Implement parser update**

In `src/presets.ts`:

```ts
export type PresetInput = {
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
  autoStartNext: boolean;
};

export function parsePresetForm(form: FormData): PresetParseResult {
  const name = String(form.get("name") ?? "").trim();
  const focusMinutes = Number(form.get("focusMinutes"));
  const breakMinutes = Number(form.get("breakMinutes"));
  const cyclesRaw = form.get("cycles");
  const cycles = cyclesRaw === null || cyclesRaw === "" ? 1 : Number(cyclesRaw);
  const autoStartNext = form.get("autoStartNext") === "on";

  if (
    !name ||
    !Number.isInteger(focusMinutes) ||
    !Number.isInteger(breakMinutes) ||
    !Number.isInteger(cycles) ||
    focusMinutes < 1 ||
    breakMinutes < 1 ||
    cycles < 1
  ) {
    return {
      ok: false,
      error:
        "Name, focus minutes, break minutes, and cycles (≥1) are required.",
    };
  }

  return { ok: true, value: { name, focusMinutes, breakMinutes, cycles, autoStartNext } };
}
```

- [x] **Step 5: Implement stats formatters**

In `src/stats.ts`, add:

```ts
export function formatFocusMinutesToday(minutes: number): string {
  if (minutes < 60) return `${minutes}m today`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m today`;
}

export function formatStreakDays(days: number): string {
  if (days === 0) return "No streak yet";
  return `${days} day streak`;
}
```

- [x] **Step 6: Update markup**

In `index.html`, inside the preset form (`#preset-form`), add **before** the submit button:

```html
<label class="field" for="cycles">
  <span>Cycles</span>
  <input id="cycles" name="cycles" type="number" min="1" value="1" />
</label>
<label class="toggle field" for="auto-start-next">
  <input type="checkbox" id="auto-start-next" name="autoStartNext" />
  Auto-start next focus after break
</label>
```

In the same `index.html`, inside the Statistics card, replace the two existing `<p class="stat">` rows with **four** rows:

```html
<p class="stat" data-testid="sessions-today">0 sessions today</p>
<p class="stat" data-testid="focus-today">0m today</p>
<p class="stat" data-testid="streak-days">No streak yet</p>
<p class="stat" data-testid="focus-this-week">0h 0m this week</p>
```

- [x] **Step 7: Update `main.ts` to render the new fields**

In `src/main.ts`, in `loadStats`:

```ts
async function loadStats(): Promise<void> {
  const stats = await invoke<StatsResponse>("get_stats");
  const today = document.querySelector<HTMLElement>("[data-testid='sessions-today']");
  const week = document.querySelector<HTMLElement>("[data-testid='focus-this-week']");
  const focusToday = document.querySelector<HTMLElement>("[data-testid='focus-today']");
  const streak = document.querySelector<HTMLElement>("[data-testid='streak-days']");
  if (today) today.textContent = formatSessionsToday(stats.sessionsToday);
  if (week) week.textContent = formatFocusMinutes(stats.focusMinutesThisWeek);
  if (focusToday) focusToday.textContent = formatFocusMinutesToday(stats.focusMinutesToday);
  if (streak) streak.textContent = formatStreakDays(stats.currentStreakDays);
}
```

Add the new imports at the top:

```ts
import {
  formatFocusMinutes,
  formatFocusMinutesToday,
  formatSessionsToday,
  formatStreakDays,
} from "./stats";
```

In the preset list rendering (`loadPresets`), under the existing `<small>` line, append the cycles indicator:

```ts
const detail = document.createElement("small");
const cyclesPart = p.cycles > 1
  ? ` · ${p.cycles}× ${p.autoStartNext ? "auto" : "manual"}`
  : "";
detail.textContent = `${p.focusMinutes}m focus · ${p.breakMinutes}m break${cyclesPart}`;
```

Update `PresetRow`:

```ts
export type PresetRow = {
  id: string;
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
  autoStartNext: boolean;
};
```

- [x] **Step 8: Update DOM in `src/main.test.ts`**

In the `beforeEach`, add the new stats rows + new preset form fields so the bootstrap path can find them:

```ts
<p class="stat" data-testid="sessions-today">0 sessions today</p>
<p class="stat" data-testid="focus-today">0m today</p>
<p class="stat" data-testid="streak-days">No streak yet</p>
<p class="stat" data-testid="focus-this-week">0h 0m this week</p>
...
<label class="field" for="cycles"><span>Cycles</span>
  <input id="cycles" name="cycles" type="number" min="1" value="1" /></label>
<label class="toggle field" for="auto-start-next">
  <input type="checkbox" id="auto-start-next" name="autoStartNext" />
  Auto-start next focus after break</label>
```

Update the existing "loads stats on bootstrap" test mock to return camelCase + new fields (already done in Task 3) AND assert:

```ts
expect(screen.getByTestId("focus-today").textContent).toBe("50m today");
expect(screen.getByTestId("streak-days").textContent).toBe("3 day streak");
```

- [x] **Step 9: Run all frontend + Rust tests**

```powershell
npm test
```

Expected: all green.

- [x] **Step 10: Commit**

```bash
git add index.html src/main.ts src/main.test.ts src/presets.ts src/presets.test.ts src/stats.ts src/stats.test.ts
git commit -m "feat: settings UI for cycles, auto-cycle, and granular stats"
```

---

### Task 10: README

**Files:**
- Create: `README.md`

- [x] **Step 1: Write the README**

Create `README.md` at repo root with this exact content:

```markdown
<!-- Replace ICON_PLACEHOLDER.png with a 128×128 transparent PNG once available. -->
<p align="center">
  <img src="docs/assets/ICON_PLACEHOLDER.png" alt="Punto icon" width="96" height="96" />
</p>

# Punto

A minimalist Pomodoro timer that lives in your Windows system tray. Zero UI by default — a circular icon turns green when you're focused, white when you're idle.

- **Focus / break cycles** with custom presets and optional auto-start of the next focus.
- **Native toast notifications** with motivational microcopy and your daily stats.
- **Granular stats**: sessions today, focus minutes today, streak days, weekly minutes.
- **Tray-only operation**: left-click to open the dashboard, right-click for controls.
- **Local-first**: history is a JSON file under `%AppData%\Punto\`. No accounts, no cloud.

## Install

1. Grab `Punto_<version>_x64_en-US.msi` from the [Releases](../../releases) page.
2. Double-click to install. The app starts hidden — look for the small white circle in the system tray.
3. (Optional) Right-click the tray icon → **Settings…** → enable *Launch on Windows startup*.

## Build from source

Prerequisites: Node 20+, Rust stable, the Tauri 2 prerequisites for Windows ([Microsoft C++ Build Tools, WebView2, etc.](https://v2.tauri.app/start/prerequisites/)).

```powershell
npm install
npm run build:installer
# MSI lands in src-tauri\target\release\bundle\msi\
```

## Develop

```powershell
npm install
npm run tauri dev
```

The dashboard opens automatically in dev. Stats and presets persist across runs in your AppData folder.

## Test

```powershell
npm test                # frontend (vitest) + Rust (cargo test)
npm run typecheck       # tsc --noEmit
npm run build           # production frontend + tsc
npm run test:rust       # Rust only
npm run test:frontend   # frontend only
```

## Project layout

- `src/` — TypeScript frontend (settings/stats window).
- `src-tauri/` — Rust backend (timer state machine, tray, notifications).
- `docs/` — specs and implementation plans.

## License

MIT — see [LICENSE](LICENSE) (add one if missing).
```

- [x] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add project README with install + build instructions"
```

---

### Task 11: Final Verification and New Installer

**Files:** none.

- [x] **Step 1: Run full suite**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: all green.

- [x] **Step 2: Build the new MSI**

```powershell
npm run build:installer
```

Expected:

```text
Finished 1 bundle at:
        ...\src-tauri\target\release\bundle\msi\Punto_0.1.0_x64_en-US.msi
```

- [ ] **Step 3: Manual smoke test**

> **Automated (2026-04-30):** Steps 1–2 re-run in CI/agent: `npm test`, `npm run typecheck`, `npm run build`, `npm run build:installer` — all green. Step 3 still requires you to install the MSI locally.

Uninstall the old Punto, install the new MSI.

Verify, in order:
- Tray shows a small white circle (no taskbar entry, no console).
- Right-click tray → menu shows `Start preset` (Idle), `Settings…`, separator, `Quit Punto`.
- Click `Settings…` → dashboard appears.
- Save a new preset with **cycles = 2** and **auto-start = on**, focus = 1m, break = 1m.
- Right-click tray → start the preset. Tray icon turns green.
- After 1 minute the focus notification fires (motivational copy with stats), and the dashboard auto-shows. Tray icon turns blue (break).
- After another minute the next focus auto-starts (icon goes green again, no user action).
- Click the dashboard's minimize button → window disappears AND the taskbar entry disappears. Click the tray icon → dashboard reappears.
- Open Statistics card on the dashboard: shows 4 lines (sessions today, focus minutes today, streak, week).

- [x] **Step 4: Commit any incidental fixes (if needed)**

```bash
git add -A
git commit -m "chore: post-cycle ux polish"
```

(Skip this commit if there are no changes.)

---

## Self-Review

**Spec coverage:**

- "Multiple Pomodoro sessions / auto-start after break" → Tasks 1, 2 (preset model + tick loop) and Task 9 (UI).
- "Right-click menu Settings entry" → Task 6.
- "Notifications with useful info, emoji, Duolingo-style brevity" → Task 4 (templates + stats injection + length asserts).
- "Click on notification → settings" → Task 5 — auto-shows the dashboard on focus complete because Tauri 2 / `notify-rust` does not expose a click handler on Windows. The plan documents this trade-off.
- "Settings non-resizable + minimize hides from taskbar" → already non-resizable in `tauri.conf.json` (`resizable: false`); minimize hiding is Task 8.
- "Granular stats (focus minutes today, sessions count)" → Task 3 backend + Task 9 UI rendering.
- "Icon: small white circle, green when active" → Task 7.
- "Concise README with placeholder for icon" → Task 10.

**Placeholder scan:** No "TBD"/"TODO"/"implement later"/"appropriate handling" in any step. Every code step shows code; every command step shows expected output.

**Type consistency:**
- `Preset.cycles: u32` and `Preset.auto_start_next: bool` are introduced in Task 1 and consumed in Task 2 (`Timer::start_focus` extra args), Task 9 (UI rendering), and the `PresetRow` TS type. The `auto_start_next` Rust field becomes `autoStartNext` over the wire via `#[serde(rename_all = "camelCase")]`.
- `Stats.focus_minutes_today` and `Stats.current_streak_days` introduced in Task 3 with camelCase Serde rename; consumed in Task 9 frontend (`stats.focusMinutesToday`, `stats.currentStreakDays`) and Task 4 notification templates (`{minutes_today}`, `{streak}`).
- `NotificationCopy` is `pub` in `notifications.rs`, used only inside the crate and tests — no Tauri command exposes it.
- `start_focus(focus, break, cycles, auto_start_next)` signature is changed once in Task 2 and updated at every call site within the same task; no later task relies on the old 2-arg form.
- Tray menu IDs (`pause`, `resume`, `stop`, `settings`, `exit`, `preset:<uuid>`) consistent across `build_root_menu` and `handle_menu_event` after Task 6.
- All new permissions are added in Tasks 5 and 8; capabilities file is touched only in those tasks.

**Known limitation surfaced to user:** Tauri 2's notification plugin on Windows has no click callback. The plan substitutes auto-show on focus complete (Task 5) and a tray `Settings…` entry (Task 6) so the user always has a one-click path to the dashboard.
