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
      value: { name: "Focus", focusMinutes: 25, breakMinutes: 5, cycles: 1 }
    });
  });

  it("parses cycles from form", () => {
    const form = new FormData();
    form.set("name", "Long focus");
    form.set("focusMinutes", "25");
    form.set("breakMinutes", "5");
    form.set("cycles", "4");

    expect(parsePresetForm(form)).toEqual({
      ok: true,
      value: {
        name: "Long focus",
        focusMinutes: 25,
        breakMinutes: 5,
        cycles: 4
      }
    });
  });

  it("defaults cycles to 1 when absent", () => {
    const form = new FormData();
    form.set("name", "Simple");
    form.set("focusMinutes", "25");
    form.set("breakMinutes", "5");

    const r = parsePresetForm(form);
    expect(r.ok && r.value.cycles).toBe(1);
  });

  it("parses optional preset id", () => {
    const form = new FormData();
    form.set("name", "X");
    form.set("focusMinutes", "25");
    form.set("breakMinutes", "5");
    form.set("presetId", "550e8400-e29b-41d4-a716-446655440000");

    expect(parsePresetForm(form)).toEqual({
      ok: true,
      value: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "X",
        focusMinutes: 25,
        breakMinutes: 5,
        cycles: 1
      }
    });
  });

  it("rejects invalid preset id", () => {
    const form = new FormData();
    form.set("name", "X");
    form.set("focusMinutes", "25");
    form.set("breakMinutes", "5");
    form.set("presetId", "not-a-uuid");

    expect(parsePresetForm(form)).toEqual({
      ok: false,
      error: "Invalid preset id."
    });
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
