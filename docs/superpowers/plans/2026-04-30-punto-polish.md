# Punto Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the console window on installed launches, redesign the settings UI, expose a live timer with explicit Start/Pause/Resume/Stop semantics, and label tray controls so the user knows what they do.

**Architecture:** Switch the binary subsystem to `windows` so no console attaches when launched from the Start Menu / autostart. Add a Rust command + 1 Hz emitted event that exposes `phase`, `running`, `remaining_seconds`, `focus_minutes`, `break_minutes`. Rebuild the settings window with a styled CSS layout (cards, grid form, monospace big timer). Re-label tray entries and hide irrelevant ones based on phase (Pause only when Focus/Break running, Resume only when paused, Stop only when not Idle). Keep timer state machine and persistence untouched.

**Tech Stack:** Rust (Tauri v2, `#![windows_subsystem = "windows"]`), TypeScript, vanilla CSS, Vitest.

---

## Priority and Dependencies

Execute in this order. Priority reflects user impact + unblock potential.

| # | Task | Priority | Depends on | Why |
|---|------|----------|------------|-----|
| 1 | Hide console window | P0 | — | Cosmetic showstopper, isolated 1-line change |
| 2 | Close-to-tray (don't quit on window close) | P0 | — | Data-loss risk: closing the dashboard kills active timer |
| 3 | Slim tray menu | P0 | 2 | Tray is the only persistent UI; reduces cognitive load |
| 4 | TimerSnapshot type | P1 | — | Wire format other tasks depend on |
| 5 | Live timer commands + tick events | P1 | 4 | Required by frontend live timer |
| 6 | Phase-aware tray menu labels | P1 | 3, 5 | Replaces Task 4 from prior plan; needs slim layout + snapshot |
| 7 | Settings window redesign (HTML + CSS) | P1 | — | Independent of Rust; can be parallel with 4–6 |
| 8 | Live timer + controls in frontend | P1 | 5, 7 | Needs both events and styled markup |
| 9 | Final verify + new MSI | P0 | all above | Ship gate |

P0 = ship-blocking; P1 = ship-blocking polish; no P2 in this plan.

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
   npm run build
   ```
7. For tasks that touch Rust (`src-tauri/**`), additionally run:
   ```powershell
   npm run build:installer
   ```
   The MSI must finish (`Finished 1 bundle at ...`). If `cargo` is missing, the wrapper script `scripts/run-tauri.ps1` must be used (it sets PATH); never edit machine-wide environment.
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

- Modify `src-tauri/src/main.rs`: add `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` to suppress console on release builds.
- Modify `src-tauri/src/lib.rs`: handle `WindowEvent::CloseRequested` to hide the main window instead of quitting; add `get_timer` command, emit `timer-tick` every second from the timer loop, register handler.
- Modify `src-tauri/src/timer.rs`: add `Default` plus serializable `TimerSnapshot { phase, running, remaining_seconds, focus_minutes, break_minutes }` accessor.
- Modify `src-tauri/src/tray.rs`: slim root menu to 4 items (active preset / Pause-Resume toggle / Stop / Quit); rebuild on every tick to reflect current phase; remove redundant duplicate entries.
- Modify `index.html`: redesign markup — header, status card, presets list with `Start` buttons, presets form in CSS grid, polished classes.
- Create `src/styles.css`: design tokens (colors, spacing), card layout, big timer typography, button styles for start/pause/resume/stop, focus/break/idle phase accent.
- Modify `src/main.ts`: subscribe to `timer-tick` event, render `TimerSnapshot`, wire Start/Pause/Resume/Stop buttons via existing `start_preset`/`pause_timer`/`resume_timer`/`stop_timer` commands.
- Modify `src/main.test.ts`: extend DOM tests to cover live timer rendering and the new control buttons.
- Modify `src-tauri/tests/timer_tests.rs`: add a snapshot serialization test so the wire format stays stable.

---

### Task 1: Hide Console Window on Installed App

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Update entrypoint to use the Windows GUI subsystem in release**

Replace `src-tauri/src/main.rs` with:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    punto::run();
}
```

- [ ] **Step 2: Rebuild the installer**

Run:

```powershell
npm run build:installer
```

Expected:

```text
Finished `release` profile [optimized] target(s)
Finished 1 bundle at:
        ...\\src-tauri\\target\\release\\bundle\\msi\\Punto_0.1.0_x64_en-US.msi
```

- [ ] **Step 3: Manually verify**

Uninstall the previous Punto, install the new MSI, launch from Start Menu.
Expected: no console window appears, no taskbar entry, only the tray icon.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "fix: hide console window on installed Punto"
```

### Task 2: Close-to-Tray Instead of Quit

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Intercept the main window's close button**

In `src-tauri/src/lib.rs`, replace the final `app.run(...)` block with:

```rust
app.run(|handle, event| {
    if let tauri::RunEvent::WindowCloseRequested { label, api, .. } = &event {
        if label == "main" {
            api.prevent_close();
            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.hide();
            }
        }
    }
});
```

This keeps the tray + timer alive when the user clicks the dashboard's `X`. Quit only happens via the tray's "Quit Punto" item (which calls `app.exit(0)`).

- [ ] **Step 2: Verify with Rust tests**

Run:

```powershell
npm run test:rust
```

Expected:

```text
test result: ok.
```

(No new unit test — `WindowCloseRequested` requires a running webview; behavior is verified manually in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "fix: dashboard close hides window instead of quitting Punto"
```

### Task 3: Slim Tray Menu

**Goal:** Reduce tray entries to the minimum needed during a session. Today the menu has duplicates (`View statistics` and `Settings / edit presets` open the same window) and rarely-used items.

**Final tray layout (4 items + separator):**

```
▶ Start preset      ▸ (submenu listing presets, hidden when timer is running)
⏸ Pause             (only when running; toggles label to Resume when paused)
■ Stop              (only when not idle)
─────────
✕ Quit Punto
```

Left-click on the tray icon = open the dashboard. The "Open dashboard" menu item is removed because it's redundant.

**Files:**
- Modify: `src-tauri/src/tray.rs`

- [ ] **Step 1: Rebuild the menu logic**

Replace `build_root_menu` and `handle_menu_event` in `src-tauri/src/tray.rs` with:

```rust
pub fn build_root_menu<R: Runtime>(
    handle: &AppHandle<R>,
    state: &Arc<AppState>,
) -> tauri::Result<Menu<R>> {
    let core = state.inner.lock().expect("state mutex poisoned");
    let phase = core.timer.phase();
    let running = core.timer.snapshot().running;
    let presets_snapshot = core.presets.all().to_vec();
    drop(core);

    let mut items: Vec<Box<dyn IsMenuItem<R>>> = Vec::new();

    if phase == Phase::Idle {
        let preset_items: Vec<MenuItem<R>> = presets_snapshot
            .iter()
            .map(|p| {
                let id = format!("preset:{}", p.id);
                let text = format!("{} · {}m / {}m", p.name, p.focus_minutes, p.break_minutes);
                MenuItem::with_id(handle, id, text, true, None::<&str>)
            })
            .collect::<tauri::Result<_>>()?;
        let preset_refs: Vec<&dyn IsMenuItem<R>> =
            preset_items.iter().map(|i| i as &dyn IsMenuItem<R>).collect();
        let presets = Submenu::with_items(handle, "Start preset", !presets_snapshot.is_empty(), &preset_refs)?;
        items.push(Box::new(presets));
    } else if running {
        let pause = MenuItem::with_id(handle, "pause", "Pause (keep remaining time)", true, None::<&str>)?;
        items.push(Box::new(pause));
    } else {
        let resume = MenuItem::with_id(handle, "resume", "Resume", true, None::<&str>)?;
        items.push(Box::new(resume));
    }

    if phase != Phase::Idle {
        let stop = MenuItem::with_id(handle, "stop", "Stop (reset to idle)", true, None::<&str>)?;
        items.push(Box::new(stop));
    }

    let sep = PredefinedMenuItem::separator(handle)?;
    items.push(Box::new(sep));

    let quit = MenuItem::with_id(handle, "exit", "Quit Punto", true, None::<&str>)?;
    items.push(Box::new(quit));

    let refs: Vec<&dyn IsMenuItem<R>> =
        items.iter().map(|b| b.as_ref()).collect();
    Menu::with_items(handle, &refs)
}

pub fn handle_menu_event<R: Runtime>(
    app: &AppHandle<R>,
    state: &Arc<AppState>,
    event: &tauri::menu::MenuEvent,
) {
    let id = event.id().as_ref();
    match id {
        "exit" => app.exit(0),
        "pause" => {
            if let Ok(mut c) = state.inner.lock() {
                if let Ok(t) = c.timer.clone().pause() {
                    c.timer = t;
                }
            }
            let _ = refresh_tray_menu(app, state);
            let _ = app.emit("timer-tick", ());
        }
        "resume" => {
            if let Ok(mut c) = state.inner.lock() {
                if let Ok(t) = c.timer.clone().resume() {
                    c.timer = t;
                }
            }
            let _ = refresh_tray_menu(app, state);
            let _ = app.emit("timer-tick", ());
        }
        "stop" => {
            if let Ok(mut c) = state.inner.lock() {
                c.timer = c.timer.clone().stop();
                c.focus_started_at = None;
            }
            let _ = set_tray_icon_phase(app, Phase::Idle);
            let _ = refresh_tray_menu(app, state);
            let _ = app.emit("timer-tick", ());
        }
        s if s.starts_with("preset:") => {
            let rest = s.trim_start_matches("preset:");
            if let Ok(uid) = Uuid::parse_str(rest) {
                if let Ok(mut c) = state.inner.lock() {
                    if let Some(preset) = c.presets.all().iter().find(|p| p.id == uid).cloned() {
                        if let Ok(t) = c.timer.clone().stop().start_focus(preset.focus_minutes, preset.break_minutes) {
                            c.timer = t;
                            c.focus_started_at = Some(chrono::Utc::now());
                        }
                    }
                }
            }
            let _ = set_tray_icon_phase(app, Phase::Focus);
            let _ = refresh_tray_menu(app, state);
            let _ = app.emit("timer-tick", ());
        }
        _ => {}
    }
}
```

- [ ] **Step 2: Make left-click open the dashboard**

In `install_tray` (same file), replace the `on_tray_icon_event` block with:

```rust
.on_tray_icon_event(|tray, event| {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        if let Some(w) = tray.app_handle().get_webview_window("main") {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
})
```

(`Manager` and `Runtime` traits are already in scope; no new imports needed.)

- [ ] **Step 3: Compile and run tests**

Run:

```powershell
npm run test:rust
npm run build
```

Expected:

```text
test result: ok.
✓ built
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/tray.rs
git commit -m "feat: slim tray menu and left-click opens dashboard"
```

> **Note:** This task supersedes the prior "Task 4: Tray Menu Reflects Phase". When you reach Task 4 below, skip it — its goal is fulfilled here. Keep its `refresh_tray_menu` calls in `spawn_timer_loop` (they remain required by Task 5).

### Task 4: Add Timer Snapshot Type

**Files:**
- Modify: `src-tauri/src/timer.rs`
- Modify: `src-tauri/tests/timer_tests.rs`

- [ ] **Step 1: Add a failing snapshot test**

Append to `src-tauri/tests/timer_tests.rs`:

```rust
use punto::timer::{TimerSnapshot};

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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test:rust -- timer_tests
```

Expected:

```text
unresolved import `punto::timer::TimerSnapshot`
```

- [ ] **Step 3: Implement the snapshot type**

Add to `src-tauri/src/timer.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimerSnapshot {
    pub phase: Phase,
    pub running: bool,
    pub remaining_seconds: u32,
    pub focus_minutes: u32,
    pub break_minutes: u32,
}

impl Timer {
    pub fn snapshot(&self) -> TimerSnapshot {
        TimerSnapshot {
            phase: self.phase,
            running: self.running,
            remaining_seconds: self.remaining_seconds,
            focus_minutes: self.focus_minutes,
            break_minutes: self.break_minutes,
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm run test:rust -- timer_tests
```

Expected:

```text
test result: ok. 5 passed
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/timer.rs src-tauri/tests/timer_tests.rs
git commit -m "feat: add TimerSnapshot for UI rendering"
```

### Task 5: Expose Timer Commands and Tick Events

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add Tauri commands for the live timer**

Replace the command region in `src-tauri/src/lib.rs` (after `reset_history`) with these commands:

```rust
use crate::timer::TimerSnapshot;

#[tauri::command]
fn get_timer(state: tauri::State<'_, Arc<AppState>>) -> Result<TimerSnapshot, String> {
    let core = state.inner.lock().map_err(|e| e.to_string())?;
    Ok(core.timer.snapshot())
}

#[tauri::command]
fn start_preset(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    id: uuid::Uuid,
) -> Result<TimerSnapshot, String> {
    let snapshot = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        let preset = core
            .presets
            .all()
            .iter()
            .find(|p| p.id == id)
            .cloned()
            .ok_or_else(|| "preset not found".to_string())?;
        let timer = core
            .timer
            .clone()
            .stop()
            .start_focus(preset.focus_minutes, preset.break_minutes)
            .map_err(|e| e.to_string())?;
        core.timer = timer;
        core.focus_started_at = Some(Utc::now());
        core.timer.snapshot()
    };
    set_tray_icon_phase(&app, Phase::Focus).map_err(|e| e.to_string())?;
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    let _ = app.emit("timer-tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
fn pause_timer(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<TimerSnapshot, String> {
    let snapshot = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        let timer = core.timer.clone().pause().map_err(|e| e.to_string())?;
        core.timer = timer;
        core.timer.snapshot()
    };
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    let _ = app.emit("timer-tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
fn resume_timer(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<TimerSnapshot, String> {
    let snapshot = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        let timer = core.timer.clone().resume().map_err(|e| e.to_string())?;
        core.timer = timer;
        core.timer.snapshot()
    };
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    let _ = app.emit("timer-tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
fn stop_timer(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<TimerSnapshot, String> {
    let snapshot = {
        let mut core = state.inner.lock().map_err(|e| e.to_string())?;
        core.timer = core.timer.clone().stop();
        core.focus_started_at = None;
        core.timer.snapshot()
    };
    set_tray_icon_phase(&app, Phase::Idle).map_err(|e| e.to_string())?;
    refresh_tray_menu(&app, &*state).map_err(|e| e.to_string())?;
    let _ = app.emit("timer-tick", &snapshot);
    Ok(snapshot)
}
```

- [ ] **Step 2: Emit `timer-tick` from the timer loop**

Replace `spawn_timer_loop` body with:

```rust
fn spawn_timer_loop(state: Arc<AppState>) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(1));
        let mut core = match state.inner.lock() {
            Ok(g) => g,
            Err(_) => continue,
        };
        let old_phase = core.timer.phase();
        let tick_result = core.timer.clone().tick(1);
        core.timer = tick_result.timer;
        let snapshot = core.timer.snapshot();

        if let Some(ev) = tick_result.event {
            if let Some(mins) = ev.completed_focus_minutes {
                let started = core.focus_started_at.unwrap_or_else(Utc::now);
                core.history.sessions.push(FocusSession {
                    started_at: started,
                    duration_minutes: mins,
                });
                let _ = save_json(&core.history_path, &core.history);
                core.focus_started_at = None;
                let bm = ev.timer.snapshot().remaining_seconds.saturating_div(60).max(1);
                let app = state.app.clone();
                drop(core);
                let _ = notify_focus_complete(&app, bm);
                let _ = set_tray_icon_phase(&app, Phase::Break);
                let _ = app.emit("timer-tick", &snapshot);
                continue;
            }
        }

        if old_phase == Phase::Break && core.timer.phase() == Phase::Idle {
            let app = state.app.clone();
            drop(core);
            let _ = notify_break_complete(&app);
            let _ = set_tray_icon_phase(&app, Phase::Idle);
            let _ = app.emit("timer-tick", &snapshot);
            continue;
        }

        let new_phase = core.timer.phase();
        drop(core);
        if new_phase != old_phase {
            let _ = set_tray_icon_phase(&state.app, new_phase);
        }
        let _ = state.app.emit("timer-tick", &snapshot);
    });
}
```

- [ ] **Step 3: Register the new commands in `invoke_handler`**

Update the `invoke_handler!` block to:

```rust
.invoke_handler(tauri::generate_handler![
    list_presets,
    save_preset,
    delete_preset,
    get_stats,
    reset_history,
    get_timer,
    start_preset,
    pause_timer,
    resume_timer,
    stop_timer,
    autostart::is_autostart_enabled,
    autostart::set_autostart_enabled
])
```

- [ ] **Step 4: Compile to confirm Rust changes**

Run:

```powershell
npm run test:rust
```

Expected:

```text
test result: ok. 13 passed
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: expose live timer commands and ticks"
```

### Task 6: (SUPERSEDED by Task 3) Tray Menu Reflects Phase

> Skip this task. Task 3 already produces a phase-aware menu. Keep this section for historical context only — do **not** re-implement.

Original task body (do not execute):

**Files:**
- Modify: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Make tray menu phase-aware with descriptive labels**

Replace `build_root_menu` and `handle_menu_event` in `src-tauri/src/tray.rs` with:

```rust
pub fn build_root_menu<R: Runtime>(
    handle: &AppHandle<R>,
    state: &Arc<AppState>,
) -> tauri::Result<Menu<R>> {
    let core = state.inner.lock().expect("state mutex poisoned");
    let phase = core.timer.phase();
    let running = core.timer.snapshot().running;

    let preset_items: Vec<MenuItem<R>> = core
        .presets
        .all()
        .iter()
        .map(|p| {
            let id = format!("preset:{}", p.id);
            let text = format!("Start {} ({}m focus / {}m break)", p.name, p.focus_minutes, p.break_minutes);
            MenuItem::with_id(handle, id, text, true, None::<&str>)
        })
        .collect::<tauri::Result<_>>()?;
    drop(core);

    let preset_refs: Vec<&dyn IsMenuItem<R>> =
        preset_items.iter().map(|i| i as &dyn IsMenuItem<R>).collect();
    let presets = Submenu::with_items(handle, "Start preset", true, &preset_refs)?;

    let pause = MenuItem::with_id(handle, "pause", "Pause (keep remaining time)", phase != Phase::Idle && running, None::<&str>)?;
    let resume = MenuItem::with_id(handle, "resume", "Resume", phase != Phase::Idle && !running, None::<&str>)?;
    let stop = MenuItem::with_id(handle, "stop", "Stop (reset to idle)", phase != Phase::Idle, None::<&str>)?;
    let stats = MenuItem::with_id(handle, "stats", "Open dashboard", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(handle)?;
    let exit = MenuItem::with_id(handle, "exit", "Quit Punto", true, None::<&str>)?;

    Menu::with_items(
        handle,
        &[
            &presets,
            &pause,
            &resume,
            &stop,
            &stats,
            &sep,
            &exit,
        ],
    )
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, state: &Arc<AppState>, event: &tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    match id {
        "stats" => show_main_window(app),
        "exit" => app.exit(0),
        "pause" => {
            if let Ok(mut c) = state.inner.lock() {
                if let Ok(t) = c.timer.clone().pause() {
                    c.timer = t;
                }
            }
            let _ = refresh_tray_menu(app, state);
            let _ = app.emit("timer-tick", ());
        }
        "resume" => {
            if let Ok(mut c) = state.inner.lock() {
                if let Ok(t) = c.timer.clone().resume() {
                    c.timer = t;
                }
            }
            let _ = refresh_tray_menu(app, state);
            let _ = app.emit("timer-tick", ());
        }
        "stop" => {
            if let Ok(mut c) = state.inner.lock() {
                c.timer = c.timer.clone().stop();
                c.focus_started_at = None;
            }
            let _ = set_tray_icon_phase(app, Phase::Idle);
            let _ = refresh_tray_menu(app, state);
            let _ = app.emit("timer-tick", ());
        }
        s if s.starts_with("preset:") => {
            let rest = s.trim_start_matches("preset:");
            if let Ok(uid) = Uuid::parse_str(rest) {
                if let Ok(mut c) = state.inner.lock() {
                    if let Some(preset) = c.presets.all().iter().find(|p| p.id == uid).cloned() {
                        if let Ok(t) = c.timer.clone().stop().start_focus(preset.focus_minutes, preset.break_minutes) {
                            c.timer = t;
                            c.focus_started_at = Some(chrono::Utc::now());
                        }
                    }
                }
            }
            let _ = set_tray_icon_phase(app, Phase::Focus);
            let _ = refresh_tray_menu(app, state);
            let _ = app.emit("timer-tick", ());
        }
        _ => {}
    }
}
```

- [ ] **Step 2: Refresh tray menu on every tick**

In `src-tauri/src/lib.rs`, inside `spawn_timer_loop`, after the `let _ = state.app.emit("timer-tick", &snapshot);` line and at every `continue;` branch, also call:

```rust
let _ = refresh_tray_menu(&state.app, &state);
```

- [ ] **Step 3: Compile**

Run:

```powershell
npm run test:rust
```

Expected:

```text
test result: ok. 13 passed
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/tray.rs src-tauri/src/lib.rs
git commit -m "feat: phase-aware tray menu with explicit labels"
```

### Task 7: Settings Window Redesign (Markup + CSS)

**Files:**
- Modify: `index.html`
- Create: `src/styles.css`

- [ ] **Step 1: Add styled markup**

Replace the contents of `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Punto</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <main id="app">
      <header class="topbar">
        <div class="brand">
          <span class="brand-dot" data-testid="brand-dot"></span>
          <h1>Punto</h1>
        </div>
      </header>

      <section class="card timer-card" aria-labelledby="timer-title">
        <h2 id="timer-title">Current session</h2>
        <p class="phase" data-testid="timer-phase">Idle</p>
        <p class="time" data-testid="timer-display">--:--</p>
        <div class="controls">
          <button type="button" id="btn-pause" data-testid="btn-pause" title="Suspend the countdown without losing remaining time">Pause</button>
          <button type="button" id="btn-resume" data-testid="btn-resume" title="Continue from where Pause left off">Resume</button>
          <button type="button" id="btn-stop" data-testid="btn-stop" title="Cancel the current session and go back to Idle">Stop</button>
        </div>
      </section>

      <section class="card" aria-labelledby="presets-title">
        <h2 id="presets-title">Presets</h2>
        <ul id="preset-list" class="preset-list" data-testid="preset-list"></ul>
        <form id="preset-form" class="preset-form">
          <label class="field">
            <span>Name</span>
            <input id="preset-name" name="name" placeholder="Deep work" required />
          </label>
          <label class="field">
            <span>Focus minutes</span>
            <input id="focus-minutes" name="focusMinutes" type="number" min="1" placeholder="25" required />
          </label>
          <label class="field">
            <span>Break minutes</span>
            <input id="break-minutes" name="breakMinutes" type="number" min="1" placeholder="5" required />
          </label>
          <button class="primary" type="submit">Save preset</button>
        </form>
        <p id="preset-error" class="error" role="alert"></p>
      </section>

      <section class="card" aria-labelledby="stats-title">
        <h2 id="stats-title">Statistics</h2>
        <p class="stat" data-testid="sessions-today">0 sessions today</p>
        <p class="stat" data-testid="focus-this-week">0h 0m this week</p>
        <button type="button" class="ghost" id="reset-history">Reset statistics</button>
      </section>

      <section class="card" aria-labelledby="startup-title">
        <h2 id="startup-title">Startup</h2>
        <label class="toggle">
          <input type="checkbox" id="launch-startup" />
          Launch on Windows startup
        </label>
      </section>
    </main>
    <script type="module">
      import { bootstrap } from "/src/main.ts";
      bootstrap();
    </script>
  </body>
</html>
```

- [ ] **Step 2: Add the stylesheet**

Create `src/styles.css`:

```css
:root {
  color-scheme: light dark;
  --bg: #f5f5f7;
  --surface: #ffffff;
  --text: #1c1c1e;
  --muted: #6b6b70;
  --border: #e5e5ea;
  --accent: #2f6feb;
  --focus: #2bb673;
  --break: #4a90e2;
  --idle: #8e8e93;
  --danger: #c7263a;
  --radius: 12px;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.04);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1c1e;
    --surface: #2c2c2e;
    --text: #f5f5f7;
    --muted: #a1a1a6;
    --border: #3a3a3c;
    --shadow: none;
  }
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
}

main {
  padding: 1rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.brand h1 {
  font-size: 1.25rem;
  margin: 0;
  font-weight: 600;
}

.brand-dot {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 999px;
  background: var(--idle);
}

.brand-dot[data-phase="Focus"] {
  background: var(--focus);
}

.brand-dot[data-phase="Break"] {
  background: var(--break);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.1rem;
  box-shadow: var(--shadow);
}

.card h2 {
  margin: 0 0 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.timer-card .phase {
  margin: 0 0 0.25rem;
  color: var(--muted);
  font-size: 0.95rem;
}

.timer-card .time {
  margin: 0 0 1rem;
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
  font-size: 3rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

button {
  font: inherit;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

button:hover {
  border-color: var(--accent);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  grid-column: 1 / -1;
}

button.ghost {
  border-color: var(--danger);
  color: var(--danger);
  background: transparent;
}

.preset-list {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.preset-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: var(--bg);
  border-radius: 8px;
}

.preset-list .preset-meta {
  display: flex;
  flex-direction: column;
}

.preset-list strong {
  font-weight: 600;
}

.preset-list small {
  color: var(--muted);
  font-size: 0.8rem;
}

.preset-actions {
  display: flex;
  gap: 0.35rem;
}

.preset-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.field span {
  font-weight: 500;
}

.field input {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  font-size: 0.95rem;
}

.field:nth-of-type(1) {
  grid-column: 1 / -1;
}

.error {
  margin: 0.5rem 0 0;
  color: var(--danger);
  font-size: 0.85rem;
  min-height: 1rem;
}

.stat {
  margin: 0.15rem 0;
  font-size: 0.95rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
}
```

- [ ] **Step 3: Verify build still produces a bundle**

Run:

```powershell
npm run build
```

Expected: `✓ built` and a non-zero size CSS asset entry.

- [ ] **Step 4: Commit**

```bash
git add index.html src/styles.css
git commit -m "feat: redesigned settings window markup and styles"
```

### Task 8: Live Timer + Controls in Frontend

**Files:**
- Modify: `src/main.ts`
- Modify: `src/main.test.ts`

- [ ] **Step 1: Add failing test for live timer rendering**

Replace `src/main.test.ts` with:

```ts
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap, applyTimerSnapshot } from "./main";

const invoke = vi.fn();
const listen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args)
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listen(...args)
}));

beforeEach(() => {
  document.body.innerHTML = `
    <main id="app">
      <span class="brand-dot" data-testid="brand-dot"></span>
      <p class="phase" data-testid="timer-phase">Idle</p>
      <p class="time" data-testid="timer-display">--:--</p>
      <button id="btn-pause" data-testid="btn-pause">Pause</button>
      <button id="btn-resume" data-testid="btn-resume">Resume</button>
      <button id="btn-stop" data-testid="btn-stop">Stop</button>
      <ul id="preset-list" data-testid="preset-list"></ul>
      <form id="preset-form">
        <label>Name <input id="preset-name" name="name" required /></label>
        <label>Focus minutes <input id="focus-minutes" name="focusMinutes" type="number" min="1" required /></label>
        <label>Break minutes <input id="break-minutes" name="breakMinutes" type="number" min="1" required /></label>
        <button type="submit">Save preset</button>
      </form>
      <p id="preset-error" role="alert"></p>
      <p data-testid="sessions-today">0 sessions today</p>
      <p data-testid="focus-this-week">0h 0m this week</p>
      <button id="reset-history">Reset statistics</button>
      <input type="checkbox" id="launch-startup" />
    </main>
  `;
  invoke.mockReset();
  listen.mockReset();
  listen.mockResolvedValue(() => {});
});

describe("settings window", () => {
  it("renders mm:ss countdown and phase from snapshot", () => {
    applyTimerSnapshot({
      phase: "Focus",
      running: true,
      remaining_seconds: 125,
      focus_minutes: 25,
      break_minutes: 5
    });

    expect(screen.getByTestId("timer-phase").textContent).toBe("Focus session");
    expect(screen.getByTestId("timer-display").textContent).toBe("02:05");
    expect(screen.getByTestId("brand-dot").getAttribute("data-phase")).toBe("Focus");
  });

  it("invokes pause_timer when Pause is clicked", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") return Promise.resolve({ sessions_today: 0, focus_minutes_this_week: 0 });
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({ phase: "Focus", running: true, remaining_seconds: 60, focus_minutes: 25, break_minutes: 5 });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();
    await userEvent.click(screen.getByTestId("btn-pause"));

    expect(invoke).toHaveBeenCalledWith("pause_timer");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm run test:frontend -- src/main.test.ts
```

Expected:

```text
Error: applyTimerSnapshot is not exported
```

- [ ] **Step 3: Implement the live timer in `src/main.ts`**

Replace `src/main.ts` with:

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parsePresetForm } from "./presets";
import { formatFocusMinutes, formatSessionsToday } from "./stats";

export type PresetRow = {
  id: string;
  name: string;
  focusMinutes: number;
  breakMinutes: number;
};

type StatsResponse = {
  sessions_today: number;
  focus_minutes_this_week: number;
};

export type TimerSnapshot = {
  phase: "Idle" | "Focus" | "Break";
  running: boolean;
  remaining_seconds: number;
  focus_minutes: number;
  break_minutes: number;
};

const PHASE_LABEL: Record<TimerSnapshot["phase"], string> = {
  Idle: "Idle",
  Focus: "Focus session",
  Break: "Break"
};

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function applyTimerSnapshot(snapshot: TimerSnapshot): void {
  const phaseEl = document.querySelector<HTMLElement>("[data-testid='timer-phase']");
  const timeEl = document.querySelector<HTMLElement>("[data-testid='timer-display']");
  const dot = document.querySelector<HTMLElement>("[data-testid='brand-dot']");
  const pause = document.querySelector<HTMLButtonElement>("[data-testid='btn-pause']");
  const resume = document.querySelector<HTMLButtonElement>("[data-testid='btn-resume']");
  const stop = document.querySelector<HTMLButtonElement>("[data-testid='btn-stop']");

  if (phaseEl) {
    let label = PHASE_LABEL[snapshot.phase];
    if (snapshot.phase !== "Idle" && !snapshot.running) {
      label = `${label} (paused)`;
    }
    phaseEl.textContent = label;
  }
  if (timeEl) {
    timeEl.textContent = snapshot.phase === "Idle" ? "--:--" : formatMmSs(snapshot.remaining_seconds);
  }
  if (dot) {
    dot.setAttribute("data-phase", snapshot.phase);
  }
  if (pause) pause.disabled = snapshot.phase === "Idle" || !snapshot.running;
  if (resume) resume.disabled = snapshot.phase === "Idle" || snapshot.running;
  if (stop) stop.disabled = snapshot.phase === "Idle";
}

export async function bootstrap(): Promise<void> {
  document.body.dataset.ready = "true";
  await loadStats();
  await loadPresets();
  bindPresetForm();
  bindResetHistory();
  await bindAutostart();
  bindTimerControls();

  try {
    const snap = await invoke<TimerSnapshot>("get_timer");
    applyTimerSnapshot(snap);
  } catch {
    /* ignore: snapshot will arrive via event */
  }

  await listen<TimerSnapshot>("timer-tick", (e) => {
    if (e.payload) applyTimerSnapshot(e.payload);
  });
}

