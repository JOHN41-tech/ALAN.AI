export type AttendanceCounts = { attended: number; conducted: number };

export function calculateAttendancePercent({ attended, conducted }: AttendanceCounts): number | null {
  if (!Number.isInteger(attended) || !Number.isInteger(conducted) || attended < 0 || conducted < 0 || attended > conducted) {
    throw new RangeError("Attendance counts must be non-negative integers with attended no greater than conducted.");
  }
  if (conducted === 0) return null;
  return Math.round((attended / conducted) * 1000) / 10;
}

/** Estimate perfect-attendance classes needed to reach a target; this is not an eligibility guarantee. */
export function estimateClassesToTarget({ attended, conducted }: AttendanceCounts, targetPercent: number): number | null {
  if (!Number.isFinite(targetPercent) || targetPercent <= 0 || targetPercent > 100) {
    throw new RangeError("Target percentage must be greater than 0 and no more than 100.");
  }
  const current = calculateAttendancePercent({ attended, conducted });
  if (current === null) return null;
  if (current >= targetPercent) return 0;
  if (targetPercent === 100) return null;
  return Math.ceil((targetPercent * conducted - 100 * attended) / (100 - targetPercent));
}
