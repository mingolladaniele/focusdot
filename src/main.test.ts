import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTimerSnapshot,
  bootstrap,
  mainActionFor,
  shouldRefreshStatsAfterTick,
  showsStop,
  showView,
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

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: () => Promise.resolve("0.1.5")
}));

/** The real dashboard markup, so tests and index.html cannot drift apart. */
const APP_HTML = (() => {
  const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
  const start = html.indexOf('<main id="app">');
  const end = html.indexOf("</main>") + "</main>".length;
  return html.slice(start, end);
})();

beforeEach(() => {
  document.body.innerHTML = APP_HTML;
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
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='dashboard-view'] > section")
    );
    const timerIdx = sections.findIndex((s) => s.classList.contains("timer-card"));
    const statsIdx = sections.findIndex((s) => s.classList.contains("stats-card"));
    expect(timerIdx).toBeGreaterThanOrEqual(0);
    expect(statsIdx).toBe(timerIdx + 1);
  });

  it("opens on the dashboard with settings hidden and presets collapsed", () => {
    expect(screen.getByTestId("dashboard-view").hidden).toBe(false);
    expect(screen.getByTestId("settings-view").hidden).toBe(true);
    expect((screen.getByTestId("presets-section") as HTMLDetailsElement).open).toBe(false);
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
    expect((screen.getByLabelText("Focus minutes") as HTMLInputElement).value).toBe("25");
    expect((screen.getByLabelText("Break minutes") as HTMLInputElement).value).toBe("5");
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

describe("settings view", () => {
  function mockBackend(timer: TimerSnapshot): void {
    const responses: Record<string, unknown> = {
      get_stats: {
        sessionsToday: 0,
        focusMinutesToday: 0,
        focusMinutesThisWeek: 0,
        focusMinutesThisMonth: 0,
        focusMinutesThisYear: 0,
        currentStreakDays: 0
      },
      list_presets: [],
      get_quick_start_preset: null,
      get_app_settings: {
        autoStartNextFocusAfterBreak: false,
        notificationsEnabled: true,
        overtimeTrackingEnabled: false
      },
      is_autostart_enabled: false,
      get_timer: timer
    };
    invoke.mockImplementation((cmd: string) => Promise.resolve(responses[cmd]));
  }
  const idle: TimerSnapshot = {
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
  const settingsShown = (): boolean => !screen.getByTestId("settings-view").hidden;

  it("gear swaps the dashboard for settings in the same window, and back again", async () => {
    mockBackend(idle);
    await bootstrap();
    const gear = screen.getByRole("button", { name: "Settings" });

    await userEvent.click(gear);
    expect(settingsShown()).toBe(true);
    expect(screen.getByTestId("dashboard-view").hidden).toBe(true);
    expect(gear.getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(gear);
    expect(settingsShown()).toBe(false);
  });

  it("back button and Esc return to the dashboard", async () => {
    mockBackend(idle);
    await bootstrap();

    showView("settings");
    await userEvent.click(screen.getByRole("button", { name: "Back to timer" }));
    expect(settingsShown()).toBe(false);

    showView("settings");
    await userEvent.keyboard("{Escape}");
    expect(settingsShown()).toBe(false);
  });

  it("follows the view requested by the tray", async () => {
    const handlers: Record<string, (e: { payload: unknown }) => void> = {};
    listen.mockImplementation((event: string, cb: (e: { payload: unknown }) => void) => {
      handlers[event] = cb;
      return Promise.resolve(() => {});
    });
    mockBackend(idle);
    await bootstrap();

    handlers["show-view"]({ payload: "settings" });
    expect(settingsShown()).toBe(true);
    handlers["show-view"]({ payload: "dashboard" });
    expect(settingsShown()).toBe(false);
  });

  it("keeps the countdown visible while in settings", async () => {
    mockBackend(idle);
    await bootstrap();
    const timer = screen.getByTestId("settings-timer");
    expect(timer.hidden).toBe(true);

    applyTimerSnapshot({ ...idle, phase: "Focus", running: true, remaining_seconds: 754, focus_minutes: 25 });
    expect(timer.hidden).toBe(false);
    expect(timer.textContent).toBe("12:34");

    applyTimerSnapshot({ ...idle, phase: "Focus", running: false, remaining_seconds: 754, focus_minutes: 25 });
    expect(timer.textContent).toBe("12:34 · paused");
  });

  it("shows the app version and keeps Reset in settings", async () => {
    mockBackend(idle);
    await bootstrap();
    expect(screen.getByTestId("app-version").textContent).toBe("focusdot v0.1.5");
    expect(screen.getByTestId("settings-view").contains(document.querySelector("#reset-history"))).toBe(true);
  });
});
