import { describe, expect, it } from "vitest";
import {
  statFocusTodayValue,
  statSessionsTodayValue,
  statStreakValue,
  statWeekValue
} from "./stats";

describe("stats tile values", () => {
  it("formats session count", () => {
    expect(statSessionsTodayValue(0)).toBe("0");
    expect(statSessionsTodayValue(3)).toBe("3");
  });

  it("formats focus minutes today", () => {
    expect(statFocusTodayValue(0)).toBe("0m");
    expect(statFocusTodayValue(45)).toBe("45m");
    expect(statFocusTodayValue(125)).toBe("2h 5m");
  });

  it("formats streak days", () => {
    expect(statStreakValue(0)).toBe("—");
    expect(statStreakValue(1)).toBe("1");
    expect(statStreakValue(7)).toBe("7");
  });

  it("formats week minutes", () => {
    expect(statWeekValue(0)).toBe("0h 0m");
    expect(statWeekValue(80)).toBe("1h 20m");
  });
});
