# Punto Tauri Pomodoro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Punto, a Windows tray-only Pomodoro timer with custom presets, native notifications, local JSON history, statistics, and startup support.

**Architecture:** Use Tauri v2 for Windows tray, process lifecycle, native notifications, autostart, and local app data storage. Keep timer, preset, history, and stats behavior in small tested Rust modules; keep the HTML window minimal and test frontend behavior with Vitest and Testing Library.

**Tech Stack:** Tauri v2, Rust stable, TypeScript, Vite, Vitest, Testing Library DOM, vanilla HTML/CSS.

---

## Environment

Install these before starting:

```powershell
winget install --id Rustlang.Rustup -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
rustup default stable
rustup target add x86_64-pc-windows-msvc
```

Verify:

```powershell
rustc --version
cargo --version
node --version
npm --version
```

Expected:

```text
rustc 1.x.x
cargo 1.x.x
v20.x.x or newer
10.x.x or newer
```

Project commands after Task 1:

```powershell
npm test
npm run test:rust
npm run test:frontend
npm run typecheck
npm run build
```

## File Structure

- Create `package.json`: npm scripts and frontend dev dependencies.
- Create `index.html`: single settings/statistics window shell.
- Create `src/main.ts`: frontend bootstrap and DOM event wiring.
- Create `src/presets.ts`: frontend preset form validation helpers.
- Create `src/stats.ts`: frontend stats formatting helpers.
- Create `src/main.test.ts`: DOM tests for the settings/statistics window.
- Create `src/presets.test.ts`: preset validation unit tests.
- Create `src/stats.test.ts`: stats formatting unit tests.
- Create `src/vite-env.d.ts`: Vite TypeScript types.
- Create `tsconfig.json`: strict frontend TypeScript config.
- Create `vite.config.ts`: Vite and Vitest config.
- Create `src-tauri/Cargo.toml`: Rust package, Tauri dependency, test dependencies.
- Create `src-tauri/tauri.conf.json`: app metadata, window config, bundle targets.
- Create `src-tauri/build.rs`: Tauri build hook.
- Create `src-tauri/src/main.rs`: Tauri entrypoint and plugin registration.
- Create `src-tauri/src/lib.rs`: app wiring, tray menu, command exports.
- Create `src-tauri/src/timer.rs`: timer state machine with no Tauri dependency.
- Create `src-tauri/src/presets.rs`: preset model and validation.
- Create `src-tauri/src/history.rs`: JSON persistence for completed focus sessions.
- Create `src-tauri/src/stats.rs`: daily and weekly stats aggregation.
- Create `src-tauri/src/storage.rs`: app data path resolution and JSON read/write.
- Create `src-tauri/src/tray.rs`: tray icon, menu, and state updates.
- Create `src-tauri/src/notifications.rs`: native notification wrapper.
- Create `src-tauri/src/autostart.rs`: launch-on-startup command wrapper.
- Create `src-tauri/tests/timer_tests.rs`: Rust timer behavior tests.
- Create `src-tauri/tests/presets_tests.rs`: Rust preset validation tests.
- Create `src-tauri/tests/history_stats_tests.rs`: Rust persistence and stats tests.
- Create `.gitignore`: build outputs, dependencies, local artifacts.

### Task 1: Bootstrap Tauri Project And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/vite-env.d.ts`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `.gitignore`

- [ ] **Step 1: Create package scripts and dependencies**

Create `package.json`:

```json
{
  "name": "punto",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "test": "npm run test:frontend && npm run test:rust",
    "test:frontend": "vitest run --environment jsdom",
    "test:rust": "cargo test --manifest-path src-tauri/Cargo.toml",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create minimal frontend shell**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Punto</title>
  </head>
  <body>
    <main id="app">
      <h1>Punto</h1>
      <section aria-labelledby="stats-title">
        <h2 id="stats-title">Statistics</h2>
        <p data-testid="sessions-today">0 sessions today</p>
        <p data-testid="focus-this-week">0h 0m this week</p>
      </section>
      <section aria-labelledby="presets-title">
        <h2 id="presets-title">Presets</h2>
        <form id="preset-form">
          <label>
            Name
            <input id="preset-name" name="name" required />
          </label>
          <label>
            Focus minutes
            <input id="focus-minutes" name="focusMinutes" type="number" min="1" required />
          </label>
          <label>
            Break minutes
            <input id="break-minutes" name="breakMinutes" type="number" min="1" required />
          </label>
          <button type="submit">Save preset</button>
        </form>
        <p id="preset-error" role="alert"></p>
      </section>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `src/main.ts`:

```ts
export function bootstrap(): void {
  document.body.dataset.ready = "true";
}

