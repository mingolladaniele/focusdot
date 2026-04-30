export type PresetInput = {
  id?: string;
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
};

export type PresetParseResult =
  | { ok: true; value: PresetInput }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parsePresetForm(form: FormData): PresetParseResult {
  const name = String(form.get("name") ?? "").trim();
  const focusMinutes = Number(form.get("focusMinutes"));
  const breakMinutes = Number(form.get("breakMinutes"));
  const cyclesRaw = form.get("cycles");
  const cycles = cyclesRaw === null || cyclesRaw === "" ? 1 : Number(cyclesRaw);
  const rawId = String(form.get("presetId") ?? "").trim();

  let id: string | undefined;
  if (rawId) {
    if (!UUID_RE.test(rawId)) {
      return { ok: false, error: "Invalid preset id." };
    }
    id = rawId;
  }

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

  return { ok: true, value: { id, name, focusMinutes, breakMinutes, cycles } };
}
