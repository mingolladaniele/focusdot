import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTimerSnapshot,
  bootstrap,
  mainActionFor,
  shouldRefreshStatsAfterTick,
  showsStop,
  type TimerSnapshot
} from "./main";

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
      <header class="topbar">
        <div class="brand">
          <span class="brand-dot" data-testid="brand-dot"></span>
          <h1>focusdot</h1>
        </div>
        <span class="status-pill" data-testid="status-pill" data-phase="Idle">
          <span class="status-pulse" aria-hidden="true"></span>
          <span class="status-text">Idle</span>
        </span>
      </header>
      <section class="card timer-card">
        <div class="section-head">
          <h2 id="timer-title">Current session</h2>
          <p class="phase" data-testid="timer-phase">Idle</p>
        </div>
        <p class="time" data-testid="timer-display">--:--</p>
        <div class="rail" aria-hidden="true"><div class="rail-fill" style="width:0%"></div></div>
        <div class="controls">
          <button type="button" id="btn-main" data-testid="btn-main" class="btn btn-primary btn-main">
            <span class="btn-icon" aria-hidden="true"></span>
            <span class="btn-label">Start</span>
          </button>
          <button type="button" id="btn-stop" data-testid="btn-stop" class="btn-link btn-stop" hidden>Stop</button>
        </div>
        <div class="preset-chips" data-testid="preset-chips"></div>
      </section>
      <section class="card stats-card" aria-labelledby="stats-title">
        <div class="section-head">
          <h2 id="stats-title">Statistics</h2>
          <button type="button" id="reset-history" class="btn-link-danger">Reset</button>
        </div>
        <div class="stats-grid">
          <div class="stat-tile">
            <span class="stat-value" data-testid="sessions-today">0</span>
            <span class="stat-label">Sessions today</span>
          </div>
          <div class="stat-tile">
            <span class="stat-value" data-testid="focus-today">0m</span>
            <span class="stat-label">Focus today</span>
          </div>
          <div class="stat-tile">
            <span class="stat-value" data-testid="streak-days">—</span>
            <span class="stat-label">Day streak</span>
          </div>
          <div class="stat-tile">
            <span class="stat-value" data-testid="focus-this-week">0h 0m</span>
            <span class="stat-label">This week</span>
          </div>
          <div class="stat-tile">
            <span class="stat-value" data-testid="focus-this-month">0h 0m</span>
            <span class="stat-label">This month</span>
          </div>
          <div class="stat-tile">
            <span class="stat-value" data-testid="focus-this-year">0h 0m</span>
            <span class="stat-label">This year</span>
          </div>
        </div>
      </section>
      <section class="card collapsible-card" aria-labelledby="settings-title">
        <details class="collapsible" data-testid="settings-section">
          <summary class="collapsible-trigger section-head">
            <h2 id="settings-title">Settings</h2>
          </summary>
          <div class="collapsible-body">
            <div class="toggle-list">
              <label class="toggle">
                <span class="toggle-text">
                  <span class="toggle-label">Auto-start next focus after break</span>
                  <span class="toggle-hint">When off, the timer stops after each break until you start again; you can still press Start focus now during a break to continue a multi-cycle plan.</span>
                </span>
                <span class="switch">
                  <input type="checkbox" id="auto-start-next-focus" />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </span>
              </label>
              <label class="toggle">
                <span class="toggle-text">
                  <span class="toggle-label">Overtime tracking</span>
                  <span class="toggle-hint">When a focus block ends, keep counting extra time until you press Stop.</span>
                </span>
                <span class="switch">
                  <input type="checkbox" id="overtime-tracking" />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </span>
              </label>
              <label class="toggle">
                <span class="toggle-text">
                  <span class="toggle-label">Session notifications</span>
                  <span class="toggle-hint">Desktop alerts when a focus or break block ends.</span>
                </span>
                <span class="switch">
                  <input type="checkbox" id="notifications-enabled" />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </span>
              </label>
              <label class="toggle">
                <span class="toggle-text">
                  <span class="toggle-label">Launch on Windows startup</span>
                  <span class="toggle-hint">Open focusdot when you sign in.</span>
                </span>
                <span class="switch">
                  <input type="checkbox" id="launch-startup" />
                  <span class="switch-track"><span class="switch-thumb"></span></span>
                </span>
              </label>
            </div>
          </div>
        </details>
      </section>
      <section class="card collapsible-card" aria-labelledby="presets-title">
        <details class="collapsible" data-testid="presets-section">
          <summary class="collapsible-trigger section-head">
            <h2 id="presets-title">Presets</h2>
          </summary>
          <div class="collapsible-body">
            <ul id="preset-list" data-testid="preset-list"></ul>
            <form id="preset-form">
              <input type="hidden" id="preset-id" name="presetId" value="" />
              <label class="field" for="preset-name"><span>Name</span>
                <input id="preset-name" name="name" required /></label>
              <label class="field" for="focus-minutes"><span>Focus minutes</span>
                <input id="focus-minutes" name="focusMinutes" type="number" min="1" required /></label>
              <label class="field" for="break-minutes"><span>Break minutes</span>
                <input id="break-minutes" name="breakMinutes" type="number" min="1" required /></label>
              <label class="field" for="cycles"><span>Cycles</span>
                <input id="cycles" name="cycles" type="number" min="1" value="1" /></label>
              <button class="btn btn-primary" type="submit" id="preset-submit">Save preset</button>
              <button type="button" class="btn btn-link" id="preset-cancel-edit" hidden>Cancel edit</button>
            </form>
            <p id="preset-error" class="error" role="alert"></p>
          </div>
        </details>
      </section>
    </main>
  `;
  invoke.mockReset();
  listen.mockReset();
  listen.mockResolvedValue(() => {});
});

describe("shouldRefreshStatsAfterTick", () => {
  const focusSnap = (): TimerSnapshot => ({
    phase: "Focus",
    running: true,
    remaining_seconds: 60,
    focus_minutes: 25,
    break_minutes: 5,
    cycles_remaining: 0,
    auto_start_next: false,
    overtime_seconds: 0
  });

  const breakSnap = (): TimerSnapshot => ({
    phase: "Break",
    running: true,
    remaining_seconds: 300,
    focus_minutes: 25,
    break_minutes: 5,
    cycles_remaining: 0,
    auto_start_next: false,
    overtime_seconds: 0
  });

  it("returns true when previous Focus or Overtime and payload Break", () => {
    expect(shouldRefreshStatsAfterTick("Focus", breakSnap())).toBe(true);
    expect(shouldRefreshStatsAfterTick("Overtime", breakSnap())).toBe(true);
    expect(shouldRefreshStatsAfterTick(undefined, breakSnap())).toBe(false);
    expect(shouldRefreshStatsAfterTick("Focus", focusSnap())).toBe(false);
    expect(shouldRefreshStatsAfterTick("Break", focusSnap())).toBe(false);
    expect(shouldRefreshStatsAfterTick("Idle", focusSnap())).toBe(false);
  });
});

describe("overtime UI", () => {
  it("shows +MM:SS and Overtime label during overtime", () => {
    applyTimerSnapshot({
      phase: "Overtime",
      running: true,
      remaining_seconds: 0,
      focus_minutes: 25,
      break_minutes: 5,
      cycles_remaining: 0,
      auto_start_next: false,
      overtime_seconds: 125
    });

    expect(screen.getByTestId("timer-phase").textContent).toBe("Overtime");
    expect(screen.getByTestId("timer-display").textContent).toBe("+02:05");
    expect(screen.getByTestId("brand-dot").getAttribute("data-phase")).toBe("Overtime");
    expect(screen.getByTestId("btn-main").textContent?.trim()).toBe("Finish focus");
    expect((screen.getByTestId("btn-stop") as HTMLButtonElement).hidden).toBe(true);
  });

  it("refreshes stats when overtime ends into break", () => {
    expect(shouldRefreshStatsAfterTick("Overtime", {
      phase: "Break",
      running: true,
      remaining_seconds: 300,
      focus_minutes: 25,
      break_minutes: 5,
      cycles_remaining: 0,
      auto_start_next: false,
      overtime_seconds: 0
    })).toBe(true);
  });
});

describe("dashboard layout", () => {
  it("places statistics immediately after the timer", () => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main#app > section"));
    const timerIdx = sections.findIndex((s) => s.classList.contains("timer-card"));
    const statsIdx = sections.findIndex((s) => s.classList.contains("stats-card"));
    expect(timerIdx).toBeGreaterThanOrEqual(0);
    expect(statsIdx).toBe(timerIdx + 1);
  });

  it("keeps settings and presets collapsed by default", () => {
    const settings = screen.getByTestId("settings-section") as HTMLDetailsElement;
    const presets = screen.getByTestId("presets-section") as HTMLDetailsElement;
    expect(settings.open).toBe(false);
    expect(presets.open).toBe(false);
  });

  it("expands settings section when summary is clicked", async () => {
    const settings = screen.getByTestId("settings-section") as HTMLDetailsElement;
    await userEvent.click(settings.querySelector("summary")!);
    expect(settings.open).toBe(true);
  });
});

describe("settings window", () => {
  it("renders mm:ss countdown and phase from snapshot", () => {
    applyTimerSnapshot({
      phase: "Focus",
      running: true,
      remaining_seconds: 125,
      focus_minutes: 25,
      break_minutes: 5,
      cycles_remaining: 0,
      auto_start_next: false,
      overtime_seconds: 0
    });

    expect(screen.getByTestId("timer-phase").textContent).toBe("Focus session");
    expect(screen.getByTestId("timer-display").textContent).toBe("02:05");
    expect(screen.getByTestId("brand-dot").getAttribute("data-phase")).toBe("Focus");
    expect(screen.getByTestId("btn-main").textContent?.trim()).toBe("Pause");
  });

  it("offers Start focus now during a break with cycles left", () => {
    applyTimerSnapshot({
      phase: "Break",
      running: true,
      remaining_seconds: 300,
      focus_minutes: 25,
      break_minutes: 5,
      cycles_remaining: 1,
      auto_start_next: true,
      overtime_seconds: 0
    });

    expect(screen.getByTestId("btn-main").textContent?.trim()).toBe("Start focus now");
    expect((screen.getByTestId("btn-stop") as HTMLButtonElement).hidden).toBe(false);
  });

  it("updates status pill and progress rail from snapshot", () => {
    document.body.innerHTML = `
    <main id="app">
      <span class="brand-dot" data-testid="brand-dot"></span>
      <span class="status-pill" data-testid="status-pill"><span class="status-text">Idle</span></span>
      <section class="card timer-card">
        <p class="phase" data-testid="timer-phase">Idle</p>
        <p class="time" data-testid="timer-display">--:--</p>
        <div class="rail"><div class="rail-fill" style="width:0%"></div></div>
        <button data-testid="btn-main"><span class="btn-label"></span></button>
        <button data-testid="btn-stop"></button>
      </section>
    </main>`;

    applyTimerSnapshot({
      phase: "Focus",
      running: true,
      remaining_seconds: 750,
      focus_minutes: 25,
      break_minutes: 5,
      cycles_remaining: 0,
      auto_start_next: false,
      overtime_seconds: 0
    });

    const pill = screen.getByTestId("status-pill");
    const rail = document.querySelector<HTMLElement>(".timer-card .rail-fill");
    const statusText = pill.querySelector(".status-text");
    expect(pill.getAttribute("data-phase")).toBe("Focus");
    expect(statusText?.textContent).toBe("Focus");
    expect(rail?.style.width).toBe("50%");
  });

  it("invokes pause_timer when Pause is clicked", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        return Promise.resolve({
          sessionsToday: 0,
          focusMinutesToday: 0,
          focusMinutesThisWeek: 0,
          focusMinutesThisMonth: 0,
          focusMinutesThisYear: 0,
          currentStreakDays: 0
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({
          autoStartNextFocusAfterBreak: false,
          notificationsEnabled: true,
          overtimeTrackingEnabled: false
        });
      }
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Focus",
          running: true,
          remaining_seconds: 60,
          focus_minutes: 25,
          break_minutes: 5,
          cycles_remaining: 0,
          auto_start_next: false,
          overtime_seconds: 0
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();
    await userEvent.click(screen.getByTestId("btn-main"));

    expect(invoke).toHaveBeenCalledWith("pause_timer");
  });

  it("invokes skip_break when End break is clicked", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        return Promise.resolve({
          sessionsToday: 0,
          focusMinutesToday: 0,
          focusMinutesThisWeek: 0,
          focusMinutesThisMonth: 0,
          focusMinutesThisYear: 0,
          currentStreakDays: 0
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({
          autoStartNextFocusAfterBreak: false,
          notificationsEnabled: true,
          overtimeTrackingEnabled: false
        });
      }
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Break",
          running: true,
          remaining_seconds: 300,
          focus_minutes: 25,
          break_minutes: 5,
          cycles_remaining: 0,
          auto_start_next: false,
          overtime_seconds: 0
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();
    expect(screen.getByTestId("btn-main").textContent?.trim()).toBe("End break");
    await userEvent.click(screen.getByTestId("btn-main"));

    expect(invoke).toHaveBeenCalledWith("skip_break");
  });

  it("loads stats on bootstrap", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        return Promise.resolve({
          sessionsToday: 2,
          focusMinutesToday: 50,
          focusMinutesThisWeek: 80,
          focusMinutesThisMonth: 320,
          focusMinutesThisYear: 1500,
          currentStreakDays: 3
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({
          autoStartNextFocusAfterBreak: false,
          notificationsEnabled: true,
          overtimeTrackingEnabled: false
        });
      }
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Idle",
          running: false,
          remaining_seconds: 0,
          focus_minutes: 0,
          break_minutes: 0,
          cycles_remaining: 0,
          auto_start_next: false,
          overtime_seconds: 0
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();

    expect(screen.getByTestId("sessions-today").textContent).toBe("2");
    expect(screen.getByTestId("focus-today").textContent).toBe("50m");
    expect(screen.getByTestId("streak-days").textContent).toBe("3");
    expect(screen.getByTestId("focus-this-week").textContent).toBe("1h 20m");
    expect(screen.getByTestId("focus-this-month").textContent).toBe("5h 20m");
    expect(screen.getByTestId("focus-this-year").textContent).toBe("25h");
    expect(invoke).toHaveBeenCalledWith("get_stats");
  });

  it("does not refresh stats on arbitrary timer-tick (same phase)", async () => {
    let tickCb: ((e: { payload: unknown }) => void | Promise<void>) | undefined;
    listen.mockImplementation((event: string, cb: typeof tickCb) => {
      if (event === "timer-tick") tickCb = cb;
      return Promise.resolve(() => {});
    });

    let statsCalls = 0;
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        statsCalls += 1;
        return Promise.resolve({
          sessionsToday: 1,
          focusMinutesToday: 25,
          focusMinutesThisWeek: 25,
          focusMinutesThisMonth: 0,
          focusMinutesThisYear: 0,
          currentStreakDays: 1
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({
          autoStartNextFocusAfterBreak: false,
          notificationsEnabled: true,
          overtimeTrackingEnabled: false
        });
      }
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Break",
          running: true,
          remaining_seconds: 300,
          focus_minutes: 25,
          break_minutes: 5,
          cycles_remaining: 0,
          auto_start_next: false,
          overtime_seconds: 0
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();
    const afterBootstrap = statsCalls;

    await tickCb?.({
      payload: {
        phase: "Break",
        running: true,
        remaining_seconds: 299,
        focus_minutes: 25,
        break_minutes: 5,
        cycles_remaining: 0,
        auto_start_next: false,
        overtime_seconds: 0
      }
    });

    expect(statsCalls).toBe(afterBootstrap);
  });

  it("refreshes stats when timer-tick shows focus completed (Focus → Break)", async () => {
    let tickCb: ((e: { payload: unknown }) => void | Promise<void>) | undefined;
    listen.mockImplementation((event: string, cb: typeof tickCb) => {
      if (event === "timer-tick") tickCb = cb;
      return Promise.resolve(() => {});
    });

    let statsCalls = 0;
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        statsCalls += 1;
        return Promise.resolve({
          sessionsToday: 2,
          focusMinutesToday: 50,
          focusMinutesThisWeek: 50,
          focusMinutesThisMonth: 0,
          focusMinutesThisYear: 0,
          currentStreakDays: 2
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({
          autoStartNextFocusAfterBreak: false,
          notificationsEnabled: true,
          overtimeTrackingEnabled: false
        });
      }
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Focus",
          running: true,
          remaining_seconds: 1,
          focus_minutes: 25,
          break_minutes: 5,
          cycles_remaining: 0,
          auto_start_next: false,
          overtime_seconds: 0
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();
    const afterBootstrap = statsCalls;

    await tickCb?.({
      payload: {
        phase: "Break",
        running: true,
        remaining_seconds: 300,
        focus_minutes: 25,
        break_minutes: 5,
        cycles_remaining: 0,
        auto_start_next: false,
        overtime_seconds: 0
      }
    });

    expect(statsCalls).toBeGreaterThan(afterBootstrap);
    expect(screen.getByTestId("sessions-today").textContent).toBe("2");
    expect(screen.getByTestId("focus-today").textContent).toBe("50m");
  });

  it("saves valid preset through Tauri command", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        return Promise.resolve({
          sessionsToday: 0,
          focusMinutesToday: 0,
          focusMinutesThisWeek: 0,
          focusMinutesThisMonth: 0,
          focusMinutesThisYear: 0,
          currentStreakDays: 0
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({
          autoStartNextFocusAfterBreak: false,
          notificationsEnabled: true,
          overtimeTrackingEnabled: false
        });
      }
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Idle",
          running: false,
          remaining_seconds: 0,
          focus_minutes: 0,
          break_minutes: 0,
          cycles_remaining: 0,
          auto_start_next: false,
          overtime_seconds: 0
        });
      }
      return Promise.resolve(undefined);
    });
    await bootstrap();

    await userEvent.type(screen.getByLabelText("Name"), "Focus");
    await userEvent.type(screen.getByLabelText("Focus minutes"), "25");
    await userEvent.type(screen.getByLabelText("Break minutes"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save preset" }));

    expect(invoke).toHaveBeenCalledWith("save_preset", {
      input: {
        name: "Focus",
        focusMinutes: 25,
        breakMinutes: 5,
        cycles: 1
      }
    });
  });

  it("invokes set_notifications_enabled when session notifications toggle changes", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        return Promise.resolve({
          sessionsToday: 0,
          focusMinutesToday: 0,
          focusMinutesThisWeek: 0,
          focusMinutesThisMonth: 0,
          focusMinutesThisYear: 0,
          currentStreakDays: 0
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({
          autoStartNextFocusAfterBreak: false,
          notificationsEnabled: true,
          overtimeTrackingEnabled: false
        });
      }
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Idle",
          running: false,
          remaining_seconds: 0,
          focus_minutes: 0,
          break_minutes: 0,
          cycles_remaining: 0,
          auto_start_next: false,
          overtime_seconds: 0
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();

    const cb = document.querySelector<HTMLInputElement>("#notifications-enabled")!;
    cb.checked = false;
    cb.dispatchEvent(new Event("change", { bubbles: true }));

    expect(invoke).toHaveBeenCalledWith("set_notifications_enabled", { enabled: false });
  });
});

describe("friction removal", () => {
  const idleSnap: TimerSnapshot = {
    phase: "Idle",
    running: false,
    remaining_seconds: 0,
    focus_minutes: 0,
    break_minutes: 0,
    cycles_remaining: 0,
    total_cycles: 0,
    auto_start_next: false,
    overtime_seconds: 0
  };
  const focusSnap: TimerSnapshot = { ...idleSnap, phase: "Focus", running: true, remaining_seconds: 60, focus_minutes: 25 };
  const pomodoro = { id: "p1", name: "Pomodoro", focusMinutes: 25, breakMinutes: 5, cycles: 1 };
  const deep = { id: "p2", name: "Deep work", focusMinutes: 50, breakMinutes: 10, cycles: 1 };

  function mockBackend(overrides: Record<string, unknown> = {}): void {
    const responses: Record<string, unknown> = {
      get_stats: {
        sessionsToday: 0,
        focusMinutesToday: 0,
        focusMinutesThisWeek: 0,
        focusMinutesThisMonth: 0,
        focusMinutesThisYear: 0,
        currentStreakDays: 0
      },
      list_presets: [pomodoro, deep],
      get_quick_start_preset: pomodoro,
      get_app_settings: {
        autoStartNextFocusAfterBreak: false,
        notificationsEnabled: true,
        overtimeTrackingEnabled: false
      },
      is_autostart_enabled: false,
      get_timer: idleSnap,
      ...overrides
    };
    invoke.mockImplementation((cmd: string) => Promise.resolve(responses[cmd]));
  }

  const mainLabel = (): string | undefined => screen.getByTestId("btn-main").textContent?.trim();
  const stopHidden = (): boolean => (screen.getByTestId("btn-stop") as HTMLButtonElement).hidden;

  it("idle: one Start for the last preset, chips for the others, no Stop", async () => {
    mockBackend();
    await bootstrap();

    expect(mainLabel()).toBe("Start Pomodoro");
    expect(screen.getByTestId("timer-display").textContent).toBe("25:00");
    expect(screen.getByTestId("timer-phase").textContent).toBe("Ready · Pomodoro");
    expect(stopHidden()).toBe(true);

    const chips = screen.getByTestId("preset-chips");
    expect(chips.hidden).toBe(false);
    const labels = Array.from(chips.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual(["Deep work50/10", "+ New preset"]);

    await userEvent.click(screen.getByTestId("btn-main"));
    expect(invoke).toHaveBeenCalledWith("quick_start");
  });

  it("starts another preset from its chip in one click", async () => {
    mockBackend();
    await bootstrap();
    await userEvent.click(screen.getByRole("button", { name: /Deep work/ }));
    expect(invoke).toHaveBeenCalledWith("start_preset", { id: "p2" });
  });

  it("+ New preset opens the manage section", async () => {
    mockBackend();
    await bootstrap();
    await userEvent.click(screen.getByRole("button", { name: "+ New preset" }));
    expect((screen.getByTestId("presets-section") as HTMLDetailsElement).open).toBe(true);
    expect(document.activeElement?.id).toBe("preset-name");
  });

  it("main button is the only action that changes per state", () => {
    expect(mainActionFor(focusSnap, pomodoro)?.command).toBe("pause_timer");
    expect(mainActionFor({ ...focusSnap, running: false }, pomodoro)?.command).toBe("resume_timer");
    expect(mainActionFor({ ...focusSnap, phase: "Overtime" }, pomodoro)?.command).toBe("stop_timer");
    expect(mainActionFor({ ...focusSnap, phase: "Break", cycles_remaining: 1 }, pomodoro)?.label).toBe("Start focus now");
    expect(mainActionFor({ ...focusSnap, phase: "Break", auto_start_next: true, total_cycles: 1 }, pomodoro)?.label).toBe(
      "Start focus now"
    );
    expect(mainActionFor({ ...focusSnap, phase: "Break", total_cycles: 1 }, pomodoro)?.label).toBe("End break");
    expect(mainActionFor(idleSnap, null)).toBeNull();
  });

  it("Stop shows only where it differs from the main action", () => {
    expect(showsStop(idleSnap)).toBe(false);
    expect(showsStop(focusSnap)).toBe(true);
    expect(showsStop({ ...focusSnap, running: false })).toBe(true);
    expect(showsStop({ ...focusSnap, phase: "Overtime" })).toBe(false);
    expect(showsStop({ ...focusSnap, phase: "Break", cycles_remaining: 1 })).toBe(true);
    expect(showsStop({ ...focusSnap, phase: "Break", total_cycles: 1 })).toBe(false);
  });

  it("during focus: Pause plus Stop, chips hidden", async () => {
    mockBackend();
    await bootstrap();
    applyTimerSnapshot(focusSnap);

    expect(mainLabel()).toBe("Pause");
    expect(stopHidden()).toBe(false);
    expect(screen.getByTestId("preset-chips").hidden).toBe(true);

    await userEvent.click(screen.getByTestId("btn-stop"));
    expect(invoke).toHaveBeenCalledWith("stop_timer");
  });

  it("ignores a second main click right after the first", async () => {
    mockBackend({ get_timer: focusSnap });
    await bootstrap();
    const main = screen.getByTestId("btn-main");
    main.click();
    main.click();
    await Promise.resolve();
    expect(invoke.mock.calls.filter(([cmd]) => cmd === "pause_timer")).toHaveLength(1);
  });

  it("requires a second click to reset history", async () => {
    mockBackend();
    await bootstrap();
    const reset = document.querySelector<HTMLButtonElement>("#reset-history")!;

    await userEvent.click(reset);
    expect(invoke).not.toHaveBeenCalledWith("reset_history");
    expect(reset.classList.contains("is-armed")).toBe(true);
    expect(reset.textContent).toBe("Delete all history?");

    await userEvent.click(reset);
    expect(invoke).toHaveBeenCalledWith("reset_history");
    expect(reset.textContent).toBe("Reset");
  });

  it("disarms a confirm button after a few seconds", async () => {
    vi.useFakeTimers();
    try {
      mockBackend();
      await bootstrap();
      const reset = document.querySelector<HTMLButtonElement>("#reset-history")!;
      reset.click();
      expect(reset.classList.contains("is-armed")).toBe(true);
      vi.advanceTimersByTime(3500);
      expect(reset.classList.contains("is-armed")).toBe(false);
      reset.click();
      expect(invoke).not.toHaveBeenCalledWith("reset_history");
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires a second click to delete a preset", async () => {
    mockBackend();
    await bootstrap();
    const del = screen.getAllByRole("button", { name: "Delete preset" })[0];

    await userEvent.click(del);
    expect(invoke).not.toHaveBeenCalledWith("delete_preset", { id: "p1" });
    await userEvent.click(del);
    expect(invoke).toHaveBeenCalledWith("delete_preset", { id: "p1" });
  });

  it("shows the current cycle for multi-cycle presets", () => {
    applyTimerSnapshot({ ...focusSnap, total_cycles: 4, cycles_remaining: 2 });
    expect(screen.getByTestId("timer-phase").textContent).toBe("Focus session · 2 of 4");
  });
});
