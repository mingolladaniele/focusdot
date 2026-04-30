import { invoke } from "@tauri-apps/api/core";
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

export async function bootstrap(): Promise<void> {
  document.body.dataset.ready = "true";
  await loadStats();
  await loadPresets();
  bindPresetForm();
  bindResetHistory();
  await bindAutostart();
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

async function loadPresets(): Promise<void> {
  const list = document.querySelector<HTMLUListElement>("#preset-list");
  if (!list) {
    return;
  }
  const presets = await invoke<PresetRow[]>("list_presets");
  list.innerHTML = "";
  for (const p of presets) {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${p.focusMinutes}m / ${p.breakMinutes}m) `;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      await invoke("delete_preset", { id: p.id });
      await loadPresets();
      await loadStats();
    });
    li.appendChild(del);
    list.appendChild(li);
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
    await loadPresets();
  });
}

function bindResetHistory(): void {
  const btn = document.querySelector<HTMLButtonElement>("#reset-history");
  if (!btn) {
    return;
  }
  btn.addEventListener("click", async () => {
    await invoke("reset_history");
    await loadStats();
  });
}

async function bindAutostart(): Promise<void> {
  const cb = document.querySelector<HTMLInputElement>("#launch-startup");
  if (!cb) {
    return;
  }
  try {
    cb.checked = await invoke<boolean>("is_autostart_enabled");
  } catch {
    cb.checked = false;
  }
  cb.addEventListener("change", async () => {
    await invoke("set_autostart_enabled", { enabled: cb.checked });
  });
}
