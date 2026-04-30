export type PresetInput = {
  name: string;
  focusMinutes: number;
  breakMinutes: number;
};

export type PresetParseResult =
  | { ok: true; value: PresetInput }
  | { ok: false; error: string };

export function parsePresetForm(form: FormData): PresetParseResult {
  const name = String(form.get("name") ?? "").trim();
  const focusMinutes = Number(form.get("focusMinutes"));
  const breakMinutes = Number(form.get("breakMinutes"));

  if (
    !name ||
    !Number.isInteger(focusMinutes) ||
    !Number.isInteger(breakMinutes) ||
    focusMinutes < 1 ||
    breakMinutes < 1
  ) {
    return { ok: false, error: "Name, focus minutes, and break minutes are required." };
  }

  return { ok: true, value: { name, focusMinutes, breakMinutes } };
}