async function loadStats(): Promise<void> {
  const stats = await invoke<StatsResponse>("get_stats");
  const sessionsToday = document.querySelector<HTMLElement>("[data-testid='sessions-today']");
  const focusThisWeek = document.querySelector<HTMLElement>("[data-testid='focus-this-week']");
  if (sessionsToday) sessionsToday.textContent = formatSessionsToday(stats.sessions_today);
  if (focusThisWeek) focusThisWeek.textContent = formatFocusMinutes(stats.focus_minutes_this_week);
}

async function loadPresets(): Promise<void> {
  const list = document.querySelector<HTMLUListElement>("#preset-list");
  if (!list) return;
  const presets = await invoke<PresetRow[]>("list_presets");
  list.innerHTML = "";
  for (const p of presets) {
    const li = document.createElement("li");

    const meta = document.createElement("div");
    meta.className = "preset-meta";
    const name = document.createElement("strong");
    name.textContent = p.name;
    const detail = document.createElement("small");
    detail.textContent = `${p.focusMinutes}m focus · ${p.breakMinutes}m break`;
    meta.appendChild(name);
    meta.appendChild(detail);
    li.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "preset-actions";
    const start = document.createElement("button");
    start.type = "button";
    start.textContent = "Start";
    start.title = "Start a focus session with this preset";
    start.addEventListener("click", async () => {
      await invoke("start_preset", { id: p.id });
    });
    actions.appendChild(start);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "ghost";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      await invoke("delete_preset", { id: p.id });
      await loadPresets();
    });
    actions.appendChild(del);
    li.appendChild(actions);

    list.appendChild(li);
  }
}

