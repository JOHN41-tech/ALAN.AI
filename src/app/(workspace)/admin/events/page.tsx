import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { EventForm } from "@/features/calendar/event-form";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";

export const metadata: Metadata = { title: "Academic events" };
type Search = Promise<{ error?: string; success?: string }>;

export default async function ManageEventsPage({ searchParams }: { searchParams: Search }) {
  await requireAuthenticatedProfile(["administrator"]);
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const settings = await getCollegeSettings(supabase);
  const [events, departments, semesters, sections, targets] = await Promise.all([
    supabase.from("academic_events").select("id,title,description,category,starts_at,ends_at,time_zone,location,status,published_at,updated_at").order("starts_at", { ascending: false }).limit(100),
    supabase.from("departments").select("id,name,code").eq("is_active", true).order("name"),
    supabase.from("semesters").select("id,name,number").order("starts_on", { ascending: false }),
    supabase.from("sections").select("id,name").eq("is_active", true).order("name"),
    supabase.from("academic_event_targets").select("event_id,target_type,target_id"),
  ]);
  const option = (rows: { id: string; name: string; code?: string; number?: number }[] | null) => (rows ?? []).map((row) => ({ id: row.id, label: row.code ? `${row.code} · ${row.name}` : row.number ? `${row.name} · Semester ${row.number}` : row.name }));
  const formOptions = { departments: option(departments.data), semesters: option(semesters.data), sections: option(sections.data) };
  const targetMap = new Map<string, { target_type: string; target_id: string | null }[]>();
  for (const target of targets.data ?? []) targetMap.set(target.event_id, [...(targetMap.get(target.event_id) ?? []), target]);
  const editableEvents = (events.data ?? []).map((event) => ({ ...event, targets: targetMap.get(event.id) ?? [] }));
  const fetchError = [events.error, departments.error, semesters.error, sections.error, targets.error].find(Boolean)?.message;
  return <>
    <PageHeading title="Academic events" description="Create targeted exams, assignment deadlines, reviews, laboratory sessions, holidays and campus activities." />
    <StatusMessage error={params.error ?? fetchError ?? settings.error ?? undefined} success={params.success} />
    <section className="surface panel"><div className="panel-heading"><div><h2>New event</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Publishing creates an idempotent in-app notification for the selected active audience.</p></div></div><EventForm {...formOptions} timeZone={settings.timeZone} /></section>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><h2>Existing events</h2><span className="badge">{editableEvents.length} events</span></div>{!editableEvents.length ? <p className="muted-small">No events have been created.</p> : <div className="catalog-list">{editableEvents.map((event) => <article className="catalog-row" key={event.id}><div className="catalog-summary"><div><strong>{event.title}</strong><span>{event.category.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: settings.timeZone }).format(new Date(event.starts_at))}</span></div><span className={`badge ${event.status === "published" ? "badge--green" : event.status === "archived" ? "badge--amber" : "badge--blue"}`}>{event.status}</span></div><details><summary className="edit-summary">Edit event, audience or state</summary><div className="record-create-inner"><EventForm event={event} {...formOptions} timeZone={settings.timeZone} /></div></details></article>)}</div>}</section>
  </>;
}
