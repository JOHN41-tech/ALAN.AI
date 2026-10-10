import { describe, expect, it } from "vitest";
import { addCalendarDays, localDateTimeToIso, startOfDayInZone } from "@/lib/timezone";

describe("college timezone helpers", () => {
  it("converts India local midnight to UTC", () => {
    expect(startOfDayInZone("2026-10-10", "Asia/Kolkata").toISOString()).toBe("2026-10-09T18:30:00.000Z");
  });
  it("converts local class time and increments dates", () => {
    expect(localDateTimeToIso("2026-10-10T09:30", "Asia/Kolkata")).toBe("2026-10-10T04:00:00.000Z");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("rejects malformed local timestamps", () => {
    expect(() => localDateTimeToIso("10-10-2026 9am", "Asia/Kolkata")).toThrow(RangeError);
  });
});