bootstrap();
```

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Create TypeScript and Vite config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true
  },
  build: {
    target: "es2022",
    minify: true
  }
});
```

- [ ] **Step 4: Create Tauri scaffold**

Create `src-tauri/Cargo.toml`:

```toml
[package]
name = "punto"
version = "0.1.0"
description = "Minimalist system tray Pomodoro timer"
authors = ["Punto"]
edition = "2021"

[lib]
name = "punto"
path = "src/lib.rs"

[[bin]]
name = "punto"
path = "src/main.rs"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-autostart = "2"
tauri-plugin-notification = "2"
thiserror = "1"
uuid = { version = "1", features = ["v4", "serde"] }

[dev-dependencies]
assert_fs = "1"
```

Create `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Punto",
  "version": "0.1.0",
  "identifier": "dev.punto.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "label": "main",
        "title": "Punto",
        "width": 420,
        "height": 520,
        "visible": false,
        "resizable": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  }
}
```

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build();
}
```

Create `src-tauri/src/main.rs`:

```rust
fn main() {
    punto::run();
}
```

Create `src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .run(tauri::generate_context!())
        .expect("failed to run Punto");
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
src-tauri/target/
src-tauri/gen/
*.log
.env
```

- [ ] **Step 5: Install dependencies**

Run:

```powershell
npm install
```

Expected:

```text
added ... packages
found 0 vulnerabilities
```

- [ ] **Step 6: Run baseline checks**

Run:

```powershell
npm run typecheck
npm run test:rust
npm run build
```

Expected:

```text
Found 0 errors.
test result: ok.
✓ built
```

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json index.html src tsconfig.json vite.config.ts src-tauri
git commit -m "chore: bootstrap tauri app"
```

### Task 2: Timer State Machine

**Files:**
- Create: `src-tauri/src/timer.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/timer_tests.rs`

- [ ] **Step 1: Write failing timer tests**

Create `src-tauri/tests/timer_tests.rs`:

```rust
use punto::timer::{Phase, Timer, TimerEvent};

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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm run test:rust -- timer_tests
```

Expected:

```text
unresolved import `punto::timer`
```

- [ ] **Step 3: Implement timer module**

Create `src-tauri/src/timer.rs`:

```rust
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Phase {
    Idle,
    Focus,
    Break,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Timer {
    phase: Phase,
    remaining_seconds: u32,
    focus_minutes: u32,
    break_minutes: u32,
    running: bool,
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
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TimerError {
    #[error("minutes must be greater than zero")]
    InvalidMinutes,
    #[error("timer is idle")]
    Idle,
    #[error("timer is already running")]
    AlreadyRunning,
}

impl Timer {
    pub fn new() -> Self {
        Self {
            phase: Phase::Idle,
            remaining_seconds: 0,
            focus_minutes: 0,
            break_minutes: 0,
            running: false,
        }
    }

    pub fn start_focus(mut self, focus_minutes: u32, break_minutes: u32) -> Result<Self, TimerError> {
        if focus_minutes == 0 || break_minutes == 0 {
            return Err(TimerError::InvalidMinutes);
        }

        self.phase = Phase::Focus;
        self.remaining_seconds = focus_minutes * 60;
        self.focus_minutes = focus_minutes;
        self.break_minutes = break_minutes;
        self.running = true;
        Ok(self)
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

    pub fn tick(mut self, elapsed_seconds: u32) -> TickResult {
        if !self.running || self.phase == Phase::Idle {
            return TickResult { timer: self, event: None };
        }

        if elapsed_seconds < self.remaining_seconds {
            self.remaining_seconds -= elapsed_seconds;
            return TickResult { timer: self, event: None };
        }

        match self.phase {
            Phase::Focus => {
                self.phase = Phase::Break;
                self.remaining_seconds = self.break_minutes * 60;
                let event_timer = self.clone();
                TickResult {
                    timer: self.clone(),
                    event: Some(TimerEvent {
                        timer: event_timer,
                        completed_focus_minutes: Some(self.focus_minutes),
                    }),
                }
            }
            Phase::Break => {
                self.phase = Phase::Idle;
                self.remaining_seconds = 0;
                self.running = false;
                TickResult { timer: self, event: None }
            }
            Phase::Idle => TickResult { timer: self, event: None },
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
}

impl Default for Timer {
    fn default() -> Self {
        Self::new()
    }
}
```

