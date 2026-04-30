import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyTimerSnapshot, bootstrap } from "./main";

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
      <section class="card" aria-labelledby="stats-title">
        <h2 id="stats-title">Statistics</h2>
        <p class="stat" data-testid="sessions-today">0 sessions today</p>
        <p class="stat" data-testid="focus-this-week">0h 0m this week</p>
        <button type="button" class="ghost" id="reset-history">Reset statistics</button>
      </section>
      <section class="card" aria-labelledby="presets-title">
        <h2 id="presets-title">Presets</h2>
        <ul id="preset-list" data-testid="preset-list"></ul>
        <form id="preset-form" class="preset-form">
          <label class="field" for="preset-name"><span>Name</span>
            <input id="preset-name" name="name" required /></label>
          <label class="field" for="focus-minutes"><span>Focus minutes</span>
            <input id="focus-minutes" name="focusMinutes" type="number" min="1" required /></label>
          <label class="field" for="break-minutes"><span>Break minutes</span>
            <input id="break-minutes" name="breakMinutes" type="number" min="1" required /></label>
          <button class="primary" type="submit">Save preset</button>
        </form>
        <p id="preset-error" class="error" role="alert"></p>
      </section>
      <section class="card" aria-labelledby="startup-title">
        <h2 id="startup-title">Startup</h2>
        <label class="toggle"><input type="checkbox" id="launch-startup" /> Launch on Windows startup</label>
      </section>
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
        return Promise.resolve({
          phase: "Focus",
          running: true,
          remaining_seconds: 60,
          focus_minutes: 25,
          break_minutes: 5
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
        return Promise.resolve({ sessions_today: 2, focus_minutes_this_week: 80 });
      }
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Idle",
          running: false,
          remaining_seconds: 0,
          focus_minutes: 0,
          break_minutes: 0
        });
      }
      return Promise.resolve(undefined);
    });

    await bootstrap();

    expect(screen.getByTestId("sessions-today").textContent).toBe("2 sessions today");
    expect(screen.getByTestId("focus-this-week").textContent).toBe("1h 20m this week");
    expect(invoke).toHaveBeenCalledWith("get_stats");
  });

  it("saves valid preset through Tauri command", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") return Promise.resolve({ sessions_today: 0, focus_minutes_this_week: 0 });
      if (cmd === "list_presets") return Promise.resolve([]);
      if (cmd === "is_autostart_enabled") return Promise.resolve(false);
      if (cmd === "get_timer") {
        return Promise.resolve({
          phase: "Idle",
          running: false,
          remaining_seconds: 0,
          focus_minutes: 0,
          break_minutes: 0
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
      input: { name: "Focus", focusMinutes: 25, breakMinutes: 5 }
    });
  });
});
