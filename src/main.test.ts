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
        <button type="button" id="reset-history">Reset statistics</button>
      </section>
      <section aria-labelledby="startup-title">
        <h2 id="startup-title">Startup</h2>
        <label>
          <input type="checkbox" id="launch-startup" />
          Launch on Windows startup
        </label>
      </section>
      <section aria-labelledby="presets-title">
        <h2 id="presets-title">Presets</h2>
        <ul id="preset-list" data-testid="preset-list"></ul>
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
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "get_stats") {
        return Promise.resolve({ sessions_today: 2, focus_minutes_this_week: 80 });
      }
      if (cmd === "list_presets") {
        return Promise.resolve([]);
      }
      if (cmd === "is_autostart_enabled") {
        return Promise.resolve(false);
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
      if (cmd === "get_stats") {
        return Promise.resolve({ sessions_today: 0, focus_minutes_this_week: 0 });
      }
      if (cmd === "list_presets") {
        return Promise.resolve([]);
      }
      if (cmd === "is_autostart_enabled") {
        return Promise.resolve(false);
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
