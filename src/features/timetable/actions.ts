"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";
import { localDateTimeToIso } from "@/lib/timezone";
import { findTimetableConflict, type TimetableSlot } from "@/features/timetable/conflicts";
import { addCalendarDays } from "@/lib/timezone";

const uuid = z.string().uuid();
const clean = (form: FormData, key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);
const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);
const success = (path: string, message: string): never => redirect(`${path}?success=${encodeURIComponent(message)}`);
const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

async function adminClient() {
  await requireAuthenticatedProfile(["administrator"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  return supabase;
}

export async function saveFacultyAssignment(form: FormData) {
  const supabase = await adminClient();
  const facultyId = clean(form, "faculty_id", 40);
  const courseId = clean(form, "course_id", 40);
  const semesterId = clean(form, "semester_id", 40);
  const sectionId = clean(form, "section_id", 40);
  if ([facultyId, courseId, semesterId, sectionId].some((value) => !uuid.safeParse(value).success)) return fail("/admin/timetable", "Choose a valid faculty member, course, semester and section.");
  const { error } = await supabase.from("faculty_assignments").upsert({ faculty_id: facultyId, course_id: courseId, semester_id: semesterId, section_id: sectionId, is_active: true }, { onConflict: "faculty_id,course_id,semester_id,section_id" });
  if (error) return fail("/admin/timetable", error.message);
  revalidatePath("/admin/timetable");
  revalidatePath("/faculty/classes");
  success("/admin/timetable", "Faculty assignment saved.");
}

export async function saveRecurringTimetableEntry(form: FormData) {
  const supabase = await adminClient();
  const settings = await getCollegeSettings(supabase);
  const id = clean(form, "id", 40) || null;
  const courseId = clean(form, "course_id", 40);
  const semesterId = clean(form, "semester_id", 40);
  const sectionId = clean(form, "section_id", 40);
  const assignmentId = clean(form, "faculty_assignment_id", 40);
  const classroomId = clean(form, "classroom_id", 40) || null;
  const weekday = Number(clean(form, "weekday", 2));
  const startsAt = clean(form, "starts_at_local", 12);
  const endsAt = clean(form, "ends_at_local", 12);
  const validFrom = clean(form, "valid_from", 10);
  const validUntil = clean(form, "valid_until", 10) || null;
  if ([courseId, semesterId, sectionId, assignmentId].some((value) => !uuid.safeParse(value).success) || (classroomId && !uuid.safeParse(classroomId).success)) return fail("/admin/timetable", "Choose valid course, semester, section, faculty assignment and room records.");
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !timePattern.test(startsAt) || !timePattern.test(endsAt) || startsAt >= endsAt || !datePattern.test(validFrom) || (validUntil && (!datePattern.test(validUntil) || validUntil < validFrom))) return fail("/admin/timetable", "Check the weekday, local times and validity dates; the end must follow the start.");
  if (id && !uuid.safeParse(id).success) return fail("/admin/timetable", "Recurring timetable record is invalid.");
  const { data: assignment, error: assignmentError } = await supabase.from("faculty_assignments").select("id,faculty_id,course_id,semester_id,section_id,is_active").eq("id", assignmentId).maybeSingle();
  if (assignmentError || !assignment || !assignment.is_active || assignment.course_id !== courseId || assignment.semester_id !== semesterId || assignment.section_id !== sectionId) return fail("/admin/timetable", assignmentError?.message ?? "Faculty assignment must be active and match the selected course, semester and section.");
  const { data: existing, error } = await supabase.from("timetable_entries").select("id,weekday,starts_at_local,ends_at_local,valid_from,valid_until,classroom_id,faculty_assignment_id,faculty_id").eq("weekday", weekday).eq("is_active", true);
  if (error) return fail("/admin/timetable", error.message);
  const candidate: TimetableSlot = { weekday, startsAt, endsAt, validFrom, validUntil, classroomId, facultyAssignmentId: assignmentId, facultyId: assignment.faculty_id };
  const comparable = (existing ?? []).filter((entry) => entry.id !== id).map((entry) => ({ weekday: entry.weekday, startsAt: entry.starts_at_local, endsAt: entry.ends_at_local, validFrom: entry.valid_from, validUntil: entry.valid_until, classroomId: entry.classroom_id, facultyAssignmentId: entry.faculty_assignment_id, facultyId: entry.faculty_id })) as TimetableSlot[];
  const conflict = findTimetableConflict(candidate, comparable);
  if (conflict) return fail("/admin/timetable", conflict === "room" ? "This classroom is already booked for an overlapping period." : "This faculty member is already assigned to an overlapping period.");
  const entry = { course_id: courseId, semester_id: semesterId, section_id: sectionId, faculty_assignment_id: assignmentId, classroom_id: classroomId, weekday, starts_at_local: startsAt, ends_at_local: endsAt, valid_from: validFrom, valid_until: validUntil, time_zone: settings.timeZone, is_active: true };
  const result = id ? await supabase.from("timetable_entries").update(entry).eq("id", id) : await supabase.from("timetable_entries").insert(entry);
  if (result.error) return fail("/admin/timetable", result.error.message);
  revalidatePath("/admin/timetable");
  revalidatePath("/timetable");
  success("/admin/timetable", "Recurring timetable entry saved. Generate dated class sessions separately so attendance applies to real meetings.");
}

export async function toggleRecurringTimetableEntry(form: FormData) {
  const supabase = await adminClient();
  const id = clean(form, "id", 40);
  const active = clean(form, "active", 8) === "true";
  if (!uuid.safeParse(id).success) return fail("/admin/timetable", "Recurring timetable identifier is invalid.");
  const { error } = await supabase.from("timetable_entries").update({ is_active: active }).eq("id", id);
  if (error) return fail("/admin/timetable", error.message);
  revalidatePath("/admin/timetable");
  revalidatePath("/timetable");
  success("/admin/timetable", active ? "Timetable recurrence activated." : "Timetable recurrence deactivated. Existing dated sessions remain unchanged.");
}

export async function generateClassSessions(form: FormData) {
  const supabase = await adminClient();
  const startOn = clean(form, "start_on", 10);
  const endOn = clean(form, "end_on", 10);
  if (!datePattern.test(startOn) || !datePattern.test(endOn)) return fail("/admin/timetable", "Choose a valid generation date range.");
  const days = (Date.parse(`${endOn}T00:00:00Z`) - Date.parse(`${startOn}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0 || days > 91) return fail("/admin/timetable", "Generate sessions for a maximum of 92 days at a time.");
  const { data, error } = await supabase.rpc("admin_generate_class_sessions", { p_start_on: startOn, p_end_on: endOn });
  if (error) return fail("/admin/timetable", error.message);
  revalidatePath("/admin/timetable");
  revalidatePath("/timetable");
  revalidatePath("/faculty/classes");
  revalidatePath("/dashboard");
  success("/admin/timetable", `${data ?? 0} dated session${data === 1 ? "" : "s"} generated. Existing occurrences and cancellations were left untouched.`);
}

export async function updateScheduledSession(form: FormData) {
  const supabase = await adminClient();
  const settings = await getCollegeSettings(supabase);
  const sessionId = clean(form, "session_id", 40);
  const action = clean(form, "action", 16);
  const note = clean(form, "change_note", 1000);
  if (!uuid.safeParse(sessionId).success) return fail("/admin/timetable", "Class session identifier is invalid.");
  const { data: session, error: readError } = await supabase.from("class_sessions").select("id,status").eq("id", sessionId).maybeSingle();
  if (readError || !session) return fail("/admin/timetable", readError?.message ?? "Class session was not found.");
  if (session.status !== "scheduled") return fail("/admin/timetable", "Only a scheduled class can be changed here; conducted records remain auditable.");
  if (action === "cancel") {
    const reason = clean(form, "cancellation_reason", 1000);
    if (reason.length < 8) return fail("/admin/timetable", "Cancellation reason must contain at least eight characters.");
    const { count, error: countError } = await supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
    if (countError) return fail("/admin/timetable", countError.message);
    if (count) return fail("/admin/timetable", "This class already has attendance records; review those records before cancelling the session.");
    const { error } = await supabase.from("class_sessions").update({ status: "cancelled", cancellation_reason: reason, change_note: note || reason }).eq("id", sessionId).eq("status", "scheduled");
    if (error) return fail("/admin/timetable", error.message);
    revalidatePath("/timetable"); revalidatePath("/faculty/classes"); revalidatePath("/dashboard");
    return success("/admin/timetable", "Class cancelled; enrolled students received an idempotent timetable notice.");
  }
  if (action !== "reschedule") return fail("/admin/timetable", "Choose cancellation or rescheduling.");
  if (note.length < 8) return fail("/admin/timetable", "Add a change note of at least eight characters for the reschedule notice.");
  const startsLocal = clean(form, "starts_at", 40);
  const endsLocal = clean(form, "ends_at", 40);
  const roomId = clean(form, "classroom_id", 40) || null;
  const substitute = clean(form, "substitute_faculty_id", 40) || null;
  if ((roomId && !uuid.safeParse(roomId).success) || (substitute && !uuid.safeParse(substitute).success)) return fail("/admin/timetable", "Room or substitute faculty selection is invalid.");
  let startsAt: string; let endsAt: string;
  try { startsAt = localDateTimeToIso(startsLocal, settings.timeZone); endsAt = localDateTimeToIso(endsLocal, settings.timeZone); }
  catch (error) { return fail("/admin/timetable", error instanceof Error ? error.message : "Session time is invalid."); }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return fail("/admin/timetable", "Session end must be after the start.");
  if (substitute) {
    const { data: profile } = await supabase.from("profiles").select("role,account_status").eq("id", substitute).maybeSingle();
    if (profile?.role !== "faculty" || profile.account_status !== "active") return fail("/admin/timetable", "Substitute must be an active faculty account.");
  }
  const { error } = await supabase.from("class_sessions").update({ starts_at: startsAt, ends_at: endsAt, classroom_id: roomId, substitute_faculty_id: substitute, change_note: note, cancellation_reason: null }).eq("id", sessionId).eq("status", "scheduled");
  if (error) return fail("/admin/timetable", error.message);
  revalidatePath("/admin/timetable"); revalidatePath("/timetable"); revalidatePath("/faculty/classes"); revalidatePath("/dashboard");
  success("/admin/timetable", "Class session rescheduled; affected students and faculty were notified.");
}

export async function currentWeekWindow(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const monday = addCalendarDays(date, -(weekday + 6) % 7);
  return { start: monday, end: addCalendarDays(monday, 7) };
}

export async function toggleFacultyAssignment(form: FormData) {
  const supabase = await adminClient();
  const id = clean(form, "id", 40);
  const active = clean(form, "active", 8) === "true";
  if (!uuid.safeParse(id).success) return fail("/admin/timetable", "Faculty assignment identifier is invalid.");
  const { error } = await supabase.from("faculty_assignments").update({ is_active: active }).eq("id", id);
  if (error) return fail("/admin/timetable", error.message);
  revalidatePath("/admin/timetable"); revalidatePath("/faculty/classes"); revalidatePath("/timetable");
  success("/admin/timetable", active ? "Faculty assignment activated." : "Faculty assignment deactivated; historical sessions remain unchanged.");
}
