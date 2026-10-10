import { describe, expect, it } from "vitest";
import { calculateAttendancePercent, estimateClassesToTarget } from "@/features/attendance/calculations";

describe("attendance calculation", () => {
  it("uses attended divided by conducted, rounded to one decimal place", () => {
    expect(calculateAttendancePercent({ attended: 17, conducted: 20 })).toBe(85);
    expect(calculateAttendancePercent({ attended: 2, conducted: 3 })).toBe(66.7);
  });
  it("does not invent a percentage when no class has been conducted", () => {
    expect(calculateAttendancePercent({ attended: 0, conducted: 0 })).toBeNull();
    expect(estimateClassesToTarget({ attended: 0, conducted: 0 }, 75)).toBeNull();
  });
  it("estimates only future perfect-attendance classes and reports impossible 100% recovery", () => {
    expect(estimateClassesToTarget({ attended: 7, conducted: 10 }, 75)).toBe(2);
    expect(estimateClassesToTarget({ attended: 8, conducted: 10 }, 75)).toBe(0);
    expect(estimateClassesToTarget({ attended: 8, conducted: 10 }, 100)).toBeNull();
  });
  it("rejects inconsistent counts and targets", () => {
    expect(() => calculateAttendancePercent({ attended: 4, conducted: 3 })).toThrow(RangeError);
    expect(() => estimateClassesToTarget({ attended: 1, conducted: 3 }, 0)).toThrow(RangeError);
  });
});