function bindPresetForm(): void {
  const form = document.querySelector<HTMLFormElement>("#preset-form");
  const error = document.querySelector<HTMLElement>("#preset-error");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const parsed = parsePresetForm(new FormData(form));
    if (!parsed.ok) {
      if (error) error.textContent = parsed.error;
      return;
    }
    await invoke("save_preset", { input: parsed.value });
    form.reset();
    if (error) error.textContent = "";
    await loadPresets();
  });
}

function bindResetHistory(): void {
  const btn = document.querySelector<HTMLButtonElement>("#reset-history");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    await invoke("reset_history");
    await loadStats();
  });
}

async function bindAutostart(): Promise<void> {
  const cb = document.querySelector<HTMLInputElement>("#launch-startup");
  if (!cb) return;
  try {
    cb.checked = await invoke<boolean>("is_autostart_enabled");
  } catch {
    cb.checked = false;
  }
  cb.addEventListener("change", async () => {
    await invoke("set_autostart_enabled", { enabled: cb.checked });
  });
}

function bindTimerControls(): void {
  const pause = document.querySelector<HTMLButtonElement>("[data-testid='btn-pause']");
  const resume = document.querySelector<HTMLButtonElement>("[data-testid='btn-resume']");
  const stop = document.querySelector<HTMLButtonElement>("[data-testid='btn-stop']");
  pause?.addEventListener("click", async () => { await invoke("pause_timer"); });
  resume?.addEventListener("click", async () => { await invoke("resume_timer"); });
  stop?.addEventListener("click", async () => { await invoke("stop_timer"); });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm test
```

Expected:

```text
Test Files  3 passed (3)
Tests  8 passed (8)
test result: ok. 13 passed
```

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/main.test.ts
git commit -m "feat: live timer view with explicit controls"
```

### Task 9: Final Verification and New Installer

**Files:** none

- [ ] **Step 1: Run full suite**

Run:

```powershell
npm test
npm run typecheck
npm run build
```

Expected: all green, `✓ built`.

- [ ] **Step 2: Build the new MSI**

Run:

```powershell
npm run build:installer
```

Expected:

```text
Finished 1 bundle at:
        ...\\src-tauri\\target\\release\\bundle\\msi\\Punto_0.1.0_x64_en-US.msi
```

- [ ] **Step 3: Manual smoke test**

Uninstall the old Punto, install the new MSI, launch from Start Menu.

Verify:
- No console window or taskbar entry on launch.
- Tray icon menu shows Pause/Resume/Stop with descriptive labels and only relevant ones are enabled.
- Selecting a preset starts a Focus session; opening the dashboard from the tray shows the live `mm:ss` countdown decreasing.
- Pause stops the countdown but keeps the remaining time; Resume continues; Stop returns to `--:--` and Idle.
- Settings window is styled (cards, spaced grid form) — input fields are not on the same line.

- [ ] **Step 4: Commit any incidental fixes (if needed)**

```bash
git add -A
git commit -m "chore: post-install polish"
```

(Skip this commit if there are no changes.)

## Self-Review

Spec coverage:

- "Terminal opens": Task 1 sets `windows_subsystem = "windows"` for release builds, verified by reinstalling MSI.
- "Settings page is black and white": Task 5 introduces design tokens, light/dark surface, accent colors, card layout.
- "Inputs all on the same line": Task 5 uses `.preset-form` CSS grid with each field as its own row (`field:nth-of-type(1)` spans the full width, others sit in two columns).
- "Cannot see the timer": Task 2 + Task 3 expose a `TimerSnapshot` and emit `timer-tick` every second; Task 6 renders a big mm:ss countdown plus phase label and live tray icon.
- "Resume / pause / stop unclear": Task 4 retitles tray entries with descriptive parentheticals and disables irrelevant ones; Task 5/6 add tooltips and disable buttons that don't apply to the current phase.

Placeholder scan: No "TBD" / "TODO" / "implement later" / unspecified-edge-case steps.

Type consistency: `TimerSnapshot` field names (`phase`, `running`, `remaining_seconds`, `focus_minutes`, `break_minutes`) match exactly between Rust (`#[derive(Serialize)]` snake_case default) and TypeScript (`TimerSnapshot` interface). Tray menu IDs (`pause`, `resume`, `stop`, `stats`, `exit`, `preset:<uuid>`) consistent across `build_root_menu` and `handle_menu_event`. New commands `get_timer`, `start_preset`, `pause_timer`, `resume_timer`, `stop_timer` are all registered in `invoke_handler`.
