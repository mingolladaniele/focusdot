import { describe, expect, it } from "vitest";
import { parsePresetForm } from "./presets";

describe("parsePresetForm", () => {
  it("trims name and parses minutes", () => {
    const form = new FormData();
    form.set("name", " Focus ");
    form.set("focusMinutes", "25");
    form.set("breakMinutes", "5");

    expect(parsePresetForm(form)).toEqual({
      ok: true,
      value: { name: "Focus", focusMinutes: 25, breakMinutes: 5, cycles: 1, autoStartNext: false }
    });
  });

  it("parses cycles and autoStartNext from form", () => {
    const form = new FormData();
    form.set("name", "Long focus");
    form.set("focusMinutes", "25");
    form.set("breakMinutes", "5");
    form.set("cycles", "4");
    form.set("autoStartNext", "on");

    expect(parsePresetForm(form)).toEqual({
      ok: true,
      value: {
        name: "Long focus",
        focusMinutes: 25,
        breakMinutes: 5,
        cycles: 4,
        autoStartNext: true
      }
    });
  });

  it("defaults cycles to 1 and autoStartNext false when absent", () => {
    const form = new FormData();
    form.set("name", "Simple");
    form.set("focusMinutes", "25");
    form.set("breakMinutes", "5");

    const r = parsePresetForm(form);
    expect(r.ok && r.value.cycles).toBe(1);
    expect(r.ok && r.value.autoStartNext).toBe(false);
  });

  it("rejects missing name and invalid minutes", () => {
    const form = new FormData();
    form.set("name", " ");
    form.set("focusMinutes", "0");
    form.set("breakMinutes", "5");

    expect(parsePresetForm(form)).toEqual({
      ok: false,
      error: "Name, focus minutes, break minutes, and cycles (≥1) are required."
    });
  });
});
