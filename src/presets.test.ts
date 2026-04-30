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
      value: { name: "Focus", focusMinutes: 25, breakMinutes: 5 }
    });
  });

  it("rejects missing name and invalid minutes", () => {
    const form = new FormData();
    form.set("name", " ");
    form.set("focusMinutes", "0");
    form.set("breakMinutes", "5");

    expect(parsePresetForm(form)).toEqual({
      ok: false,
      error: "Name, focus minutes, and break minutes are required."
    });
  });
});
