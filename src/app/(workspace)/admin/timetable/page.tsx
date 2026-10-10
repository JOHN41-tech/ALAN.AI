import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, Clock3, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { AssignmentToggle, FacultyAssignmentForm, GenerateSessionsForm, RecurringEntryForm, RecurringEntryToggle, SessionMaintenanceForm } from "@/features/timetable/forms";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";
import { addCalendarDays, dateKeyInZone, formatInCollegeTime, startOfDayInZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Timetable management" };
type Search = Promise<{ error?: string; success?: string }>;

export default async function AdminTimetablePage({ searchParams }: { searchParams: Search }) {
  await requireAuthenticatedProfile(["administrator"]);
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const { timeZone, error: settingsError } = await getCollegeSettings(supabase);
  const today = dateKeyInZone(new Date(), timeZone);
  const sessionEnd = startOfDayInZone(addCalendarDays(today, 46), timeZone);
  const [facultyRows, courses, semesters, sections, rooms, assignments, entries, sessions] = await Promise.all([
    supabase.from("profiles").select("id,full_name,college_email").eq("role", "faculty").eq("account_status", "active").order("full_name"),
    supabase.from("courses").select("id,code,title").eq("is_active", true).order("code"),
    supabase.from("semesters").select("id,name,number").order("starts_on", { ascending: false }),
    supabase.from("sections").select("id,name,is_active").eq("is_active", true).order("name"),
    supabase.from("classrooms").select("id,code,name,is_active").eq("is_active", true).order("code"),
    supabase.from("faculty_assignments").select("id,faculty_id,course_id,semester_id,section_id,is_active").order("is_active", { ascending: false }),
    supabase.from("timetable_entries").select("id,course_id,semester_id,section_id,faculty_assignment_id,classroom_id,weekday,starts_at_local,ends_at_local,valid_from,valid_until,is_active").order("weekday").order("starts_at_local"),
    supabase.from("class_sessions").select("id,timetable_entry_id,course_id,semester_id,section_id,faculty_assignment_id,classroom_id,starts_at,ends_at,status,cancellation_reason,substitute_faculty_id").gte("starts_at", startOfDayInZone(today, timeZone).toISOString()).lt("starts_at", sessionEnd.toISOString()).order("starts_at").limit(300),
  ]);
  const faculty = facultyRows.data ?? [];
  const courseList = courses.data ?? [];
  const semesterList = semesters.data ?? [];
  const sectionList = sections.data ?? [];
  const roomList = rooms.data ?? [];
  const assignmentList = assignments.data ?? [];
  const entryList = entries.data ?? [];
  const sessionList = sessions.data ?? [];
  const facultyMap = new Map(faculty.map((person) => [person.id, person.full_name]));
  const courseMap = new Map(courseList.map((course) => [course.id, course]));
  const sectionMap = new Map(sectionList.map((section) => [section.id, section.name]));
  const assignmentMap = new Map(assignmentList.map((assignment) => [assignment.id, assignment]));
  const fetchError = [facultyRows.error, courses.error, semesters.error, sections.error, rooms.error, assignments.error, entries.error, sessions.error].find(Boolean)?.message;
  return <>
    <PageHeading title="Timetable management" description="Separate recurring weekly patterns from dated class meetings so attendance and changes remain historically accurate." />
    <StatusMessage error={params.error ?? fetchError ?? settingsError ?? undefined} success={params.success} />
    <section className="surface panel"><div className="panel-heading"><div><h2>Assign faculty to a course offering</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>A valid active course offering and section/semester pairing are required.</p></div><Users size={18} /></div><FacultyAssignmentForm faculties={faculty} courses={courseList} semesters={semesterList} sections={sectionList} />
      {!assignmentList.length ? <p className="muted-small" style={{ marginTop: 16 }}>No faculty assignments yet.</p> : <div className="catalog-list" style={{ marginTop: 18 }}>{assignmentList.map((assignment) => { const course = courseMap.get(assignment.course_id); return <article className="catalog-row assignment-row" key={assignment.id}><div className="catalog-summary"><div><strong>{facultyMap.get(assignment.faculty_id) ?? "Faculty"} · {course ? `${course.code} ${course.title}` : "Course"}</strong><span>{sectionMap.get(assignment.section_id) ?? "Section"} · {semesterList.find((item) => item.id === assignment.semester_id)?.name ?? "Semester"}</span></div><span className={`badge ${assignment.is_active ? "badge--green" : "badge--amber"}`}>{assignment.is_active ? "Active" : "Inactive"}</span><AssignmentToggle assignment={assignment} /></div></article>; })}</div>}
    </section>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Weekly recurring timetable</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Define course, section, weekday, local-time range, room, assigned faculty and validity dates. All clock times use {timeZone}.</p></div><Clock3 size={18} /></div><RecurringEntryForm assignments={assignmentList} courses={courseList} semesters={semesterList} sections={sectionList} rooms={roomList} timeZone={timeZone} />
      {!entryList.length ? <p className="muted-small" style={{ marginTop: 16 }}>No recurring timetable entries yet.</p> : <div className="catalog-list" style={{ marginTop: 18 }}>{entryList.map((entry) => { const assignment = assignmentMap.get(entry.faculty_assignment_id); const course = courseMap.get(entry.course_id); const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][entry.weekday]; return <article className="catalog-row" key={entry.id}><div className="catalog-summary"><div><strong>{weekday} · {entry.starts_at_local.slice(0, 5)}–{entry.ends_at_local.slice(0, 5)} · {course?.code ?? "Course"} {course?.title ?? ""}</strong><span>{sectionMap.get(entry.section_id) ?? "Section"} · {facultyMap.get(assignment?.faculty_id ?? "") ?? "Faculty"} · Valid from {entry.valid_from}{entry.valid_until ? ` through ${entry.valid_until}` : ""}</span></div><span className={`badge ${entry.is_active ? "badge--green" : "badge--amber"}`}>{entry.is_active ? "Active" : "Inactive"}</span><RecurringEntryToggle entry={entry} /></div><details><summary className="edit-summary">Edit recurring entry</summary><div className="record-create-inner"><RecurringEntryForm entry={entry} assignments={assignmentList} courses={courseList} semesters={semesterList} sections={sectionList} rooms={roomList} timeZone={timeZone} /></div></details></article>; })}</div>}
    </section>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Generate dated class sessions</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Creates each valid weekday occurrence in the date window; existing meetings and cancellations are not overwritten.</p></div><CalendarDays size={18} /></div><GenerateSessionsForm timeZone={timeZone} /></section>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Upcoming dated sessions</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Rescheduling and cancellations apply to one actual meeting, not the weekly definition.</p></div><span className="badge">{sessionList.length} sessions</span></div>
      {!sessionList.length ? <EmptyState icon={CalendarDays} title="No generated sessions" description="Create active recurring entries, choose a date window above, and generate the dated class meetings." /> : <div className="catalog-list">{sessionList.map((session) => { const course = courseMap.get(session.course_id); const assignment = assignmentMap.get(session.faculty_assignment_id); return <article className="catalog-row" key={session.id}><div className="catalog-summary"><div><strong>{course ? `${course.code} · ${course.title}` : "Class session"} · {sectionMap.get(session.section_id) ?? "Section"}</strong><span>{formatInCollegeTime(session.starts_at, { dateStyle: "medium", timeStyle: "short" }, timeZone)}–{formatInCollegeTime(session.ends_at, undefined, timeZone)} · {facultyMap.get(session.substitute_faculty_id ?? assignment?.faculty_id ?? "") ?? "Faculty"}</span></div><span className={`badge ${session.status === "conducted" ? "badge--green" : session.status === "cancelled" ? "badge--red" : "badge--blue"}`}>{session.status}</span></div>{session.status === "scheduled" && <SessionMaintenanceForm session={session} rooms={roomList} faculties={faculty} timeZone={timeZone} />}</article>; })}</div>}
    </section>
  </>;
}
