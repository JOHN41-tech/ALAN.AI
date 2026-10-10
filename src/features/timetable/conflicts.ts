export type TimetableSlot = {
  weekday: number;
  startsAt: string;
  endsAt: string;
  validFrom: string;
  validUntil: string | null;
  classroomId: string | null;
  facultyAssignmentId: string;
  facultyId?: string | null;
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

function dateRangesOverlap(a: TimetableSlot, b: TimetableSlot) {
  const aEnd = a.validUntil ?? "9999-12-31";
  const bEnd = b.validUntil ?? "9999-12-31";
  return a.validFrom <= bEnd && b.validFrom <= aEnd;
}

export function findTimetableConflict(candidate: TimetableSlot, existing: readonly TimetableSlot[]): "room" | "faculty" | null {
  for (const slot of existing) {
    if (slot.weekday !== candidate.weekday || !dateRangesOverlap(candidate, slot)) continue;
    if (!overlaps(candidate.startsAt, candidate.endsAt, slot.startsAt, slot.endsAt)) continue;
    if (candidate.classroomId && slot.classroomId === candidate.classroomId) return "room";
    const sameFaculty = candidate.facultyId && slot.facultyId
      ? candidate.facultyId === slot.facultyId
      : slot.facultyAssignmentId === candidate.facultyAssignmentId;
    if (sameFaculty) return "faculty";
  }
  return null;
}
