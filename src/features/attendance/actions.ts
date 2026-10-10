"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const statuses = ["present", "absent", "excused"] as const;
const clean = (form: FormData, key: string, max = 1000) => String(form.get(key) ?? "").trim().slice(0, max);
const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);
const success = (path: string, message: string): never => redirect(`${path}?success=${encodeURIComponent(message)}`);

export async function submitClassAttendance(form: FormData) {
  await requireAuthenticatedProfile(["faculty"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const sessionId = clean(form, "session_id", 40);
  if (!uuid.safeParse(sessionId).success) return fail("/faculty/classes", "Class session identifier is invalid.");
  const { data: session, error: sessionError } = await supabase.from("class_sessions").select("id,status,starts_at,course_id,semester_id,section_id").eq("id", sessionId).maybeSingle();
  if (sessionError || !session) return fail("/faculty/classes", sessionError?.message ?? "This session is unavailable to your faculty account.");
  if (session.status === "cancelled") return fail("/faculty/classes", "Attendance cannot be recorded for a cancelled session.");
  if (new Date(session.starts_at).getTime() > Date.now()) return fail("/faculty/classes", "Attendance cannot be submitted before the class starts.");
  const { data: roster, error: rosterError } = await supabase.from("course_enrollments").select("student_id").eq("course_id", session.course_id).eq("semester_id", session.semester_id).eq("section_id", session.section_id).eq("status", "active");
  if (rosterError) return fail("/faculty/classes", rosterError.message);
  if (!roster?.length) return fail("/faculty/classes", "No active students are enrolled in this class session.");
  const records = roster.map((row) => ({ student_id: row.student_id, status: clean(form, `status_${row.student_id}`, 20) || "absent" }));
  if (records.some((record) => !statuses.includes(record.status as (typeof statuses)[number]))) return fail("/faculty/classes", "Choose present, absent or excused for every student.");
  const { error } = await supabase.rpc("submit_class_attendance", { p_session_id: sessionId, p_records: records });
  if (error) return fail("/faculty/classes", error.message);
  revalidatePath("/faculty/classes");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  success("/faculty/classes", `Attendance saved for ${records.length} enrolled students.`);
}

export async function requestAttendanceCorrection(form: FormData) {
  const current = await requireAuthenticatedProfile(["student", "faculty"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const recordId = clean(form, "attendance_record_id", 40);
  const requestedStatus = clean(form, "requested_status", 20);
  const reason = clean(form, "reason", 1000);
  const parsed = z.object({ recordId: uuid, requestedStatus: z.enum(statuses), reason: z.string().min(8).max(1000) }).safeParse({ recordId, requestedStatus, reason });
  if (!parsed.success) return fail("/attendance", parsed.error.issues[0]?.message ?? "Check the correction request.");
  const { data: record, error: readError } = await supabase.from("attendance_records").select("id,student_id,status").eq("id", recordId).maybeSingle();
  if (readError || !record) return fail("/attendance", readError?.message ?? "Attendance record is unavailable.");
  if (current.profile.role === "student" && record.student_id !== current.userId) return fail("/attendance", "Students can request changes only to their own attendance records.");
  const { error } = await supabase.from("attendance_correction_requests").insert({ attendance_record_id: recordId, requested_by: current.userId, requested_status: requestedStatus, reason: parsed.data.reason });
  if (error) return fail("/attendance", error.message);
  revalidatePath("/admin/attendance");
  success("/attendance", "Correction request submitted for administrator review. The official attendance record is unchanged until approval.");
}

export async function reviewAttendanceCorrection(form: FormData) {
  await requireAuthenticatedProfile(["administrator"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const requestId = clean(form, "request_id", 40);
  if (!uuid.safeParse(requestId).success) return fail("/admin/attendance", "Correction request identifier is invalid.");
  const approve = clean(form, "decision", 8) === "approve";
  const note = clean(form, "review_note", 1000) || null;
  const { error } = await supabase.rpc("review_attendance_correction", { p_request_id: requestId, p_approve: approve, p_review_note: note });
  if (error) return fail("/admin/attendance", error.message);
  revalidatePath("/admin/attendance");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  success("/admin/attendance", approve ? "Correction approved; the record and audit log were updated." : "Correction request rejected; the official record remains unchanged.");
}

export async function correctAttendance(form: FormData) {
  await requireAuthenticatedProfile(["administrator"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const recordId = clean(form, "attendance_record_id", 40);
  const status = clean(form, "new_status", 20);
  const reason = clean(form, "reason", 1000);
  const parsed = z.object({ recordId: uuid, status: z.enum(statuses), reason: z.string().min(8).max(1000) }).safeParse({ recordId, status, reason });
  if (!parsed.success) return fail("/admin/attendance", parsed.error.issues[0]?.message ?? "Check the correction details.");
  const { error } = await supabase.rpc("admin_correct_attendance", { p_record_id: parsed.data.recordId, p_new_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return fail("/admin/attendance", error.message);
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  success("/admin/attendance", "Attendance corrected and the audit record was written.");
}
