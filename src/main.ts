import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parsePresetForm } from "./presets";
import {
  statFocusTodayValue,
  statSessionsTodayValue,
  statStreakValue,
  statWeekValue
} from "./stats";

export type PresetRow = {
  id: string;
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
};

type StatsResponse = {
  sessionsToday: number;
  focusMinutesToday: number;
  focusMinutesThisWeek: number;
  currentStreakDays: number;
};

type AppSettingsDto = {
  autoStartNextFocusAfterBreak: boolean;
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

function setPresetEditingMode(editing: boolean): void {
  const submit = document.querySelector<HTMLButtonElement>("#preset-submit");
  const cancel = document.querySelector<HTMLButtonElement>("#preset-cancel-edit");
  if (submit) submit.textContent = editing ? "Update preset" : "Save preset";
  if (cancel) cancel.hidden = !editing;
}

export async function bootstrap(): Promise<void> {
  document.body.dataset.ready = "true";
  await loadStats();
  await loadPresets();
  bindPresetForm();
  bindResetHistory();
  await bindAppSettings();
  await bindAutostart();
  bindTimerControls();

  try {
    const snap = await invoke<TimerSnapshot>("get_timer");
    applyTimerSnapshot(snap);
  } catch {
    /* ignore: snapshot will arrive via event */
  }

  await listen<TimerSnapshot>("timer-tick", async (e) => {
    if (e.payload) applyTimerSnapshot(e.payload);
    await loadStats();
  });
}

async function loadStats(): Promise<void> {
  const stats = await invoke<StatsResponse>("get_stats");
  const sessionsToday = document.querySelector<HTMLElement>("[data-testid='sessions-today']");
  const focusThisWeek = document.querySelector<HTMLElement>("[data-testid='focus-this-week']");
  const focusToday = document.querySelector<HTMLElement>("[data-testid='focus-today']");
  const streak = document.querySelector<HTMLElement>("[data-testid='streak-days']");
  if (sessionsToday) sessionsToday.textContent = statSessionsTodayValue(stats.sessionsToday);
  if (focusThisWeek) focusThisWeek.textContent = statWeekValue(stats.focusMinutesThisWeek);
  if (focusToday) focusToday.textContent = statFocusTodayValue(stats.focusMinutesToday);
  if (streak) streak.textContent = statStreakValue(stats.currentStreakDays);
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
    const cyclesPart = p.cycles > 1 ? ` · ${p.cycles} cycles` : "";
    detail.textContent = `${p.focusMinutes}m focus · ${p.breakMinutes}m break${cyclesPart}`;
    meta.appendChild(name);
    meta.appendChild(detail);
    li.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "preset-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ghost";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => {
      const hid = document.querySelector<HTMLInputElement>("#preset-id");
      const nameIn = document.querySelector<HTMLInputElement>("#preset-name");
      const fm = document.querySelector<HTMLInputElement>("#focus-minutes");
      const bm = document.querySelector<HTMLInputElement>("#break-minutes");
      const cy = document.querySelector<HTMLInputElement>("#cycles");
      if (hid) hid.value = p.id;
      if (nameIn) nameIn.value = p.name;
      if (fm) fm.value = String(p.focusMinutes);
      if (bm) bm.value = String(p.breakMinutes);
      if (cy) cy.value = String(p.cycles);
      setPresetEditingMode(true);
      nameIn?.focus();
    });
    actions.appendChild(edit);

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
  const cancel = document.querySelector<HTMLButtonElement>("#preset-cancel-edit");
  if (!form) return;

  cancel?.addEventListener("click", () => {
    form.reset();
    const hid = document.querySelector<HTMLInputElement>("#preset-id");
    if (hid) hid.value = "";
    setPresetEditingMode(false);
    if (error) error.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const parsed = parsePresetForm(new FormData(form));
    if (!parsed.ok) {
      if (error) error.textContent = parsed.error;
      return;
    }
    const input: Record<string, unknown> = {
      name: parsed.value.name,
      focusMinutes: parsed.value.focusMinutes,
      breakMinutes: parsed.value.breakMinutes,
      cycles: parsed.value.cycles
    };
    if (parsed.value.id) input.id = parsed.value.id;

    await invoke("save_preset", { input });
    form.reset();
    const hid = document.querySelector<HTMLInputElement>("#preset-id");
    if (hid) hid.value = "";
    setPresetEditingMode(false);
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

async function bindAppSettings(): Promise<void> {
  const cb = document.querySelector<HTMLInputElement>("#auto-start-next-focus");
  if (!cb) return;
  try {
    const s = await invoke<AppSettingsDto>("get_app_settings");
    cb.checked = s.autoStartNextFocusAfterBreak;
  } catch {
    cb.checked = false;
  }
  cb.addEventListener("change", async () => {
    await invoke("set_auto_start_next_focus_after_break", { enabled: cb.checked });
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
