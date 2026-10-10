import { describe, expect, it } from "vitest";
import { opportunityInputSchema, roadmapDraftSchema } from "@/features/career/schemas";

const task = { title: "Build a focused prototype", phase: "Foundations", description: "Use the concepts from this week in one small project.", estimatedHours: 4 };

describe("Phase 2 input validation", () => {
  it("accepts bounded roadmaps with a practical minimum task count", () => {
    const result = roadmapDraftSchema.safeParse({ title: "Data analysis foundations", summary: "A realistic study path; adjust the pace to your own schedule.", tasks: [task, { ...task, position: 2 }, { ...task, position: 3 }, { ...task, position: 4 }] });
    expect(result.success).toBe(true);
  });

  it("rejects too few roadmap milestones and unreasonable durations", () => {
    expect(roadmapDraftSchema.safeParse({ title: "Plan", summary: "This is a long enough summary for validation.", tasks: [task, task, task] }).success).toBe(false);
    expect(roadmapDraftSchema.safeParse({ title: "Plan", summary: "This is a long enough summary for validation.", tasks: Array.from({ length: 4 }, () => ({ ...task, estimatedHours: 500 })) }).success).toBe(false);
  });

  it("requires HTTPS and explicit verified status before publishing a listing", () => {
    const base = { title: "Software intern", company: "Example employer", kind: "Internship", domain: "Software", location: null, workMode: "Remote", skills: ["TypeScript"], description: "A learning role with clear projects and a student-friendly mentor.", deadline: null, verificationStatus: "verified", published: true };
    expect(opportunityInputSchema.safeParse({ ...base, sourceUrl: "https://jobs.example.test/role" }).success).toBe(true);
    expect(opportunityInputSchema.safeParse({ ...base, sourceUrl: "http://jobs.example.test/role" }).success).toBe(false);
  });
});
