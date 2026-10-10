import { describe, expect, it } from "vitest";
import { recommendCareerPaths } from "@/features/career/rules";
import type { CareerAnswers } from "@/features/career/types";

const base: CareerAnswers = {
  interests: [],
  skills: [],
  learningStyle: "mixed",
  availableHours: 5,
  targetDomain: null,
};

describe("transparent career-path signals", () => {
  it("ranks software engineering from overlapping student interests and skills", () => {
    const recommendations = recommendCareerPaths({ ...base, interests: ["frontend development"], skills: ["TypeScript", "React"] });
    expect(recommendations[0]?.id).toBe("software");
    expect(recommendations[0]?.matchLabel).toContain("signal overlap");
  });

  it("ranks product design when user-entered research and UX interests overlap", () => {
    const recommendations = recommendCareerPaths({ ...base, interests: ["UX research", "accessibility"], skills: ["Figma"] });
    expect(recommendations[0]?.id).toBe("design");
  });

  it("returns stable exploratory suggestions without inventing a positive match score", () => {
    const recommendations = recommendCareerPaths(base);
    expect(recommendations).toHaveLength(3);
    expect(recommendations.every((item) => item.matchLabel === "Explore option")).toBe(true);
    expect(recommendations.map((item) => item.title)).toEqual([...recommendations.map((item) => item.title)].sort());
  });
});
