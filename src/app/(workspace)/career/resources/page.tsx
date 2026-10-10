import type { Metadata } from "next";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { EmptyState } from "@/components/empty-state";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toggleResourceBookmark } from "@/features/career/learning-actions";
import type { CareerResource } from "@/features/career/types";

export const metadata: Metadata = { title: "Learning resources" };
type SearchParams = Promise<{ q?: string; level?: string; error?: string; success?: string }>;

export default async function ResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="Learning resources" /><StatusMessage error="Configure Supabase to continue." /></>;
  const query = (params.q ?? "").trim().slice(0, 60).replace(/[^a-zA-Z0-9\s.-]/g, "");
  let request = supabase.from("phase2_resources").select("id,title,provider,domain,level,resource_type,url,skills").eq("published", true).order("title").limit(100);
  if (params.level && ["Beginner", "Intermediate", "Advanced"].includes(params.level)) request = request.eq("level", params.level);
  if (query) request = request.or(`title.ilike.%${query}%,provider.ilike.%${query}%,domain.ilike.%${query}%`);
  const [resourceResult, bookmarkResult] = await Promise.all([request, supabase.from("phase2_resource_bookmarks").select("resource_id").eq("user_id", current.userId)]);
  const resources = (resourceResult.data ?? []) as CareerResource[];
  const saved = new Set((bookmarkResult.data ?? []).map((row) => row.resource_id));
  return <>
    <PageHeading title="Learning resources" description="Curated starting points from their original publishers. Check the provider page for the latest content and availability." />
    <StatusMessage error={params.error || resourceResult.error?.message || bookmarkResult.error?.message} success={params.success} />
    <form className="career-filterbar surface" action="/career/resources" method="get"><label className="career-search"><Search size={17} /><span className="sr-only">Search learning resources</span><input name="q" defaultValue={params.q} maxLength={60} placeholder="Title, provider, or topic" /></label><label><span className="sr-only">Difficulty</span><select name="level" defaultValue={params.level ?? ""}><option value="">All difficulty levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><button className="button button--secondary">Search</button></form>
    {resources.length ? <section className="career-resource-grid" aria-label="Curated learning resources">{resources.map((resource) => <article className="surface career-resource-card" key={resource.id}><div className="career-resource-top"><BookOpen size={19} /><span className="badge">{resource.level}</span></div><div className="eyebrow">{resource.domain} · {resource.resource_type}</div><h2>{resource.title}</h2><p>{resource.provider}</p><div className="career-tag-row">{resource.skills.map((skill) => <span className="career-skill" key={skill}>{skill}</span>)}</div><div className="career-card-footer"><a className="text-link" href={resource.url} target="_blank" rel="noreferrer">Visit provider <ExternalLink size={14} /></a><form action={toggleResourceBookmark}><input type="hidden" name="resource_id" value={resource.id} /><input type="hidden" name="saved" value={String(saved.has(resource.id))} /><button className="button button--secondary">{saved.has(resource.id) ? "Saved" : "Save"}</button></form></div></article>)}</section> : <EmptyState icon={BookOpen} title="No resources found" description="Try another search or difficulty level. Curated links will appear after the Phase 2 database seed is applied." />}
  </>;
}