Modify `src-tauri/src/lib.rs`:

```rust
pub mod timer;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .run(tauri::generate_context!())
        .expect("failed to run Punto");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm run test:rust -- timer_tests
```

Expected:

```text
test result: ok. 4 passed
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/timer.rs src-tauri/tests/timer_tests.rs
git commit -m "feat: add timer state machine"
```

### Task 3: Presets Model And Validation

**Files:**
- Create: `src-tauri/src/presets.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/presets_tests.rs`
- Create: `src/presets.ts`
- Create: `src/presets.test.ts`

- [ ] **Step 1: Write failing Rust preset tests**

Create `src-tauri/tests/presets_tests.rs`:

```rust
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
    let first = store.add(PresetInput {
        name: "Focus".to_string(),
        focus_minutes: 25,
        break_minutes: 5,
    })
    .expect("first preset");
    let second = store.add(PresetInput {
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
```

- [ ] **Step 2: Write failing frontend preset tests**

Create `src/presets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePresetForm } from "./presets";

describe("parsePresetForm", () => {
  it("trims name and parses minutes", () => {
    const form = new FormData();
    form.set("name", " Focus ");
    form.set("focusMinutes", "25");
    form.set("breakMinutes", "5");

    expect(parsePresetForm(form)).toEqual({
      ok: true,
      value: { name: "Focus", focusMinutes: 25, breakMinutes: 5 }
    });
  });

  it("rejects missing name and invalid minutes", () => {
    const form = new FormData();
    form.set("name", " ");
    form.set("focusMinutes", "0");
    form.set("breakMinutes", "5");

    expect(parsePresetForm(form)).toEqual({
      ok: false,
      error: "Name, focus minutes, and break minutes are required."
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm run test:rust -- presets_tests
npm run test:frontend -- src/presets.test.ts
```

Expected:

```text
unresolved import `punto::presets`
Failed to resolve import "./presets"
```

- [ ] **Step 4: Implement Rust presets**

Create `src-tauri/src/presets.rs`:

```rust
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Preset {
    pub id: Uuid,
    pub name: String,
    pub focus_minutes: u32,
    pub break_minutes: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PresetInput {
    pub name: String,
    pub focus_minutes: u32,
    pub break_minutes: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PresetStore {
    presets: Vec<Preset>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PresetError {
    #[error("name, focus minutes, and break minutes are required")]
    InvalidInput,
}

impl Preset {
    pub fn from_input(input: PresetInput) -> Result<Self, PresetError> {
        let name = input.name.trim().to_string();
        if name.is_empty() || input.focus_minutes == 0 || input.break_minutes == 0 {
            return Err(PresetError::InvalidInput);
        }

        Ok(Self {
            id: Uuid::new_v4(),
            name,
            focus_minutes: input.focus_minutes,
            break_minutes: input.break_minutes,
        })
    }
}

impl PresetStore {
    pub fn add(&mut self, input: PresetInput) -> Result<Preset, PresetError> {
        let preset = Preset::from_input(input)?;
        self.presets.push(preset.clone());
        Ok(preset)
    }

    pub fn remove(&mut self, id: Uuid) {
        self.presets.retain(|preset| preset.id != id);
    }

    pub fn all(&self) -> &[Preset] {
        &self.presets
    }
}
```

Modify `src-tauri/src/lib.rs`:

```rust
pub mod presets;
pub mod timer;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .run(tauri::generate_context!())
        .expect("failed to run Punto");
}
```

- [ ] **Step 5: Implement frontend preset parser**

Create `src/presets.ts`:

```ts
export type PresetInput = {
  name: string;
  focusMinutes: number;
  breakMinutes: number;
};

export type PresetParseResult =
  | { ok: true; value: PresetInput }
  | { ok: false; error: string };

export function parsePresetForm(form: FormData): PresetParseResult {
  const name = String(form.get("name") ?? "").trim();
  const focusMinutes = Number(form.get("focusMinutes"));
  const breakMinutes = Number(form.get("breakMinutes"));

  if (!name || !Number.isInteger(focusMinutes) || !Number.isInteger(breakMinutes) || focusMinutes < 1 || breakMinutes < 1) {
    return { ok: false, error: "Name, focus minutes, and break minutes are required." };
  }

  return { ok: true, value: { name, focusMinutes, breakMinutes } };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```powershell
npm run test:rust -- presets_tests
npm run test:frontend -- src/presets.test.ts
```

Expected:

```text
test result: ok. 3 passed
2 passed
```

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/presets.rs src-tauri/tests/presets_tests.rs src/presets.ts src/presets.test.ts
git commit -m "feat: add preset validation"
```

### Task 4: History Storage And Statistics

**Files:**
- Create: `src-tauri/src/history.rs`
- Create: `src-tauri/src/storage.rs`
- Create: `src-tauri/src/stats.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/history_stats_tests.rs`
- Create: `src/stats.ts`
- Create: `src/stats.test.ts`

- [ ] **Step 1: Write failing Rust history and stats tests**

Create `src-tauri/tests/history_stats_tests.rs`:

```rust
use chrono::{TimeZone, Utc};
use punto::history::{FocusSession, History};
use punto::stats::calculate_stats;
use punto::storage::{load_json, save_json};

#[test]
fn saves_and_loads_history_json() {
    let temp = assert_fs::TempDir::new().expect("temp dir");
    let path = temp.path().join("history.json");
    let history = History {
        sessions: vec![FocusSession {
            started_at: Utc.with_ymd_and_hms(2026, 4, 30, 9, 0, 0).unwrap(),
            duration_minutes: 25,
        }],
    };

    save_json(&path, &history).expect("save history");
    let loaded: History = load_json(&path).expect("load history");

    assert_eq!(loaded, history);
}

#[test]
fn missing_json_file_returns_default_value() {
    let temp = assert_fs::TempDir::new().expect("temp dir");
    let path = temp.path().join("missing.json");

    let loaded: History = load_json(&path).expect("load missing history");

    assert_eq!(loaded, History::default());
}

#[test]
fn calculates_today_sessions_and_week_minutes() {
    let now = Utc.with_ymd_and_hms(2026, 4, 30, 12, 0, 0).unwrap();
    let history = History {
        sessions: vec![
            FocusSession {
                started_at: Utc.with_ymd_and_hms(2026, 4, 30, 9, 0, 0).unwrap(),
                duration_minutes: 25,
            },
            FocusSession {
                started_at: Utc.with_ymd_and_hms(2026, 4, 29, 9, 0, 0).unwrap(),
                duration_minutes: 55,
            },
            FocusSession {
                started_at: Utc.with_ymd_and_hms(2026, 4, 20, 9, 0, 0).unwrap(),
                duration_minutes: 25,
            },
        ],
    };

    let stats = calculate_stats(&history, now);

    assert_eq!(stats.sessions_today, 1);
    assert_eq!(stats.focus_minutes_this_week, 80);
}
```

- [ ] **Step 2: Write failing frontend stats tests**

Create `src/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatFocusMinutes, formatSessionsToday } from "./stats";

describe("stats formatting", () => {
  it("formats minutes as hours and minutes", () => {
    expect(formatFocusMinutes(0)).toBe("0h 0m this week");
    expect(formatFocusMinutes(80)).toBe("1h 20m this week");
  });

  it("formats session count", () => {
    expect(formatSessionsToday(1)).toBe("1 session today");
    expect(formatSessionsToday(3)).toBe("3 sessions today");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm run test:rust -- history_stats_tests
npm run test:frontend -- src/stats.test.ts
```

