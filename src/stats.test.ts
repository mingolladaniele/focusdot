import { describe, expect, it } from "vitest";
import {
  formatFocusMinutes,
  formatFocusMinutesToday,
  formatSessionsToday,
  formatStreakDays
} from "./stats";

describe("stats formatting", () => {
  it("formats minutes as hours and minutes", () => {
    expect(formatFocusMinutes(0)).toBe("0h 0m this week");
    expect(formatFocusMinutes(80)).toBe("1h 20m this week");
  });

  it("formats session count", () => {
    expect(formatSessionsToday(1)).toBe("1 session today");
    expect(formatSessionsToday(3)).toBe("3 sessions today");
  });

  it("formats focus minutes today", () => {
    expect(formatFocusMinutesToday(0)).toBe("0m today");
    expect(formatFocusMinutesToday(45)).toBe("45m today");
    expect(formatFocusMinutesToday(125)).toBe("2h 5m today");
  });

  it("formats streak days", () => {
    expect(formatStreakDays(0)).toBe("No streak yet");
    expect(formatStreakDays(1)).toBe("1 day streak");
    expect(formatStreakDays(7)).toBe("7 day streak");
  });
});
