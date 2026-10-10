import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requestAttendanceCorrection } from "@/features/attendance/actions";
import { calculateAttendancePercent, estimateClassesToTarget } from "@/features/attendance/calculations";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dateKeyInZone, formatInCollegeTime } from "@/lib/timezone";
import { getCollegeSettings } from "@/lib/college-settings";

export const metadata: Metadata = { title: "My attendance" };
type Search = Promise<{ error?: string; success?: string; course?: string; from?: string; to?: string }>;

type Summary = { course_id: string; semester_id: string; conducted_sessions: number; attended_sessions: number; attendance_percent: number | null };

export default async function StudentAttendancePage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const settings = await getCollegeSettings(supabase);
  const [enrollments, policy, records] = await Promise.all([
    supabase.from("course_enrollments").select("course_id,semester_id,section_id,status").eq("student_id", current.userId).eq("status", "active"),
    supabase.from("attendance_policies").select("minimum_percent,target_percent,excused_counts_as_conducted,excused_counts_as_attended").eq("is_active", true).maybeSingle(),
    supabase.from("attendance_records").select("id,status,created_at,session_id").eq("student_id", current.userId).order("created_at", { ascending: false }).limit(50),
  ]);
  const courseIds = [...new Set((enrollments.data ?? []).map((item) => item.course_id))];
  const summaryQuery = supabase.from("student_attendance_summary").select("course_id,semester_id,conducted_sessions,attended_sessions,attendance_percent").eq("student_id", current.userId);
  const [{ data: courseRows, error: courseError }, { data: summaryRows, error: summaryError }] = await Promise.all([
    courseIds.length ? supabase.from("courses").select("id,code,title").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
    summaryQuery,
  ]);
  const summaries = (summaryRows ?? []) as Summary[];
  const courseMap = new Map((courseRows ?? []).map((course) => [course.id, course]));
  const summaryMap = new Map(summaries.map((item) => [item.course_id, item]));
  const enrolledCourses = courseIds.map((id) => ({ course: courseMap.get(id), summary: summaryMap.get(id) })).filter((item) => item.course);
  const totalAttended = summaries.reduce((sum, row) => sum + row.attended_sessions, 0);
  const totalConducted = summaries.reduce((sum, row) => sum + row.conducted_sessions, 0);
  const overall = calculateAttendancePercent({ attended: totalAttended, conducted: totalConducted });
  const minimum = Number(policy.data?.minimum_percent ?? 75);
  const target = Number(policy.data?.target_percent ?? minimum);
  const recordsList = records.data ?? [];
  const sessionIds = [...new Set(recordsList.map((item) => item.session_id))];
  const { data: sessions, error: sessionError } = sessionIds.length ? await supabase.from("class_sessions").select("id,course_id,starts_at").in("id", sessionIds) : { data: [], error: null };
  const sessionMap = new Map((sessions ?? []).map((session) => [session.id, session]));
  const validDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
  const fromDate = validDate(params.from) ? params.from : undefined;
  const toDate = validDate(params.to) ? params.to : undefined;
  const filteredRecords = recordsList.filter((record) => {
    const session = sessionMap.get(record.session_id);
    if (params.course && session?.course_id !== params.course) return false;
    const day = dateKeyInZone(new Date(session?.starts_at ?? record.created_at), settings.timeZone);
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  });
  const noticeError = [enrollments.error, policy.error, records.error, courseError, summaryError, sessionError].find(Boolean)?.message ?? settings.error ?? undefined;
  return <>
    <PageHeading title="My attendance" description="Official class records use conducted sessions only; cancelled sessions are excluded." />
    <StatusMessage error={params.error ?? noticeError} success={params.success} />
    <div className="stat-grid"><div className="surface stat-card"><div className="stat-label">Overall attendance</div><div className="stat-value">{overall === null ? "—" : `${overall}%`}</div><div className="stat-hint">{totalAttended} attended · {totalConducted} counted conducted</div></div><div className="surface stat-card"><div className="stat-label">Minimum threshold</div><div className="stat-value">{minimum}%</div><div className="stat-hint">College policy; excused rules configured by administrators</div></div><div className="surface stat-card"><div className="stat-label">Subjects below threshold</div><div className="stat-value">{enrolledCourses.filter(({ summary }) => summary && summary.conducted_sessions > 0 && summary.attendance_percent !== null && summary.attendance_percent < minimum).length}</div><div className="stat-hint">Based on active enrollments</div></div><div className="surface stat-card"><div className="stat-label">At target</div><div className="stat-value">{overall !== null && overall >= target ? "Yes" : "—"}</div><div className="stat-hint">Target is {target}%</div></div></div>
    {policy.data && <div className="notice notice--info" style={{ marginTop: 14 }}>Excused sessions {policy.data.excused_counts_as_conducted ? "count as conducted" : "do not count as conducted"}; excused sessions {policy.data.excused_counts_as_attended ? "count as attended" : "do not count as attended"}. Attendance estimates assume perfect attendance at future conducted sessions and are not guarantees.</div>}
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Subject breakdown</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Percentage = counted attended ÷ counted conducted × 100.</p></div><span className="badge">{enrolledCourses.length} active courses</span></div>
      {!enrolledCourses.length ? <EmptyState icon={ClipboardCheck} title="No active course enrollments" description="Your administrator must assign your program, semester and section, then configure course offerings." /> : <div className="attendance-course-list">{enrolledCourses.map(({ course, summary }) => {
        const attended = summary?.attended_sessions ?? 0; const conducted = summary?.conducted_sessions ?? 0; const percent = summary?.attendance_percent ?? null; const below = percent !== null && percent < minimum; const remaining = estimateClassesToTarget({ attended, conducted }, target);
        return <article className="attendance-course-card" key={course!.id}><div className="attendance-course-heading"><div><strong>{course!.code} · {course!.title}</strong><span>{attended} attended from {conducted} counted conducted</span></div><div className={`attendance-percent ${below ? "attendance-percent--low" : ""}`}>{percent === null ? "—" : `${percent}%`}</div></div><div className="progress-track"><div className={`progress-fill ${below ? "progress-fill--low" : ""}`} style={{ width: `${Math.min(percent ?? 0, 100)}%` }} /></div><div className="attendance-course-footer">{below ? <span className="status-low"><AlertTriangle size={13} /> Below the {minimum}% minimum</span> : <span className="status-good">{percent === null ? "No conducted classes yet" : "Within the current threshold"}</span>}<span>{remaining === null ? percent === null ? "Estimate available after first counted class" : `Target of ${target}% cannot be reached with only future perfect attendance` : remaining === 0 ? `At the ${target}% target` : `About ${remaining} future classes to reach ${target}%`}</span></div></article>;
      })}</div>}
    </section>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Attendance history</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Filter by subject or class date. If a record looks wrong, submit a request; only an administrator can change official attendance.</p></div></div>
      <form method="get" className="attendance-filter-form"><label className="field"><span className="field-label">Subject</span><select className="select" name="course" defaultValue={params.course ?? ""}><option value="">All subjects</option>{enrolledCourses.map(({ course }) => course && <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label><label className="field"><span className="field-label">From</span><input className="input" type="date" name="from" defaultValue={fromDate ?? ""} /></label><label className="field"><span className="field-label">Through</span><input className="input" type="date" name="to" defaultValue={toDate ?? ""} /></label><button className="button button--secondary" type="submit">Filter history</button><a href="/attendance" className="back-link">Clear filters</a></form>
      {!recordsList.length ? <EmptyState icon={ClipboardCheck} title="No attendance records yet" description="After faculty submit a conducted class, your official record will appear here." /> : !filteredRecords.length ? <EmptyState icon={ClipboardCheck} title="No records match these filters" description="Try a different subject or date range." /> : <div className="attendance-history">{filteredRecords.map((record) => { const session = sessionMap.get(record.session_id); const course = session ? courseMap.get(session.course_id) : null; return <article className="attendance-record-row" key={record.id}><div><strong>{course ? `${course.code} · ${course.title}` : "Class attendance"}</strong><span>{session ? formatInCollegeTime(session.starts_at, { dateStyle: "medium", timeStyle: "short" }, settings.timeZone) : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: settings.timeZone }).format(new Date(record.created_at))}</span></div><span className={`badge ${record.status === "present" ? "badge--green" : record.status === "excused" ? "badge--blue" : "badge--red"}`}>{record.status}</span><details><summary className="edit-summary">Request correction</summary><form action={requestAttendanceCorrection} className="correction-form"><input type="hidden" name="attendance_record_id" value={record.id} /><label className="field"><span className="field-label">Requested status</span><select name="requested_status" className="select" defaultValue={record.status}><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label><label className="field"><span className="field-label">Reason (at least 8 characters)</span><textarea className="textarea" name="reason" minLength={8} maxLength={1000} required /></label><button type="submit" className="button button--secondary">Submit request</button></form></details></article>; })}</div>}
    </section>
  </>;
}
