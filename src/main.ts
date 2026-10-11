import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parsePresetForm } from "./presets";
import {
  statFocusTodayValue,
  statPeriodMinutesValue,
  statSessionsTodayValue,
  statStreakValue
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
  focusMinutesThisMonth: number;
  focusMinutesThisYear: number;
  currentStreakDays: number;
};

type AppSettingsDto = {
  autoStartNextFocusAfterBreak: boolean;
  notificationsEnabled: boolean;
  overtimeTrackingEnabled: boolean;
};

export type TimerSnapshot = {
  phase: "Idle" | "Focus" | "Overtime" | "Break";
  running: boolean;
  remaining_seconds: number;
  focus_minutes: number;
  break_minutes: number;
  cycles_remaining: number;
  total_cycles?: number;
  auto_start_next: boolean;
  overtime_seconds: number;
};

/** Stats change when history changes; focus completion is Focus/Overtime → Break in the timer model. */
export function shouldRefreshStatsAfterTick(
  previousPhase: TimerSnapshot["phase"] | undefined,
  payload: TimerSnapshot
): boolean {
  const endedFocus =
    previousPhase === "Focus" || previousPhase === "Overtime";
  return endedFocus && payload.phase === "Break";
}

const PHASE_LABEL: Record<TimerSnapshot["phase"], string> = {
  Idle: "Idle",
  Focus: "Focus session",
  Overtime: "Overtime",
  Break: "Break"
};

const ICON_PLAY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
const ICON_EDIT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
const ICON_DELETE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-9h1.64l.41 6h-2.46l.41-6zm4.54 0h1.64l.41 6h-2.46l.41-6zM15.5 4l-1-1h-5l-1 1H5v2h14V4h-3.5z"/></svg>';

const CONFIRM_WINDOW_MS = 3000;

/**
 * Guards a destructive click: the first click arms the button (red, new label) and only a
 * second click within a few seconds runs `action`. When `needsConfirm` returns false the
 * action runs straight away.
 */
export function bindConfirmClick(
  btn: HTMLButtonElement,
  armed: { title: string; text?: string },
  action: () => Promise<void> | void,
  needsConfirm: () => boolean = () => true
): void {
  const original = {
    title: btn.title,
    ariaLabel: btn.getAttribute("aria-label"),
    text: btn.textContent
  };
  let disarmTimer: ReturnType<typeof setTimeout> | undefined;

  const disarm = (): void => {
    clearTimeout(disarmTimer);
    disarmTimer = undefined;
    btn.classList.remove("is-armed");
    btn.title = original.title;
    if (original.ariaLabel !== null) btn.setAttribute("aria-label", original.ariaLabel);
    if (armed.text !== undefined) btn.textContent = original.text;
  };

  btn.addEventListener("click", async () => {
    if (disarmTimer !== undefined || !needsConfirm()) {
      disarm();
      await action();
      return;
    }
    btn.classList.add("is-armed");
    btn.title = armed.title;
    if (original.ariaLabel !== null) btn.setAttribute("aria-label", armed.title);
    if (armed.text !== undefined) btn.textContent = armed.text;
    disarmTimer = setTimeout(disarm, CONFIRM_WINDOW_MS);
  });
}

/** Preset behind the one-click Start (last used, else first); null when there are none. */
let quickStartPreset: PresetRow | null = null;
/** Latest phase from the backend, used to guard actions that would replace a running session. */
let currentPhase: TimerSnapshot["phase"] = "Idle";

