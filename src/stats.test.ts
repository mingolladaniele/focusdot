import { describe, expect, it } from "vitest";
import { formatFocusMinutes, formatSessionsToday } from "./stats";

describe("stats formatting", () => {
  it("formats minutes as hours and minutes", () => {
    expect(formatFocusMinutes(0)).toBe("0h 0m this week");
    expect(formatFocusMinutes(80)).toBe("1h 20m this week");
  });

  it("formats session count", () => {
    expect(formatSessionsToday(1)).toBe("1 session today");
    expect(formatSessionsToday(3)).toBe("3 sessions today");
  });
});
