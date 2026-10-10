import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Check, Megaphone } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Announcements" };
type Search = Promise<{ q?: string; priority?: string; category?: string; success?: string; error?: string }>;
const safeSearch = (value: string) => value.replace(/[%,()\\]/g, " ").trim().slice(0, 100);

export default async function AnnouncementsPage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile();
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  let query = supabase.from("announcements").select("id,title,summary,category,priority,published_at,expires_at").order("priority", { ascending: false }).order("published_at", { ascending: false });
  if (current.profile.role !== "administrator") query = query.eq("status", "published");
  if (params.priority && ["normal", "important", "urgent"].includes(params.priority)) query = query.eq("priority", params.priority);
  if (params.category) query = query.eq("category", safeSearch(params.category));
  if (params.q) query = query.ilike("title", `%${safeSearch(params.q)}%`);
  const { data: notices, error } = await query.limit(100);
  const ids = (notices ?? []).map((notice) => notice.id);
  const reads = ids.length ? await supabase.from("announcement_reads").select("announcement_id").eq("user_id", current.userId).in("announcement_id", ids) : { data: [], error: null };
  const readSet = new Set((reads.data ?? []).map((row) => row.announcement_id));
  const categories = [...new Set((notices ?? []).map((item) => item.category))].sort();
  return <>
    <PageHeading title="Announcements" description="Official notices for your college, department, semester and section." action={current.profile.role === "administrator" ? <Link className="button button--primary" href="/admin/announcements"><Megaphone size={15} /> Manage notices</Link> : undefined} />
    <StatusMessage error={params.error ?? error?.message ?? reads.error?.message} success={params.success} />
    <form className="filter-bar surface" action="/announcements"><label className="field filter-search"><span className="field-label">Search title</span><input className="input" name="q" defaultValue={params.q} placeholder="Search announcements" /></label><label className="field"><span className="field-label">Priority</span><select className="select" name="priority" defaultValue={params.priority ?? ""}><option value="">All priorities</option><option value="urgent">Urgent</option><option value="important">Important</option><option value="normal">Normal</option></select></label><label className="field"><span className="field-label">Category</span><select className="select" name="category" defaultValue={params.category ?? ""}><option value="">All categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label><button className="button button--secondary" type="submit">Filter</button></form>
    {!notices?.length ? <EmptyState icon={Megaphone} title="No announcements match yet" description={params.q || params.category || params.priority ? "Try a different search or filter." : "When your college posts an official notice for your group, it will appear here."} /> : <div className="notice-list">{notices.map((notice) => <article className="surface notice-card" key={notice.id}>
      <div className="notice-topline"><span className={`badge ${notice.priority === "urgent" ? "badge--red" : notice.priority === "important" ? "badge--amber" : "badge--blue"}`}>{notice.priority === "urgent" ? <AlertTriangle size={12} /> : null}{notice.priority}</span><span className="badge">{notice.category}</span><span className="muted-small">{notice.published_at ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(notice.published_at)) : "Draft"}</span>{readSet.has(notice.id) ? <span className="read-indicator"><Check size={13} /> Read</span> : <span className="unread-dot" aria-label="Unread" />}</div>
      <Link className="notice-link" href={`/announcements/${notice.id}`}><h2>{notice.title}</h2><p>{notice.summary || "Open to read the full announcement."}</p><span>Read full notice <ArrowUpRight size={14} /></span></Link>
    </article>)}</div>}
  </>;
}