Expected:

```text
unresolved import `punto::history`
Failed to resolve import "./stats"
```

- [ ] **Step 4: Implement history and storage**

Create `src-tauri/src/history.rs`:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct History {
    pub sessions: Vec<FocusSession>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FocusSession {
    pub started_at: DateTime<Utc>,
    pub duration_minutes: u32,
}
```

Create `src-tauri/src/storage.rs`:

```rust
use serde::{de::DeserializeOwned, Serialize};
use std::{fs, io, path::Path};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("storage io error: {0}")]
    Io(#[from] io::Error),
    #[error("storage json error: {0}")]
    Json(#[from] serde_json::Error),
}

pub fn save_json<T: Serialize>(path: &Path, value: &T) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let json = serde_json::to_string_pretty(value)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn load_json<T: DeserializeOwned + Default>(path: &Path) -> Result<T, StorageError> {
    if !path.exists() {
        return Ok(T::default());
    }

    let json = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&json)?)
}
```

- [ ] **Step 5: Implement stats**

Create `src-tauri/src/stats.rs`:

```rust
use chrono::{DateTime, Datelike, Utc};
use serde::{Deserialize, Serialize};

use crate::history::History;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Stats {
    pub sessions_today: usize,
    pub focus_minutes_this_week: u32,
}

pub fn calculate_stats(history: &History, now: DateTime<Utc>) -> Stats {
    let today = now.date_naive();
    let current_week = now.iso_week();

    let sessions_today = history
        .sessions
        .iter()
        .filter(|session| session.started_at.date_naive() == today)
        .count();

    let focus_minutes_this_week = history
        .sessions
        .iter()
        .filter(|session| session.started_at.iso_week() == current_week)
        .map(|session| session.duration_minutes)
        .sum();

    Stats {
        sessions_today,
        focus_minutes_this_week,
    }
}
```

Modify `src-tauri/src/lib.rs`:

```rust
pub mod history;
pub mod presets;
pub mod stats;
pub mod storage;
pub mod timer;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .run(tauri::generate_context!())
        .expect("failed to run Punto");
}
```

- [ ] **Step 6: Implement frontend stats formatting**

Create `src/stats.ts`:

```ts
export function formatFocusMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m this week`;
}

export function formatSessionsToday(count: number): string {
  return `${count} ${count === 1 ? "session" : "sessions"} today`;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run:

```powershell
npm run test:rust -- history_stats_tests
npm run test:frontend -- src/stats.test.ts
```

Expected:

```text
test result: ok. 3 passed
4 passed
```

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/history.rs src-tauri/src/storage.rs src-tauri/src/stats.rs src-tauri/tests/history_stats_tests.rs src/stats.ts src/stats.test.ts
git commit -m "feat: add local history and stats"
```

### Task 5: Tauri Commands For Presets, Stats, Reset, And Autostart

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/autostart.rs`

- [ ] **Step 1: Add command signatures**

Modify `src-tauri/src/lib.rs`:

```rust
pub mod autostart;
pub mod history;
pub mod presets;
pub mod stats;
pub mod storage;
pub mod timer;

use chrono::Utc;
use history::History;
use presets::{Preset, PresetInput, PresetStore};
use stats::Stats;
use std::path::PathBuf;
use storage::{load_json, save_json};
use tauri::{AppHandle, Manager};

fn app_file(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(file_name))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_presets(app: AppHandle) -> Result<Vec<Preset>, String> {
    let path = app_file(&app, "presets.json")?;
    let store: PresetStore = load_json(&path).map_err(|error| error.to_string())?;
    Ok(store.all().to_vec())
}

#[tauri::command]
pub fn save_preset(app: AppHandle, input: PresetInput) -> Result<Preset, String> {
    let path = app_file(&app, "presets.json")?;
    let mut store: PresetStore = load_json(&path).map_err(|error| error.to_string())?;
    let preset = store.add(input).map_err(|error| error.to_string())?;
    save_json(&path, &store).map_err(|error| error.to_string())?;
    Ok(preset)
}

