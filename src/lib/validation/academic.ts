import { z } from "zod";

const uuid = z.string().uuid();
const nonEmpty = (min: number, max: number) => z.string().trim().min(min).max(max);

export const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("college") }),
  z.object({ type: z.literal("department"), id: uuid }),
  z.object({ type: z.literal("semester"), id: uuid }),
  z.object({ type: z.literal("section"), id: uuid }),
]);

export const announcementSchema = z.object({
  title: nonEmpty(3, 180),
  summary: z.string().trim().max(360).optional().nullable(),
  body: nonEmpty(1, 20_000),
  category: nonEmpty(1, 48).default("general"),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  scheduledFor: z.iso.datetime().optional().nullable(),
  expiresAt: z.iso.datetime().optional().nullable(),
  targets: z.array(targetSchema).min(1),
});

export const academicEventSchema = z.object({
  title: nonEmpty(3, 180),
  description: z.string().trim().max(10_000).optional().nullable(),
  category: z.enum(["internal_exam", "semester_exam", "assignment", "project_review", "laboratory", "seminar", "holiday", "department_event", "other"]),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  timeZone: nonEmpty(1, 80).default("Asia/Kolkata"),
  location: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  targets: z.array(targetSchema).min(1),
}).refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), { message: "End time must be after start time.", path: ["endsAt"] });

export const timetableEntrySchema = z.object({
  courseId: uuid,
  semesterId: uuid,
  sectionId: uuid,
  facultyAssignmentId: uuid,
  classroomId: uuid.optional().nullable(),
  weekday: z.number().int().min(0).max(6),
  startsAtLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time."),
  endsAtLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time."),
  validFrom: z.iso.date(),
  validUntil: z.iso.date().optional().nullable(),
  timeZone: nonEmpty(1, 80).default("Asia/Kolkata"),
}).refine((value) => value.endsAtLocal > value.startsAtLocal, { message: "End time must be after start time.", path: ["endsAtLocal"] })
  .refine((value) => !value.validUntil || value.validUntil >= value.validFrom, { message: "Last date cannot be before the first date.", path: ["validUntil"] });

export const attendanceSubmissionSchema = z.object({
  sessionId: uuid,
  records: z.array(z.object({ studentId: uuid, status: z.enum(["present", "absent", "excused"]) })).min(1).max(200),
}).refine((value) => new Set(value.records.map((record) => record.studentId)).size === value.records.length, { message: "A student can appear only once in the submission.", path: ["records"] });
