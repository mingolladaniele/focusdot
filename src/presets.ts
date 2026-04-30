export type PresetInput = {
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
  autoStartNext: boolean;
};

export type PresetParseResult =
  | { ok: true; value: PresetInput }
  | { ok: false; error: string };

export function parsePresetForm(form: FormData): PresetParseResult {
  const name = String(form.get("name") ?? "").trim();
  const focusMinutes = Number(form.get("focusMinutes"));
  const breakMinutes = Number(form.get("breakMinutes"));
  const cyclesRaw = form.get("cycles");
  const cycles = cyclesRaw === null || cyclesRaw === "" ? 1 : Number(cyclesRaw);
  const autoStartNext = form.get("autoStartNext") === "on";

  if (
    !name ||
    !Number.isInteger(focusMinutes) ||
    !Number.isInteger(breakMinutes) ||
    !Number.isInteger(cycles) ||
    focusMinutes < 1 ||
    breakMinutes < 1 ||
    cycles < 1
  ) {
    return {
      ok: false,
      error: "Name, focus minutes, break minutes, and cycles (≥1) are required."
    };
  }

  return { ok: true, value: { name, focusMinutes, breakMinutes, cycles, autoStartNext } };
}
