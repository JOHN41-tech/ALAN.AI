import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { correctAttendance, reviewAttendanceCorrection } from "@/features/attendance/actions";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatInCollegeTime } from "@/lib/timezone";

export const metadata: Metadata = { title: "Attendance review" };
type Search = Promise<{ error?: string; success?: string }>;

export default async function AdminAttendancePage({ searchParams }: { searchParams: Search }) {
  await requireAuthenticatedProfile(["administrator"]);
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const [policy, requests, records] = await Promise.all([
    supabase.from("attendance_policies").select("minimum_percent,target_percent,excused_counts_as_conducted,excused_counts_as_attended").eq("is_active", true).maybeSingle(),
    supabase.from("attendance_correction_requests").select("id,attendance_record_id,requested_by,requested_status,reason,created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(100),
    supabase.from("attendance_records").select("id,student_id,session_id,status,created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  const studentIds = [...new Set([...(records.data ?? []).map((item) => item.student_id), ...(requests.data ?? []).map((item) => item.requested_by)])];
  const sessionIds = [...new Set((records.data ?? []).map((item) => item.session_id))];
  const requestRecordIds = [...new Set((requests.data ?? []).map((item) => item.attendance_record_id))];
  const [{ data: requestRecords }, { data: profiles }] = await Promise.all([
    requestRecordIds.length ? supabase.from("attendance_records").select("id,student_id,session_id,status").in("id", requestRecordIds) : Promise.resolve({ data: [], error: null }),
    studentIds.length ? supabase.from("profiles").select("id,full_name,college_email").in("id", studentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const allSessionIds = [...new Set([...sessionIds, ...(requestRecords ?? []).map((row) => row.session_id)])];
  const { data: sessions } = allSessionIds.length ? await supabase.from("class_sessions").select("id,course_id,starts_at").in("id", allSessionIds) : { data: [] };
  const allSessions = sessions ?? [];
  const courseIds = [...new Set(allSessions.map((item) => item.course_id))];
  const { data: courses } = courseIds.length ? await supabase.from("courses").select("id,code,title").in("id", courseIds) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((person) => [person.id, person]));
  const sessionMap = new Map(allSessions.map((item) => [item.id, item]));
  const courseMap = new Map((courses ?? []).map((item) => [item.id, item]));
  const recordMap = new Map((requestRecords ?? []).map((item) => [item.id, item]));
  const requestItems = (requests.data ?? []).map((request) => ({ request, record: recordMap.get(request.attendance_record_id) }));
  const queryError = [policy.error, requests.error, records.error].find(Boolean)?.message;
  return <>
    <PageHeading title="Attendance review" description="Review correction requests and make direct corrections only with a documented reason." />
    <StatusMessage error={params.error ?? queryError} success={params.success} />
    <div className="stat-grid"><div className="surface stat-card"><div className="stat-label">Minimum attendance</div><div className="stat-value">{policy.data?.minimum_percent ?? 75}%</div><div className="stat-hint">Active college policy</div></div><div className="surface stat-card"><div className="stat-label">Target</div><div className="stat-value">{policy.data?.target_percent ?? 75}%</div><div className="stat-hint">Used for student estimates</div></div><div className="surface stat-card"><div className="stat-label">Pending corrections</div><div className="stat-value">{requestItems.length}</div><div className="stat-hint">Awaiting administrator review</div></div></div>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Correction requests</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Approval updates the official attendance row and inserts an audit record atomically.</p></div></div>
      {!requestItems.length ? <EmptyState icon={ClipboardCheck} title="No pending requests" description="New student/faculty requests will appear here." /> : <div className="catalog-list">{requestItems.map(({ request, record }) => { const student = record ? profileMap.get(record.student_id) : profileMap.get(request.requested_by); const session = record ? sessionMap.get(record.session_id) : null; const course = session ? courseMap.get(session.course_id) : null; return <article className="catalog-row" key={request.id}><div className="catalog-summary"><div><strong>{student?.full_name ?? "Profile"} · {course ? `${course.code} ${course.title}` : "Attendance"}</strong><span>Current: {record?.status ?? "unknown"} → Requested: {request.requested_status} · {session ? formatInCollegeTime(session.starts_at, { dateStyle: "medium", timeStyle: "short" }) : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(request.created_at))}</span><span>Reason: {request.reason}</span></div><span className="badge badge--amber">Pending</span></div><form action={reviewAttendanceCorrection} className="review-form"><input type="hidden" name="request_id" value={request.id} /><label className="field"><span className="field-label">Review note (optional)</span><input className="input" name="review_note" maxLength={1000} /></label><button className="button button--primary" name="decision" value="approve">Approve &amp; apply</button><button className="button button--secondary" name="decision" value="reject">Reject</button></form></article>; })}</div>}
    </section>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Recent official records</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Direct corrections require a reason of at least eight characters and are audit logged.</p></div><span className="badge">{records.data?.length ?? 0} recent</span></div>{!records.data?.length ? <EmptyState icon={ClipboardCheck} title="No attendance records yet" description="Faculty-submitted records will appear here." /> : <div className="attendance-history">{records.data.map((record) => { const student = profileMap.get(record.student_id); const session = sessionMap.get(record.session_id); const course = session ? courseMap.get(session.course_id) : null; return <article className="attendance-record-row attendance-admin-record" key={record.id}><div><strong>{student?.full_name ?? "Student"} · {course ? `${course.code} ${course.title}` : "Class attendance"}</strong><span>{session ? formatInCollegeTime(session.starts_at, { dateStyle: "medium", timeStyle: "short" }) : new Date(record.created_at).toLocaleDateString()} · {record.status}</span></div><details><summary className="edit-summary">Correct record</summary><form action={correctAttendance} className="correction-form"><input type="hidden" name="attendance_record_id" value={record.id} /><label className="field"><span className="field-label">Correct status</span><select name="new_status" className="select" defaultValue={record.status}><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label><label className="field"><span className="field-label">Reason (at least 8 characters)</span><textarea name="reason" className="textarea" minLength={8} maxLength={1000} required /></label><button type="submit" className="button button--secondary">Apply correction</button></form></details></article>; })}</div>}</section>
  </>;
}
