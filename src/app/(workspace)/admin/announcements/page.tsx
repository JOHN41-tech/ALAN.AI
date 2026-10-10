import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { AnnouncementForm } from "@/features/announcements/announcement-form";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";

export const metadata: Metadata = { title: "Manage announcements" };
type Search = Promise<{ error?: string; success?: string }>;

export default async function ManageAnnouncementsPage({ searchParams }: { searchParams: Search }) {
  await requireAuthenticatedProfile(["administrator"]);
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const settings = await getCollegeSettings(supabase);
  const [notices, departments, semesters, sections, targets] = await Promise.all([
    supabase.from("announcements").select("id,title,summary,body,category,priority,status,expires_at,published_at,updated_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("departments").select("id,name,code").eq("is_active", true).order("name"),
    supabase.from("semesters").select("id,name,number").order("starts_on", { ascending: false }),
    supabase.from("sections").select("id,name").eq("is_active", true).order("name"),
    supabase.from("announcement_targets").select("announcement_id,target_type,target_id"),
  ]);
  const option = (rows: { id: string; name: string; code?: string; number?: number }[] | null) => (rows ?? []).map((row) => ({ id: row.id, label: row.code ? `${row.code} · ${row.name}` : row.number ? `${row.name} · Semester ${row.number}` : row.name }));
  const formOptions = { departments: option(departments.data), semesters: option(semesters.data), sections: option(sections.data), timeZone: settings.timeZone };
  const targetsByNotice = new Map<string, { target_type: string; target_id: string | null }[]>();
  for (const target of targets.data ?? []) targetsByNotice.set(target.announcement_id, [...(targetsByNotice.get(target.announcement_id) ?? []), target]);
  const editableNotices = (notices.data ?? []).map((notice) => ({ ...notice, targets: targetsByNotice.get(notice.id) ?? [] }));
  const fetchError = [notices.error, departments.error, semesters.error, sections.error, targets.error].find(Boolean)?.message;
  return <>
    <PageHeading title="Manage announcements" description="Draft official notices, target the correct student groups, and publish or archive them." />
    <StatusMessage error={params.error ?? fetchError ?? settings.error ?? undefined} success={params.success} />
    <section className="surface panel"><div className="panel-heading"><div><h2>New announcement</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Publish now to create idempotent in-app notifications for the selected active audience.</p></div></div><AnnouncementForm {...formOptions} /></section>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><div><h2>Recent notices</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Updating a published notice moves it through an atomic draft-and-republish transition.</p></div><span className="badge">{notices.data?.length ?? 0} notices</span></div>
      {!editableNotices.length ? <p className="muted-small">No announcements have been created.</p> : <div className="catalog-list">{editableNotices.map((notice) => <article className="catalog-row" key={notice.id}><div className="catalog-summary"><div><strong>{notice.title}</strong><span>{notice.category} · {notice.priority} · Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(notice.updated_at))}</span></div><span className={`badge ${notice.status === "published" ? "badge--green" : notice.status === "archived" ? "badge--amber" : "badge--blue"}`}>{notice.status}</span></div><details><summary className="edit-summary">Edit notice, audience or state</summary><div className="record-create-inner"><AnnouncementForm announcement={notice} {...formOptions} /></div></details></article>)}</div>}
    </section>
  </>;
}