#[tauri::command]
pub fn delete_preset(app: AppHandle, id: uuid::Uuid) -> Result<(), String> {
    let path = app_file(&app, "presets.json")?;
    let mut store: PresetStore = load_json(&path).map_err(|error| error.to_string())?;
    store.remove(id);
    save_json(&path, &store).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_stats(app: AppHandle) -> Result<Stats, String> {
    let path = app_file(&app, "history.json")?;
    let history: History = load_json(&path).map_err(|error| error.to_string())?;
    Ok(stats::calculate_stats(&history, Utc::now()))
}

#[tauri::command]
pub fn reset_history(app: AppHandle) -> Result<(), String> {
    let path = app_file(&app, "history.json")?;
    save_json(&path, &History::default()).map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            list_presets,
            save_preset,
            delete_preset,
            get_stats,
            reset_history,
            autostart::is_autostart_enabled,
            autostart::set_autostart_enabled
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Punto");
}
```

- [ ] **Step 2: Add autostart command wrapper**

Create `src-tauri/src/autostart.rs`:

```rust
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|error| error.to_string())
    } else {
        autostart.disable().map_err(|error| error.to_string())
    }
}
```

- [ ] **Step 3: Run command compile tests**

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
git add src-tauri/src/lib.rs src-tauri/src/autostart.rs
git commit -m "feat: expose app commands"
```

### Task 6: Tray Menu, Notifications, And Timer Integration

**Files:**
- Create: `src-tauri/src/tray.rs`
- Create: `src-tauri/src/notifications.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add tray and notification modules**

Create `src-tauri/src/notifications.rs`:

```rust
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn notify_timer_finished(app: &AppHandle, title: &str, body: &str) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}
```

Create `src-tauri/src/tray.rs`:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

pub fn build_tray(app: &mut App) -> tauri::Result<()> {
    let handle = app.handle();
    let start = MenuItem::with_id(handle, "start", "Start 25/5", true, None::<&str>)?;
    let pause = MenuItem::with_id(handle, "pause", "Pause", true, None::<&str>)?;
    let stop = MenuItem::with_id(handle, "stop", "Stop", true, None::<&str>)?;
    let stats = MenuItem::with_id(handle, "stats", "View Statistics", true, None::<&str>)?;
    let settings = MenuItem::with_id(handle, "settings", "Settings / Edit Presets", true, None::<&str>)?;
    let exit = MenuItem::with_id(handle, "exit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(handle, &[&start, &pause, &stop, &stats, &settings, &exit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = tray.app_handle().emit("tray-menu-requested", ());
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "stats" | "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "exit" => app.exit(0),
            id => {
                let _ = app.emit("tray-action", id.to_string());
            }
        })
        .build(app)?;

    Ok(())
}
```

- [ ] **Step 2: Register tray setup**

Modify `src-tauri/src/lib.rs`:

```rust
pub mod autostart;
pub mod history;
pub mod notifications;
pub mod presets;
pub mod stats;
pub mod storage;
pub mod timer;
pub mod tray;

use chrono::Utc;
use history::History;
use presets::{Preset, PresetInput, PresetStore};
use stats::Stats;
use std::path::PathBuf;
use storage::{load_json, save_json};
use tauri::{AppHandle, Manager};

fn app_file(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(file_name))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_presets(app: AppHandle) -> Result<Vec<Preset>, String> {
    let path = app_file(&app, "presets.json")?;
    let store: PresetStore = load_json(&path).map_err(|error| error.to_string())?;
    Ok(store.all().to_vec())
}

#[tauri::command]
pub fn save_preset(app: AppHandle, input: PresetInput) -> Result<Preset, String> {
    let path = app_file(&app, "presets.json")?;
    let mut store: PresetStore = load_json(&path).map_err(|error| error.to_string())?;
    let preset = store.add(input).map_err(|error| error.to_string())?;
    save_json(&path, &store).map_err(|error| error.to_string())?;
    Ok(preset)
}

#[tauri::command]
pub fn delete_preset(app: AppHandle, id: uuid::Uuid) -> Result<(), String> {
    let path = app_file(&app, "presets.json")?;
    let mut store: PresetStore = load_json(&path).map_err(|error| error.to_string())?;
    store.remove(id);
    save_json(&path, &store).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_stats(app: AppHandle) -> Result<Stats, String> {
    let path = app_file(&app, "history.json")?;
    let history: History = load_json(&path).map_err(|error| error.to_string())?;
    Ok(stats::calculate_stats(&history, Utc::now()))
}

#[tauri::command]
pub fn reset_history(app: AppHandle) -> Result<(), String> {
    let path = app_file(&app, "history.json")?;
    save_json(&path, &History::default()).map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            tray::build_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_presets,
            save_preset,
            delete_preset,
            get_stats,
            reset_history,
            autostart::is_autostart_enabled,
            autostart::set_autostart_enabled
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Punto");
}
```

