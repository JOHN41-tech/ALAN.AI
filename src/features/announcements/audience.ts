export type AcademicAudience = {
  departmentId: string | null;
  semesterId: string | null;
  sectionId: string | null;
};

export type AnnouncementTarget =
  | { type: "college" }
  | { type: "department"; id: string }
  | { type: "semester"; id: string }
  | { type: "section"; id: string };

export function matchesAudience(profile: AcademicAudience, target: AnnouncementTarget): boolean {
  if (target.type === "college") return true;
  if (target.type === "department") return profile.departmentId === target.id;
  if (target.type === "semester") return profile.semesterId === target.id;
  return profile.sectionId === target.id;
}
