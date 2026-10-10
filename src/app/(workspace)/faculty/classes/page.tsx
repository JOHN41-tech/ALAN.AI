import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardCheck, MapPin } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";
import { addCalendarDays, dateKeyInZone, startOfDayInZone, formatInCollegeTime } from "@/lib/timezone";

export const metadata: Metadata = { title: "Faculty classes" };
type Search = Promise<{ error?: string; success?: string }>;
type Session = { id: string; course_id: string; semester_id: string; section_id: string; faculty_assignment_id: string; classroom_id: string | null; starts_at: string; ends_at: string; status: string; cancellation_reason: string | null; substitute_faculty_id: string | null };

export default async function FacultyClassesPage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile(["faculty"]);
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const settings = await getCollegeSettings(supabase);
  const assignments = await supabase.from("faculty_assignments").select("id").eq("faculty_id", current.userId).eq("is_active", true);
  const day = dateKeyInZone(new Date(), settings.timeZone);
  const start = startOfDayInZone(day, settings.timeZone);
  const end = startOfDayInZone(addCalendarDays(day, 8), settings.timeZone);
  const ids = (assignments.data ?? []).map((assignment) => assignment.id);
  const [assignedSessions, substituteSessions] = await Promise.all([
    ids.length ? supabase.from("class_sessions").select("id,course_id,semester_id,section_id,faculty_assignment_id,classroom_id,starts_at,ends_at,status,cancellation_reason,substitute_faculty_id").in("faculty_assignment_id", ids).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()) : Promise.resolve({ data: [], error: null }),
    supabase.from("class_sessions").select("id,course_id,semester_id,section_id,faculty_assignment_id,classroom_id,starts_at,ends_at,status,cancellation_reason,substitute_faculty_id").eq("substitute_faculty_id", current.userId).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()),
  ]);
  const sessionMap = new Map<string, Session>();
  for (const session of [...(assignedSessions.data ?? []), ...(substituteSessions.data ?? [])]) sessionMap.set(session.id, session as Session);
  const sessions = [...sessionMap.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const courseIds = [...new Set(sessions.map((session) => session.course_id))];
  const sectionIds = [...new Set(sessions.map((session) => session.section_id))];
  const roomIds = [...new Set(sessions.flatMap((session) => session.classroom_id ? [session.classroom_id] : []))];
  const sessionIds = sessions.map((session) => session.id);
  const [courses, sections, rooms, counts] = await Promise.all([
    courseIds.length ? supabase.from("courses").select("id,code,title").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
    sectionIds.length ? supabase.from("sections").select("id,name").in("id", sectionIds) : Promise.resolve({ data: [], error: null }),
    roomIds.length ? supabase.from("classrooms").select("id,code,name").in("id", roomIds) : Promise.resolve({ data: [], error: null }),
    sessionIds.length ? supabase.from("course_enrollments").select("course_id,section_id,semester_id").eq("status", "active").in("course_id", courseIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const courseMap = new Map((courses.data ?? []).map((item) => [item.id, item]));
  const sectionMap = new Map((sections.data ?? []).map((item) => [item.id, item.name]));
  const roomMap = new Map((rooms.data ?? []).map((item) => [item.id, item.code || item.name || "Room"]));
  const rosterCounts = new Map<string, number>();
  for (const row of counts.data ?? []) { const key = `${row.course_id}:${row.semester_id}:${row.section_id}`; rosterCounts.set(key, (rosterCounts.get(key) ?? 0) + 1); }
  const fetchError = [assignments.error, assignedSessions.error, substituteSessions.error, courses.error, sections.error, rooms.error, counts.error].find(Boolean)?.message ?? settings.error ?? undefined;
  const currentTimestamp = new Date().getTime();
  return <>
    <PageHeading title="My classes" description="Your assigned and substitute sessions for the next seven days." />
    <StatusMessage error={params.error ?? fetchError} success={params.success} />
    {!sessions.length ? <EmptyState icon={CalendarDays} title="No scheduled sessions this week" description="Upcoming dated class sessions assigned to you will appear here." /> : <div className="session-list">{sessions.map((session) => { const course = courseMap.get(session.course_id); const room = session.classroom_id ? roomMap.get(session.classroom_id) : null; const rosterKey = `${session.course_id}:${session.semester_id}:${session.section_id}`; const rosterCount = rosterCounts.get(rosterKey) ?? 0; const notYet = new Date(session.starts_at).getTime() > currentTimestamp; return <article className="surface session-card" key={session.id}><div className="session-date"><strong>{formatInCollegeTime(session.starts_at, { day: "numeric" }, settings.timeZone)}</strong><span>{formatInCollegeTime(session.starts_at, { weekday: "short", month: "short" }, settings.timeZone)}</span></div><div className="session-copy"><div className="session-title-row"><h2>{course?.code ?? "Class"} · {course?.title ?? "Course"}</h2><span className={`badge ${session.status === "cancelled" ? "badge--red" : session.status === "conducted" ? "badge--green" : "badge--blue"}`}>{session.status}</span></div><p>{formatInCollegeTime(session.starts_at, undefined, settings.timeZone)}–{formatInCollegeTime(session.ends_at, undefined, settings.timeZone)} · Section {sectionMap.get(session.section_id) ?? "—"} · {rosterCount} enrolled</p>{room && <p><MapPin size={13} /> {room}</p>}{session.status === "cancelled" && <p className="status-low">{session.cancellation_reason}</p>}</div><Link className={`button ${session.status === "cancelled" ? "button--secondary" : "button--primary"}`} href={`/faculty/attendance/${session.id}`} aria-disabled={session.status === "cancelled"} tabIndex={session.status === "cancelled" ? -1 : undefined}><ClipboardCheck size={15} /> {session.status === "conducted" ? "View record" : notYet ? "View roster" : "Take attendance"}</Link></article>; })}</div>}
  </>;
}
