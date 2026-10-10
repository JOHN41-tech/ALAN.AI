import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";
import { addCalendarDays, dateKeyInZone, formatInCollegeTime, startOfDayInZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "My timetable" };
type Search = Promise<{ date?: string; view?: string }>;
type Session = { id: string; course_id: string; semester_id: string; section_id: string; faculty_assignment_id: string; substitute_faculty_id: string | null; classroom_id: string | null; starts_at: string; ends_at: string; status: string; change_note: string | null; cancellation_reason: string | null };
const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const prettyDay = (key: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));

export default async function TimetablePage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile();
  if (current.profile.role === "administrator") redirect("/admin/timetable");
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const { timeZone, error: settingsError } = await getCollegeSettings(supabase);
  const today = dateKeyInZone(new Date(), timeZone);
  const requested = params.date && isDateKey(params.date) ? params.date : today;
  const weekday = (new Date(`${requested}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addCalendarDays(requested, -weekday);
  const weekEnd = addCalendarDays(monday, 7);
  const daily = params.view === "day";
  const startKey = daily ? requested : monday;
  const endKey = daily ? addCalendarDays(requested, 1) : weekEnd;
  const start = startOfDayInZone(startKey, timeZone);
  const end = startOfDayInZone(endKey, timeZone);
  let sessions: Session[] = [];
  let queryError: string | undefined;
  if (current.profile.role === "student") {
    if (current.profile.section_id && current.profile.semester_id) {
      const result = await supabase.from("class_sessions").select("id,course_id,semester_id,section_id,faculty_assignment_id,substitute_faculty_id,classroom_id,starts_at,ends_at,status,change_note,cancellation_reason").eq("section_id", current.profile.section_id).eq("semester_id", current.profile.semester_id).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at");
      sessions = (result.data ?? []) as Session[];
      queryError = result.error?.message;
    }
  } else {
    const assignments = await supabase.from("faculty_assignments").select("id").eq("faculty_id", current.userId).eq("is_active", true);
    const ids = (assignments.data ?? []).map((item) => item.id);
    const [assigned, substitute] = await Promise.all([
      ids.length ? supabase.from("class_sessions").select("id,course_id,semester_id,section_id,faculty_assignment_id,substitute_faculty_id,classroom_id,starts_at,ends_at,status,change_note,cancellation_reason").in("faculty_assignment_id", ids).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()) : Promise.resolve({ data: [], error: null }),
      supabase.from("class_sessions").select("id,course_id,semester_id,section_id,faculty_assignment_id,substitute_faculty_id,classroom_id,starts_at,ends_at,status,change_note,cancellation_reason").eq("substitute_faculty_id", current.userId).gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()),
    ]);
    const map = new Map<string, Session>();
    for (const session of [...(assigned.data ?? []), ...(substitute.data ?? [])]) map.set(session.id, session as Session);
    sessions = [...map.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    queryError = assignments.error?.message ?? assigned.error?.message ?? substitute.error?.message;
  }
  const courseIds = [...new Set(sessions.map((session) => session.course_id))];
  const roomIds = [...new Set(sessions.flatMap((session) => session.classroom_id ? [session.classroom_id] : []))];
  const sessionIds = sessions.map((session) => session.id);
  const [courses, rooms, staff] = await Promise.all([
    courseIds.length ? supabase.from("courses").select("id,code,title").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
    roomIds.length ? supabase.from("classrooms").select("id,code,name").in("id", roomIds) : Promise.resolve({ data: [], error: null }),
    sessionIds.length ? supabase.from("class_session_staff_names").select("session_id,faculty_name,substitute_faculty_name").in("session_id", sessionIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const courseMap = new Map((courses.data ?? []).map((item) => [item.id, item]));
  const roomMap = new Map((rooms.data ?? []).map((item) => [item.id, item.code || item.name || "Room"]));
  const staffMap = new Map((staff.data ?? []).map((item) => [item.session_id, item.substitute_faculty_name ?? item.faculty_name]));
  queryError ??= courses.error?.message ?? rooms.error?.message ?? staff.error?.message;
  const dayKeys = daily ? [requested] : Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index));
  const byDay = new Map(dayKeys.map((key) => [key, sessions.filter((session) => dateKeyInZone(new Date(session.starts_at), timeZone) === key)]));
  const currentTimestamp = new Date().getTime();
  const future = sessions.find((session) => session.status === "scheduled" && Date.parse(session.starts_at) > currentTimestamp);
  const previousKey = addCalendarDays(daily ? requested : monday, -1);
  const nextKey = addCalendarDays(daily ? requested : monday, daily ? 1 : 7);
  const navigation = (date: string, view = daily ? "day" : "week") => `/timetable?date=${date}&view=${view}`;
  return <>
    <PageHeading title="My timetable" description={current.profile.role === "student" ? "Your dated classes, room changes and cancellations for the selected period." : "Your assigned or substitute class sessions."} />
    {(queryError || settingsError) && <div className="notice notice--warning">Some timetable details could not be loaded: {queryError ?? settingsError}</div>}
    <section className="surface timetable-panel"><div className="calendar-toolbar"><div><h2>{daily ? prettyDay(requested) : `${prettyDay(monday)} – ${prettyDay(addCalendarDays(monday, 6))}`}</h2><p className="muted-small">College time zone: {timeZone} · Dated sessions are authoritative for attendance.</p></div><div className="calendar-nav"><Link href={navigation(previousKey)} className="icon-button" aria-label={daily ? "Previous day" : "Previous week"}><ChevronLeft size={17} /></Link><Link href="/timetable" className="button button--secondary">This week</Link><Link href={navigation(nextKey)} className="icon-button" aria-label={daily ? "Next day" : "Next week"}><ChevronRight size={17} /></Link><Link href={navigation(requested, daily ? "week" : "day")} className="button button--secondary">{daily ? "Week view" : "Day view"}</Link></div></div>
      {future && <div className="next-class-callout"><span className="badge badge--blue">Next class</span><strong>{courseMap.get(future.course_id)?.code ?? "Class"} · {courseMap.get(future.course_id)?.title ?? "Upcoming session"}</strong><span>{formatInCollegeTime(future.starts_at, { dateStyle: "medium", timeStyle: "short" }, timeZone)}{future.classroom_id ? ` · ${roomMap.get(future.classroom_id) ?? "Room"}` : ""}</span></div>}
      {current.profile.role === "student" && (!current.profile.section_id || !current.profile.semester_id) && <EmptyState icon={CalendarDays} title="Academic placement is not set up" description="Ask an administrator to assign your program, semester and section. Your academic timetable will appear here." />}
      {current.profile.role === "student" && current.profile.section_id && !sessions.length && <EmptyState icon={CalendarDays} title="No dated sessions for this period" description="Your administrator may need to generate dated sessions from the recurring timetable. Cancellations and attendance apply to individual dated sessions." />}
      {current.profile.role === "faculty" && !sessions.length && <EmptyState icon={CalendarDays} title="No assigned sessions for this period" description="Dated class sessions assigned to you or set as a substitute will appear here." />}
      {sessions.length > 0 && <div className="timetable-day-list">{dayKeys.map((key) => { const items = byDay.get(key) ?? []; return <section className="timetable-day-block" key={key}><div className="timetable-day-heading"><span className="day-date-dot" /><h3>{prettyDay(key)}</h3><span className="badge">{items.length} {items.length === 1 ? "class" : "classes"}</span></div>{!items.length ? <p className="free-day">No classes scheduled · Free day</p> : <div className="timetable-slots">{items.map((session, index) => { const previousSession = items[index - 1]; const gap = previousSession ? (Date.parse(session.starts_at) - Date.parse(previousSession.ends_at)) / 60_000 : 0; const course = courseMap.get(session.course_id); return <div key={session.id}>{gap >= 30 && <div className="free-period">Free period · {Math.floor(gap / 60) ? `${Math.floor(gap / 60)}h ` : ""}{gap % 60 ? `${gap % 60} min` : ""}</div>}<article className={`timetable-slot ${session.status === "cancelled" ? "timetable-slot--cancelled" : ""} ${future?.id === session.id ? "timetable-slot--next" : ""}`}><div className="slot-time"><strong>{formatInCollegeTime(session.starts_at, undefined, timeZone)}</strong><span>{formatInCollegeTime(session.ends_at, undefined, timeZone)}</span></div><div className="slot-thread" /><div className="slot-copy"><div className="slot-title-row"><strong>{course?.code ?? "Class"} · {course?.title ?? "Course"}</strong><span className={`badge ${session.status === "cancelled" ? "badge--red" : session.status === "conducted" ? "badge--green" : "badge--blue"}`}>{session.status}</span></div><div className="slot-meta">{session.classroom_id && <span><MapPin size={12} /> {roomMap.get(session.classroom_id) ?? "Room"}</span>}{staffMap.get(session.id) && <span><Users size={12} /> {staffMap.get(session.id)}</span>}</div>{session.status === "cancelled" && session.cancellation_reason && <p className="status-low">Cancelled: {session.cancellation_reason}</p>}{session.change_note && session.status !== "cancelled" && <p className="muted-small">Update: {session.change_note}</p>}</div></article></div>; })}</div>}</section>; })}</div>}
    </section>
  </>;
}
