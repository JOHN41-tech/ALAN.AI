import { describe, expect, it } from "vitest";
import { matchesAudience } from "@/features/announcements/audience";

const profile = { departmentId: "dept-1", semesterId: "semester-2", sectionId: "section-a" };
describe("announcement audience", () => {
  it("matches each configured audience boundary", () => {
    expect(matchesAudience(profile, { type: "college" })).toBe(true);
    expect(matchesAudience(profile, { type: "department", id: "dept-1" })).toBe(true);
    expect(matchesAudience(profile, { type: "semester", id: "semester-2" })).toBe(true);
    expect(matchesAudience(profile, { type: "section", id: "section-a" })).toBe(true);
  });
  it("does not match a different section or department", () => {
    expect(matchesAudience(profile, { type: "section", id: "section-b" })).toBe(false);
    expect(matchesAudience(profile, { type: "department", id: "dept-2" })).toBe(false);
  });
});
