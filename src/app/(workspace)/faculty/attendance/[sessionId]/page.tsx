import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Info } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requestAttendanceCorrection, submitClassAttendance } from "@/features/attendance/actions";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatInCollegeTime } from "@/lib/timezone";

export const metadata: Metadata = { title: "Class attendance" };
type Props = { params: Promise<{ sessionId: string }>; searchParams: Promise<{ success?: string; error?: string }> };
type Student = { id: string; full_name: string; student_identifier: string | null };

export default async function FacultyAttendancePage({ params, searchParams }: Props) {
  await requireAuthenticatedProfile(["faculty"]);
  const [{ sessionId }, query, supabase] = await Promise.all([params, searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const { data: session, error } = await supabase.from("class_sessions").select("id,course_id,semester_id,section_id,classroom_id,starts_at,ends_at,status,cancellation_reason,faculty_assignment_id").eq("id", sessionId).maybeSingle();
  if (error || !session) notFound();
  const [course, section, room, roster, existing] = await Promise.all([
    supabase.from("courses").select("id,code,title").eq("id", session.course_id).maybeSingle(),
    supabase.from("sections").select("id,name").eq("id", session.section_id).maybeSingle(),
    session.classroom_id ? supabase.from("classrooms").select("id,code,name").eq("id", session.classroom_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("course_enrollments").select("student_id").eq("course_id", session.course_id).eq("semester_id", session.semester_id).eq("section_id", session.section_id).eq("status", "active"),
    supabase.from("attendance_records").select("id,student_id,status").eq("session_id", session.id),
  ]);
  const studentIds = (roster.data ?? []).map((item) => item.student_id);
  const { data: profiles, error: profileError } = studentIds.length ? await supabase.from("profiles").select("id,full_name,student_identifier").in("id", studentIds).order("full_name") : { data: [], error: null };
  const students = (profiles ?? []) as Student[];
  const attendanceMap = new Map((existing.data ?? []).map((item) => [item.student_id, item]));
  const currentTimestamp = new Date().getTime();
  const started = new Date(session.starts_at).getTime() <= currentTimestamp;
  const alreadySubmitted = session.status === "conducted" || attendanceMap.size > 0;
  const fetchError = [course.error, section.error, room.error, roster.error, existing.error, profileError].find(Boolean)?.message;
  return <>
    <Link href="/faculty/classes" className="back-link"><ArrowLeft size={15} /> Back to my classes</Link>
    <PageHeading title={`${course.data?.code ?? "Class"} · ${course.data?.title ?? "Attendance"}`} description={`${section.data?.name ? `Section ${section.data.name} · ` : ""}${formatInCollegeTime(session.starts_at, { dateStyle: "full", timeStyle: "short" })}–${formatInCollegeTime(session.ends_at)}${room.data ? ` · ${room.data.code || room.data.name}` : ""}`} />
    <StatusMessage error={query.error ?? fetchError} success={query.success} />
    {session.status === "cancelled" ? <div className="notice notice--warning"><Info size={16} /> This class was cancelled. Attendance cannot be submitted. {session.cancellation_reason}</div> : alreadySubmitted ? <div className="notice notice--info"><Info size={16} /> Attendance has already been submitted for this session. Official records are read-only here; request administrator correction if necessary.</div> : !started ? <div className="notice notice--warning"><Info size={16} /> Attendance opens at the class start time. Current class time: {formatInCollegeTime(session.starts_at, { dateStyle: "medium", timeStyle: "short" })}.</div> : <div className="notice notice--info"><ClipboardCheck size={16} /> Select a status for every actively enrolled student, then submit once. The database verifies your assignment and rejects duplicates or cancelled sessions.</div>}
    {!students.length ? <div className="surface panel"><p className="muted-small">No active students are enrolled in this class. Ask an administrator to check student placement and semester offerings.</p></div> : alreadySubmitted ? <div className="attendance-history">{students.map((student) => { const record = attendanceMap.get(student.id); return <article className="attendance-record-row" key={student.id}><div><strong>{student.full_name}</strong><span>{student.student_identifier ? `Student ID · ${student.student_identifier}` : "No student identifier"}</span></div><span className={`badge ${record?.status === "present" ? "badge--green" : record?.status === "excused" ? "badge--blue" : "badge--red"}`}>{record?.status ?? "No record"}</span>{record && <details><summary className="edit-summary">Request correction</summary><form action={requestAttendanceCorrection} className="correction-form"><input type="hidden" name="attendance_record_id" value={record.id} /><label className="field"><span className="field-label">Requested status</span><select name="requested_status" className="select" defaultValue={record.status}><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label><label className="field"><span className="field-label">Reason (at least 8 characters)</span><textarea name="reason" className="textarea" minLength={8} maxLength={1000} required /></label><button className="button button--secondary">Request correction</button></form></details>}</article>; })}</div> : <form action={submitClassAttendance} className="surface panel roster-form"><input type="hidden" name="session_id" value={session.id} /><div className="panel-heading"><div><h2>Class roster</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>{students.length} active students · attendance is saved as an atomic submission.</p></div></div>{students.map((student) => <label className="roster-row" key={student.id}><span><strong>{student.full_name}</strong><small>{student.student_identifier ? `ID · ${student.student_identifier}` : "Student"}</small></span><select name={`status_${student.id}`} className="select" required defaultValue=""><option value="" disabled>Select status</option><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label>)}<button className="button button--primary" type="submit"><ClipboardCheck size={15} /> Submit attendance</button></form>}
  </>;
}
