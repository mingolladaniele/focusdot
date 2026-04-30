import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parsePresetForm } from "./presets";
import {
  formatFocusMinutes,
  formatFocusMinutesToday,
  formatSessionsToday,
  formatStreakDays
} from "./stats";

export type PresetRow = {
  id: string;
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
  autoStartNext: boolean;
};

type StatsResponse = {
  sessionsToday: number;
  focusMinutesToday: number;
  focusMinutesThisWeek: number;
  currentStreakDays: number;
};

export type TimerSnapshot = {
  phase: "Idle" | "Focus" | "Break";
  running: boolean;
  remaining_seconds: number;
  focus_minutes: number;
  break_minutes: number;
  cycles_remaining: number;
  auto_start_next: boolean;
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
  const focusToday = document.querySelector<HTMLElement>("[data-testid='focus-today']");
  const streak = document.querySelector<HTMLElement>("[data-testid='streak-days']");
  if (sessionsToday) sessionsToday.textContent = formatSessionsToday(stats.sessionsToday);
  if (focusThisWeek) focusThisWeek.textContent = formatFocusMinutes(stats.focusMinutesThisWeek);
  if (focusToday) focusToday.textContent = formatFocusMinutesToday(stats.focusMinutesToday);
  if (streak) streak.textContent = formatStreakDays(stats.currentStreakDays);
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
    const cyclesPart =
      p.cycles > 1 ? ` · ${p.cycles}× ${p.autoStartNext ? "auto" : "manual"}` : "";
    detail.textContent = `${p.focusMinutes}m focus · ${p.breakMinutes}m break${cyclesPart}`;
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
      await loadStats();
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
  pause?.addEventListener("click", async () => {
    await invoke("pause_timer");
  });
  resume?.addEventListener("click", async () => {
    await invoke("resume_timer");
  });
  stop?.addEventListener("click", async () => {
    await invoke("stop_timer");
  });
}
