import type { CareerAnswers } from "@/features/career/types";

const PATHS = [
  { id: "software", title: "Software engineering", intro: "Build and maintain useful digital products.", terms: ["software", "web", "programming", "frontend", "backend", "typescript", "javascript", "react", "python", "build"] },
  { id: "data", title: "Data and analytics", intro: "Turn data into clearer questions and decisions.", terms: ["data", "analytics", "sql", "statistics", "python", "visualization", "machine learning", "research"] },
  { id: "design", title: "Product and UX design", intro: "Improve how people understand and use digital services.", terms: ["design", "ux", "research", "writing", "accessibility", "figma", "product", "people"] },
  { id: "cloud", title: "Cloud and platform engineering", intro: "Help teams run reliable, secure software systems.", terms: ["cloud", "security", "linux", "network", "infrastructure", "devops", "systems", "aws"] },
  { id: "product", title: "Product management", intro: "Connect user needs, evidence and delivery decisions.", terms: ["product", "leadership", "communication", "research", "business", "planning", "strategy"] },
];

function normalize(values: string[]) { return values.join(" ").toLowerCase(); }

export function recommendCareerPaths(answers: CareerAnswers) {
  const evidence = normalize([...answers.interests, ...answers.skills, answers.targetDomain ?? ""]);
  const scored = PATHS.map((path) => {
    const score = path.terms.reduce((total, term) => total + (evidence.includes(term) ? 1 : 0), 0);
    const interestEvidence = path.terms.some((term) => normalize(answers.interests).includes(term));
    return { ...path, score: score + (interestEvidence ? 1 : 0) };
  }).sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
  return scored.slice(0, 3).map((path) => ({
    ...path,
    matchLabel: path.score === 0 ? "Explore option" : `${Math.min(95, 55 + path.score * 8)}% signal overlap`,
  }));
}
