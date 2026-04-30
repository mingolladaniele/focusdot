import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTimerSnapshot,
  bootstrap,
  shouldRefreshStatsAfterTick,
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
        <span class="brand-dot" data-testid="brand-dot"></span>
      </header>
      <section class="card timer-card">
        <p class="phase" data-testid="timer-phase">Idle</p>
        <p class="time" data-testid="timer-display">--:--</p>
        <div class="controls">
          <button id="btn-pause" data-testid="btn-pause">Pause</button>
          <button id="btn-resume" data-testid="btn-resume">Resume</button>
          <button id="btn-stop" data-testid="btn-stop">Stop</button>
        </div>
      </section>
      <section class="card">
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
          <button class="primary" type="submit" id="preset-submit">Save preset</button>
          <button type="button" id="preset-cancel-edit" hidden>Cancel edit</button>
        </form>
        <p id="preset-error" class="error" role="alert"></p>
      </section>
      <section class="card stats-card">
        <div class="stats-grid">
          <span class="stat-value" data-testid="sessions-today">0</span>
          <span class="stat-value" data-testid="focus-today">0m</span>
          <span class="stat-value" data-testid="streak-days">—</span>
          <span class="stat-value" data-testid="focus-this-week">0h 0m</span>
        </div>
        <button type="button" id="reset-history">Reset</button>
      </section>
      <section class="card">
        <input type="checkbox" id="auto-start-next-focus" />
        <input type="checkbox" id="launch-startup" />
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
    auto_start_next: false
  });

  const breakSnap = (): TimerSnapshot => ({
    phase: "Break",
    running: true,
    remaining_seconds: 300,
    focus_minutes: 25,
    break_minutes: 5,
    cycles_remaining: 0,
    auto_start_next: false
  });

  it("returns true only when previous Focus and payload Break", () => {
    expect(shouldRefreshStatsAfterTick("Focus", breakSnap())).toBe(true);
    expect(shouldRefreshStatsAfterTick(undefined, breakSnap())).toBe(false);
    expect(shouldRefreshStatsAfterTick("Focus", focusSnap())).toBe(false);
    expect(shouldRefreshStatsAfterTick("Break", focusSnap())).toBe(false);
    expect(shouldRefreshStatsAfterTick("Idle", focusSnap())).toBe(false);
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
      auto_start_next: false
    });

    expect(screen.getByTestId("timer-phase").textContent).toBe("Focus session");
    expect(screen.getByTestId("timer-display").textContent).toBe("02:05");
    expect(screen.getByTestId("brand-dot").getAttribute("data-phase")).toBe("Focus");
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
        <button data-testid="btn-pause"></button>
        <button data-testid="btn-resume"></button>
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
      auto_start_next: false
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
          currentStreakDays: 0
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({ autoStartNextFocusAfterBreak: false });
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
          auto_start_next: false
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();
    await userEvent.click(screen.getByTestId("btn-pause"));

    expect(invoke).toHaveBeenCalledWith("pause_timer");
  });

  it("loads stats on bootstrap", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        return Promise.resolve({
          sessionsToday: 2,
          focusMinutesToday: 50,
          focusMinutesThisWeek: 80,
          currentStreakDays: 3
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({ autoStartNextFocusAfterBreak: false });
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
          auto_start_next: false
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();

    expect(screen.getByTestId("sessions-today").textContent).toBe("2");
    expect(screen.getByTestId("focus-today").textContent).toBe("50m");
    expect(screen.getByTestId("streak-days").textContent).toBe("3");
    expect(screen.getByTestId("focus-this-week").textContent).toBe("1h 20m");
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
          currentStreakDays: 1
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({ autoStartNextFocusAfterBreak: false });
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
          auto_start_next: false
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
        auto_start_next: false
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
          currentStreakDays: 2
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({ autoStartNextFocusAfterBreak: false });
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
          auto_start_next: false
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
        auto_start_next: false
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
          currentStreakDays: 0
        });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "get_app_settings") {
        return Promise.resolve({ autoStartNextFocusAfterBreak: false });
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
          auto_start_next: false
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
});