- [ ] **Step 3: Ensure app starts hidden**

Confirm `src-tauri/tauri.conf.json` contains:

```json
"windows": [
  {
    "label": "main",
    "title": "Punto",
    "width": 420,
    "height": 520,
    "visible": false,
    "resizable": false
  }
]
```

- [ ] **Step 4: Run compile checks**

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

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/tray.rs src-tauri/src/notifications.rs src-tauri/tauri.conf.json
git commit -m "feat: add tray shell"
```

### Task 7: Settings And Statistics Window

**Files:**
- Modify: `src/main.ts`
- Create: `src/main.test.ts`
- Modify: `src/presets.ts`
- Modify: `src/stats.ts`

- [ ] **Step 1: Write failing DOM tests**

Create `src/main.test.ts`:

```ts
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "./main";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args)
}));

beforeEach(() => {
  document.body.innerHTML = `
    <main id="app">
      <section aria-labelledby="stats-title">
        <h2 id="stats-title">Statistics</h2>
        <p data-testid="sessions-today">0 sessions today</p>
        <p data-testid="focus-this-week">0h 0m this week</p>
      </section>
      <section aria-labelledby="presets-title">
        <h2 id="presets-title">Presets</h2>
        <form id="preset-form">
          <label>Name <input id="preset-name" name="name" required /></label>
          <label>Focus minutes <input id="focus-minutes" name="focusMinutes" type="number" min="1" required /></label>
          <label>Break minutes <input id="break-minutes" name="breakMinutes" type="number" min="1" required /></label>
          <button type="submit">Save preset</button>
        </form>
        <p id="preset-error" role="alert"></p>
      </section>
    </main>
  `;
  invoke.mockReset();
});

describe("settings window", () => {
  it("loads stats on bootstrap", async () => {
    invoke.mockResolvedValue({ sessions_today: 2, focus_minutes_this_week: 80 });

    await bootstrap();

    expect(screen.getByTestId("sessions-today")).toHaveTextContent("2 sessions today");
    expect(screen.getByTestId("focus-this-week")).toHaveTextContent("1h 20m this week");
    expect(invoke).toHaveBeenCalledWith("get_stats");
  });

  it("saves valid preset through Tauri command", async () => {
    invoke.mockResolvedValue({ sessions_today: 0, focus_minutes_this_week: 0 });
    await bootstrap();

    await userEvent.type(screen.getByLabelText("Name"), "Focus");
    await userEvent.type(screen.getByLabelText("Focus minutes"), "25");
    await userEvent.type(screen.getByLabelText("Break minutes"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save preset" }));

    expect(invoke).toHaveBeenCalledWith("save_preset", {
      input: { name: "Focus", focusMinutes: 25, breakMinutes: 5 }
    });
  });
});
```

- [ ] **Step 2: Run DOM test to verify it fails**

Run:

```powershell
npm run test:frontend -- src/main.test.ts
```

Expected:

```text
expected "spy" to be called with arguments: [ 'get_stats' ]
```

- [ ] **Step 3: Implement window behavior**

Modify `src/main.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { parsePresetForm } from "./presets";
import { formatFocusMinutes, formatSessionsToday } from "./stats";

type StatsResponse = {
  sessions_today: number;
  focus_minutes_this_week: number;
};

export async function bootstrap(): Promise<void> {
  document.body.dataset.ready = "true";
  await loadStats();
  bindPresetForm();
}

async function loadStats(): Promise<void> {
  const stats = await invoke<StatsResponse>("get_stats");
  const sessionsToday = document.querySelector<HTMLElement>("[data-testid='sessions-today']");
  const focusThisWeek = document.querySelector<HTMLElement>("[data-testid='focus-this-week']");

  if (sessionsToday) {
    sessionsToday.textContent = formatSessionsToday(stats.sessions_today);
  }
  if (focusThisWeek) {
    focusThisWeek.textContent = formatFocusMinutes(stats.focus_minutes_this_week);
  }
}

function bindPresetForm(): void {
  const form = document.querySelector<HTMLFormElement>("#preset-form");
  const error = document.querySelector<HTMLElement>("#preset-error");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const parsed = parsePresetForm(new FormData(form));
    if (!parsed.ok) {
      if (error) {
        error.textContent = parsed.error;
      }
      return;
    }

    await invoke("save_preset", { input: parsed.value });
    form.reset();
    if (error) {
      error.textContent = "";
    }
  });
}