function presetIconButton(iconSvg: string, className: string, label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = `<span class="preset-icon-btn__glyph">${iconSvg}</span>`;
  return btn;
}

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatOvertimeDisplay(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerProgressPercent(snapshot: TimerSnapshot): number {
  if (snapshot.phase === "Idle") return 0;
  if (snapshot.phase === "Overtime") return 100;
  const totalSeconds =
    snapshot.phase === "Focus"
      ? Math.max(0, snapshot.focus_minutes) * 60
      : Math.max(0, snapshot.break_minutes) * 60;
  if (totalSeconds <= 0) return 0;
  const elapsed = totalSeconds - snapshot.remaining_seconds;
  return Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
}

export function applyTimerSnapshot(snapshot: TimerSnapshot): void {
  const phaseEl = document.querySelector<HTMLElement>("[data-testid='timer-phase']");
  const timeEl = document.querySelector<HTMLElement>("[data-testid='timer-display']");
  const dot = document.querySelector<HTMLElement>("[data-testid='brand-dot']");
  const pause = document.querySelector<HTMLButtonElement>("[data-testid='btn-pause']");
  const resume = document.querySelector<HTMLButtonElement>("[data-testid='btn-resume']");
  const skipBreak = document.querySelector<HTMLButtonElement>("[data-testid='btn-skip-break']");
  const stop = document.querySelector<HTMLButtonElement>("[data-testid='btn-stop']");

  currentPhase = snapshot.phase;
  const idle = snapshot.phase === "Idle";

  if (phaseEl) {
    let label = PHASE_LABEL[snapshot.phase];
    if (idle && quickStartPreset) {
      label = `Ready · ${quickStartPreset.name}`;
    }
    const totalCycles = snapshot.total_cycles ?? 0;
    if (!idle && totalCycles > 1) {
      label = `${label} · ${totalCycles - snapshot.cycles_remaining} of ${totalCycles}`;
    }
    if (!idle && !snapshot.running) {
      label = `${label} (paused)`;
    }
    phaseEl.textContent = label;
  }
  if (timeEl) {
    if (idle) {
      timeEl.textContent = quickStartPreset ? formatMmSs(quickStartPreset.focusMinutes * 60) : "--:--";
    } else if (snapshot.phase === "Overtime") {
      timeEl.textContent = formatOvertimeDisplay(snapshot.overtime_seconds);
    } else {
      timeEl.textContent = formatMmSs(snapshot.remaining_seconds);
    }
  }
  if (dot) {
    dot.setAttribute("data-phase", snapshot.phase);
  }
  const statusPill = document.querySelector<HTMLElement>("[data-testid='status-pill']");
  const statusText = statusPill?.querySelector<HTMLElement>(".status-text");
  const railFill = document.querySelector<HTMLElement>(".timer-card .rail-fill");
  if (statusPill) {
    statusPill.setAttribute("data-phase", snapshot.phase);
    if (snapshot.phase === "Idle") {
      statusPill.removeAttribute("data-running");
    } else {
      statusPill.setAttribute("data-running", snapshot.running ? "true" : "false");
    }
  }
  if (statusText) {
    const short: Record<TimerSnapshot["phase"], string> = {
      Idle: "Idle",
      Focus: "Focus",
      Overtime: "Overtime",
      Break: "Break"
    };
    statusText.textContent = short[snapshot.phase];
  }
  if (railFill) {
    const pct = timerProgressPercent(snapshot);
    railFill.style.width = `${pct}%`;
  }
  if (pause) pause.disabled = idle || !snapshot.running;
  if (resume) resume.disabled = idle || snapshot.running;
  if (skipBreak) skipBreak.disabled = snapshot.phase !== "Break";
  if (stop) {
    stop.disabled = idle;
    const overtime = snapshot.phase === "Overtime";
    const stopLabel = stop.querySelector<HTMLElement>(".btn-label");
    if (stopLabel) stopLabel.textContent = overtime ? "Finish focus" : "Stop";
    stop.title = overtime
      ? "Log this focus (including overtime) and start the break"
      : "Cancel the current session and go back to Idle";
  }

  // Idle shows a single Start; an active session shows the session controls.
  const start = document.querySelector<HTMLButtonElement>("[data-testid='btn-start']");
  if (start) {
    start.hidden = !idle;
    start.disabled = !quickStartPreset;
    const startLabel = start.querySelector<HTMLElement>(".btn-label");
    if (startLabel) {
      startLabel.textContent = quickStartPreset ? `Start ${quickStartPreset.name}` : "Start";
    }
    start.title = quickStartPreset
      ? `Start ${quickStartPreset.focusMinutes}m focus / ${quickStartPreset.breakMinutes}m break`
      : "Create a preset first";
    for (const b of [pause, resume, skipBreak, stop]) {
      if (b) b.hidden = idle;
    }
  }
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
  await loadQuickStart();
  bindPresetForm();
  bindResetHistory();
  await bindAppSettings();
  await bindAutostart();
  bindTimerControls();
  // Stats are day-based; reopening the dashboard tomorrow must not show yesterday's numbers.
  window.addEventListener("focus", () => {
    void loadStats();
  });

  let lastPhase: TimerSnapshot["phase"] | undefined;
  try {
    const snap = await invoke<TimerSnapshot>("get_timer");
    applyTimerSnapshot(snap);
    lastPhase = snap.phase;
  } catch {
    lastPhase = undefined;
  }

  await listen<TimerSnapshot>("timer-tick", async (e) => {
    const payload = e.payload;
    if (!payload) return;
    const prev = lastPhase;
    lastPhase = payload.phase;
    if (prev === "Idle" && payload.phase !== "Idle") {
      // Starting from the tray changes the last used preset.
      await loadQuickStart();
    }
    applyTimerSnapshot(payload);
    if (shouldRefreshStatsAfterTick(prev, payload)) {
      await loadStats();
    }
  });
}

async function loadStats(): Promise<void> {
  const stats = await invoke<StatsResponse>("get_stats");
  const sessionsToday = document.querySelector<HTMLElement>("[data-testid='sessions-today']");
  const focusThisWeek = document.querySelector<HTMLElement>("[data-testid='focus-this-week']");
  const focusThisMonth = document.querySelector<HTMLElement>("[data-testid='focus-this-month']");
  const focusThisYear = document.querySelector<HTMLElement>("[data-testid='focus-this-year']");
  const focusToday = document.querySelector<HTMLElement>("[data-testid='focus-today']");
  const streak = document.querySelector<HTMLElement>("[data-testid='streak-days']");
  if (sessionsToday) sessionsToday.textContent = statSessionsTodayValue(stats.sessionsToday);
  if (focusThisWeek) focusThisWeek.textContent = statPeriodMinutesValue(stats.focusMinutesThisWeek);
  if (focusThisMonth) focusThisMonth.textContent = statPeriodMinutesValue(stats.focusMinutesThisMonth);
  if (focusThisYear) focusThisYear.textContent = statPeriodMinutesValue(stats.focusMinutesThisYear);
  if (focusToday) focusToday.textContent = statFocusTodayValue(stats.focusMinutesToday);
  if (streak) streak.textContent = statStreakValue(stats.currentStreakDays);
}

async function loadQuickStart(): Promise<void> {
  try {
    quickStartPreset = (await invoke<PresetRow | null>("get_quick_start_preset")) ?? null;
  } catch {
    quickStartPreset = null;
  }
}

/** Re-render the Idle view after presets or the quick-start preset changed. */
async function refreshQuickStartView(): Promise<void> {
  await loadQuickStart();
  try {
    const snap = await invoke<TimerSnapshot>("get_timer");
    if (snap) applyTimerSnapshot(snap);
  } catch {
    // Timer view stays as is; the next timer-tick corrects it.
  }
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

    const edit = presetIconButton(ICON_EDIT, "preset-icon-btn preset-icon-btn--edit", "Edit preset");
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

    const start = presetIconButton(
      ICON_PLAY,
      "preset-icon-btn preset-icon-btn--start",
      "Start a focus session with this preset"
    );
    bindConfirmClick(
      start,
      { title: "Click again to replace the current session" },
      async () => {
        await invoke("start_preset", { id: p.id });
      },
      () => currentPhase !== "Idle"
    );
    actions.appendChild(start);
    const del = presetIconButton(ICON_DELETE, "preset-icon-btn preset-icon-btn--delete", "Delete preset");
    bindConfirmClick(del, { title: `Click again to delete "${p.name}"` }, async () => {
      await invoke("delete_preset", { id: p.id });
      await loadPresets();
      await refreshQuickStartView();
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
    await refreshQuickStartView();
  });
}

function bindResetHistory(): void {
  const btn = document.querySelector<HTMLButtonElement>("#reset-history");
  if (!btn) return;
  bindConfirmClick(
    btn,
    { title: "Click again to delete all focus history", text: "Delete all history?" },
    async () => {
      await invoke("reset_history");
      await loadStats();
    }
  );
}

async function bindAppSettings(): Promise<void> {
  const auto = document.querySelector<HTMLInputElement>("#auto-start-next-focus");
  const notif = document.querySelector<HTMLInputElement>("#notifications-enabled");
  const overtime = document.querySelector<HTMLInputElement>("#overtime-tracking");
  if (!auto && !notif && !overtime) return;

  try {
    const s = await invoke<AppSettingsDto>("get_app_settings");
    if (auto) auto.checked = s.autoStartNextFocusAfterBreak;
    if (notif) notif.checked = s.notificationsEnabled;
    if (overtime) overtime.checked = s.overtimeTrackingEnabled;
  } catch {
    if (auto) auto.checked = false;
    if (notif) notif.checked = true;
    if (overtime) overtime.checked = false;
  }

  auto?.addEventListener("change", async () => {
    await invoke("set_auto_start_next_focus_after_break", { enabled: auto.checked });
  });
  notif?.addEventListener("change", async () => {
    await invoke("set_notifications_enabled", { enabled: notif.checked });
  });
  overtime?.addEventListener("change", async () => {
    await invoke("set_overtime_tracking_enabled", { enabled: overtime.checked });
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
  const skipBreak = document.querySelector<HTMLButtonElement>("[data-testid='btn-skip-break']");
  const stop = document.querySelector<HTMLButtonElement>("[data-testid='btn-stop']");
  const start = document.querySelector<HTMLButtonElement>("[data-testid='btn-start']");
  start?.addEventListener("click", async () => {
    await invoke("quick_start");
  });
  pause?.addEventListener("click", async () => {
    await invoke("pause_timer");
  });
  resume?.addEventListener("click", async () => {
    await invoke("resume_timer");
  });
  skipBreak?.addEventListener("click", async () => {
    await invoke("skip_break");
  });
  stop?.addEventListener("click", async () => {
    await invoke("stop_timer");
  });
}
