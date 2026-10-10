import { describe, expect, it } from "vitest";
import { findTimetableConflict, type TimetableSlot } from "@/features/timetable/conflicts";

const base: TimetableSlot = {
  weekday: 1, startsAt: "09:00", endsAt: "10:00", validFrom: "2026-01-01", validUntil: null,
  classroomId: "room-1", facultyAssignmentId: "assignment-1",
};

describe("recurring timetable conflict detection", () => {
  it("detects overlapping room bookings", () => {
    expect(findTimetableConflict({ ...base, startsAt: "09:30", endsAt: "10:30", facultyAssignmentId: "assignment-2" }, [base])).toBe("room");
  });
  it("detects faculty conflicts even in different rooms", () => {
    expect(findTimetableConflict({ ...base, classroomId: "room-2", startsAt: "09:30" }, [base])).toBe("faculty");
  });
  it("detects the same faculty member across different assignments", () => {
    expect(findTimetableConflict({ ...base, classroomId: "room-2", facultyAssignmentId: "assignment-2", facultyId: "faculty-1" }, [{ ...base, facultyId: "faculty-1" }])).toBe("faculty");
  });
  it("allows adjacent periods and separate weekdays or validity ranges", () => {
    expect(findTimetableConflict({ ...base, startsAt: "10:00", endsAt: "11:00" }, [base])).toBeNull();
    expect(findTimetableConflict({ ...base, weekday: 2 }, [base])).toBeNull();
    expect(findTimetableConflict({ ...base, validFrom: "2030-01-01", validUntil: "2030-12-31" }, [{ ...base, validUntil: "2029-12-31" }])).toBeNull();
  });
});