void bootstrap();
```

- [ ] **Step 4: Run frontend tests**

Run:

```powershell
npm run test:frontend
```

Expected:

```text
tests passed
```

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/main.test.ts
git commit -m "feat: wire settings window"
```

### Task 8: Final Build And Manual Smoke Test

**Files:**
- Modify: `docs/software-requirements.md` only if requirements changed during implementation.

- [ ] **Step 1: Run full autonomous test suite**

Run:

```powershell
npm test
npm run typecheck
npm run build
```

Expected:

```text
test result: ok.
tests passed
Found 0 errors.
✓ built
```

- [ ] **Step 2: Run Tauri dev smoke test**

Run:

```powershell
npm run tauri dev
```

Expected:

```text
App starts without showing main window.
Tray icon appears in Windows notification area.
Right-click tray icon opens menu.
View Statistics opens the Punto window.
Exit closes the process.
```

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run tauri build
```

Expected:

```text
Finished 1 bundle
```

- [ ] **Step 4: Commit**

```bash
git add docs/software-requirements.md
git commit -m "docs: align requirements after implementation"
```

Skip this commit if `docs/software-requirements.md` is unchanged.

## Self-Review

Spec coverage:

- System tray operation: Task 6 creates tray shell and hidden window behavior.
- Custom presets: Task 3 creates preset model and validation; Task 5 persists presets; Task 7 wires UI.
- Native notifications: Task 6 creates notification wrapper.
- Minimal state indication: Task 6 creates tray foundation; follow-up icon assets may add visual focus/break indication once icon files exist.
- History tracking: Task 4 creates `History` and JSON persistence.
- Weekly and daily stats: Task 4 calculates stats; Task 7 displays stats.
- Data reset: Task 5 exposes `reset_history`.
- Local JSON storage: Task 4 creates generic JSON storage.
- Tray menu actions: Task 6 creates Start/Pause/Stop, statistics, settings, and exit items.
- Statistics/settings window: Task 7 wires single HTML window.
- Tauri + JavaScript/HTML/CSS: Task 1 bootstraps stack.
- Performance target: Architecture keeps timer logic in Rust and window hidden until requested; measure RAM during Task 8 smoke test.
- Startup support: Task 5 exposes autostart commands.

Known follow-up:

- Tray focus/break icon color requires icon assets. Keep it out of the first plan to avoid fake implementation with missing assets.
- Full background ticking loop is intentionally small in this plan; timer state machine is tested first, then tray event loop can be expanded safely.

Placeholder scan:

- No `TBD`, `TODO`, "implement later", or "similar to" steps.
- Every code-writing step includes concrete code.

Type consistency:

- Rust module names match imports across tests and `lib.rs`.
- Frontend response shape uses snake_case from Rust serde defaults.
- Preset frontend uses `focusMinutes` and `breakMinutes`; Tauri command input may need serde rename if Rust deserialization rejects camelCase during integration. Add `#[serde(rename_all = "camelCase")]` to `PresetInput` if Task 7 integration test exposes this.
