import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";
import { addCalendarDays, dateKeyInZone, formatInCollegeTime, startOfDayInZone } from "@/lib/timezone";

export const metadata: Metadata = { title: "Academic calendar" };
type Search = Promise<{ year?: string; month?: string; day?: string; view?: string; event?: string; error?: string; success?: string }>;
type EventRow = { id: string; title: string; description: string | null; category: string; starts_at: string; ends_at: string; location: string | null };
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile();
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const { timeZone, error: settingsError } = await getCollegeSettings(supabase);
  const todayKey = dateKeyInZone(new Date(), timeZone);
  const [thisYear, thisMonth] = todayKey.split("-").map(Number);
  let year = Number(params.year) || thisYear;
  let month = Number(params.month) || thisMonth;
  if (year < 2000 || year > 2100) year = thisYear;
  if (month < 1 || month > 12) month = thisMonth;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthStart = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const startDate = startOfDayInZone(monthStart, timeZone);
  const endDate = startOfDayInZone(nextMonthStart, timeZone);
  const { data, error } = await supabase.from("academic_events").select("id,title,description,category,starts_at,ends_at,location").lt("starts_at", endDate.toISOString()).gt("ends_at", startDate.toISOString()).order("starts_at").limit(300);
  const events = (data ?? []) as EventRow[];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  let keys = Array.from({ length: daysInMonth }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
  if (params.view === "week" && params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)) {
    const dayOfWeek = (new Date(`${params.day}T00:00:00Z`).getUTCDay() + 6) % 7;
    const monday = addCalendarDays(params.day, -dayOfWeek);
    keys = Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index));
  }
  const gridKeys = params.view === "week" ? keys : [...Array.from({ length: firstDayOffset }, () => ""), ...keys];
  const selectedEvent = params.event ? events.find((event) => event.id === params.event) : null;
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const monthLink = (date: Date) => `/calendar?year=${date.getUTCFullYear()}&month=${date.getUTCMonth() + 1}`;
  const eventsByDay = new Map<string, EventRow[]>();
  for (const event of events) {
    const key = dateKeyInZone(new Date(event.starts_at), timeZone);
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }
  return <>
    <PageHeading title="Academic calendar" description="Examinations, deadlines, college holidays and other events for your group." action={current.profile.role === "administrator" ? <Link className="button button--primary" href="/admin/events">Manage events</Link> : undefined} />
    <StatusMessage error={params.error ?? error?.message ?? settingsError ?? undefined} success={params.success} />
    <section className="surface calendar-panel"><div className="calendar-toolbar"><div><h2>{params.view === "week" ? "Selected week" : new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone }).format(firstOfMonth)}</h2><p className="muted-small">Times shown in {timeZone}.</p></div><div className="calendar-nav"><Link className="icon-button" href={monthLink(previous)} aria-label="Previous month"><ChevronLeft size={17} /></Link><Link className="button button--secondary" href="/calendar">This month</Link><Link className="icon-button" href={monthLink(next)} aria-label="Next month"><ChevronRight size={17} /></Link><Link className="button button--secondary" href={`/calendar?year=${year}&month=${month}&day=${params.day || todayKey}&view=${params.view === "week" ? "month" : "week"}`}>{params.view === "week" ? "Month view" : "Week view"}</Link></div></div>
      <div className="calendar-grid"><div className="calendar-weekdays">{weekdays.map((day) => <div key={day}>{day}</div>)}</div><div className="calendar-days">{gridKeys.map((key, index) => key ? <div className={`calendar-day ${key === todayKey ? "calendar-day--today" : ""}`} key={key}><Link href={`/calendar?year=${year}&month=${month}&day=${key}&view=week`} className="calendar-day-number" aria-label={`Show week of ${key}`}>{Number(key.slice(-2))}</Link>{(eventsByDay.get(key) ?? []).slice(0, 3).map((event) => <Link href={`/calendar?year=${year}&month=${month}&event=${event.id}`} key={event.id} className="calendar-event-chip" title={event.title}>{event.title}</Link>)}{(eventsByDay.get(key)?.length ?? 0) > 3 && <span className="muted-small">+{(eventsByDay.get(key)?.length ?? 0) - 3} more</span>}</div> : <div className="calendar-day calendar-day--blank" key={`blank-${index}`} />)}</div></div>
    </section>
    {selectedEvent && <article className="surface event-detail-card"><div className="event-detail-top"><span className="badge">{selectedEvent.category.replaceAll("_", " ")}</span><Link className="muted-small" href={`/calendar?year=${year}&month=${month}`}>Close</Link></div><h2>{selectedEvent.title}</h2>{selectedEvent.description && <p>{selectedEvent.description}</p>}<div className="event-detail-meta"><span>{formatInCollegeTime(selectedEvent.starts_at, { dateStyle: "medium", hour: "numeric", minute: "2-digit" }, timeZone)} – {formatInCollegeTime(selectedEvent.ends_at, { dateStyle: "short", hour: "numeric", minute: "2-digit" }, timeZone)}</span>{selectedEvent.location && <span><MapPin size={13} /> {selectedEvent.location}</span>}</div></article>}
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Events this month</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Only published events targeted to your profile are shown.</p></div><span className="badge">{events.length} items</span></div>{!events.length ? <EmptyState icon={CalendarDays} title="No events this month" description="Events posted for your academic group will appear here." /> : <div className="upcoming-events">{events.map((event) => <Link href={`/calendar?year=${year}&month=${month}&event=${event.id}`} className="upcoming-event-row" key={event.id}><span className="event-date-block"><strong>{formatInCollegeTime(event.starts_at, { day: "numeric" }, timeZone)}</strong><span>{formatInCollegeTime(event.starts_at, { month: "short" }, timeZone)}</span></span><span className="event-copy"><strong>{event.title}</strong><span>{event.category.replaceAll("_", " ")} · {formatInCollegeTime(event.starts_at, { hour: "numeric", minute: "2-digit" }, timeZone)}</span>{event.location && <span><MapPin size={12} /> {event.location}</span>}</span><ChevronRight size={16} /></Link>)}</div>}</section>
  </>;
}
