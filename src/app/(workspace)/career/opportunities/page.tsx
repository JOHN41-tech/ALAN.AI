import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, Search, Bookmark, BriefcaseBusiness } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { EmptyState } from "@/components/empty-state";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createApplication, toggleOpportunitySave, updateApplication } from "@/features/career/opportunity-actions";
import type { Opportunity } from "@/features/career/types";

export const metadata: Metadata = { title: "Opportunities" };
type Params = Promise<{ q?: string; kind?: string; mode?: string; tab?: string; error?: string; success?: string }>;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Params }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="Opportunities" /><StatusMessage error="Configure Supabase to continue." /></>;
  const tab = params.tab === "applications" ? "applications" : params.tab === "saved" ? "saved" : "discover";
  const q = (params.q ?? "").trim().slice(0, 80).replace(/[^a-zA-Z0-9\s.-]/g, "");
  let jobs: Opportunity[] = [];
  let savedIds = new Set<string>();
  let apps: Array<{ id: string; opportunity_id: string; status: string; notes: string; updated_at: string }> = [];
  let queryError: string | undefined;
  const [saved, applicationRows] = await Promise.all([
    supabase.from("phase2_saved_opportunities").select("opportunity_id").eq("user_id", current.userId),
    supabase.from("phase2_applications").select("id,opportunity_id,status,notes,updated_at").eq("user_id", current.userId).order("updated_at", { ascending: false }),
  ]);
  savedIds = new Set((saved.data ?? []).map((row) => row.opportunity_id));
  apps = applicationRows.data ?? [];
  queryError = saved.error?.message ?? applicationRows.error?.message;
  let jobQuery = supabase.from("phase2_opportunities").select("id,title,company,kind,domain,location,work_mode,skills,description,deadline,source_url,verification_status").eq("published", true).eq("verification_status", "verified").order("deadline", { ascending: true, nullsFirst: false }).limit(50);
  if (tab === "saved" && savedIds.size) jobQuery = jobQuery.in("id", [...savedIds]);
  if (tab === "saved" && !savedIds.size) jobs = [];
  else {
    if (params.kind) jobQuery = jobQuery.eq("kind", params.kind);
    if (params.mode) jobQuery = jobQuery.eq("work_mode", params.mode);
    if (q) jobQuery = jobQuery.or(`title.ilike.%${q}%,company.ilike.%${q}%,domain.ilike.%${q}%`);
    const result = await jobQuery;
    jobs = (result.data ?? []) as Opportunity[];
    queryError ??= result.error?.message;
  }
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const missingApplicationIds = apps.map((app) => app.opportunity_id).filter((id) => !jobById.has(id));
  if (tab === "applications" && missingApplicationIds.length) {
    const result = await supabase.from("phase2_opportunities").select("id,title,company,kind,domain,location,work_mode,skills,description,deadline,source_url,verification_status").in("id", missingApplicationIds);
    for (const job of (result.data ?? []) as Opportunity[]) jobById.set(job.id, job);
    queryError ??= result.error?.message;
  }
  return <>
    <PageHeading title="Opportunities" description="Explore published listings that have a source and were marked verified by a college administrator." action={<Link className="button button--ghost" href="/career">Career hub</Link>} />
    <StatusMessage error={params.error || queryError} success={params.success} />
    <nav className="career-tabs" aria-label="Opportunity sections"><Link className={tab === "discover" ? "is-active" : ""} href="/career/opportunities">Discover</Link><Link className={tab === "saved" ? "is-active" : ""} href="/career/opportunities?tab=saved">Saved ({savedIds.size})</Link><Link className={tab === "applications" ? "is-active" : ""} href="/career/opportunities?tab=applications">Applications ({apps.length})</Link></nav>
    {tab !== "applications" ? <>
      <form className="career-filterbar surface" action="/career/opportunities" method="get"><input type="hidden" name="tab" value={tab} /><label className="career-search"><Search size={17} /><span className="sr-only">Search listings</span><input name="q" defaultValue={params.q} maxLength={80} placeholder="Role, company, or field" /></label><label><span className="sr-only">Opportunity type</span><select name="kind" defaultValue={params.kind ?? ""}><option value="">All types</option><option>Internship</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Apprenticeship</option><option>Scholarship</option></select></label><label><span className="sr-only">Work mode</span><select name="mode" defaultValue={params.mode ?? ""}><option value="">All work modes</option><option>Remote</option><option>Hybrid</option><option>Onsite</option></select></label><button className="button button--secondary">Apply filters</button></form>
      {jobs.length ? <div className="career-opportunity-list">{jobs.map((job) => <article className="surface career-opportunity" key={job.id}><div className="career-opportunity-head"><div className="company-mark">{job.company.slice(0, 1)}</div><div className="grow"><span className="badge badge--green">Verified source</span><h2>{job.title}</h2><p>{job.company}{job.domain ? ` · ${job.domain}` : ""}</p></div><form action={toggleOpportunitySave}><input type="hidden" name="opportunity_id" value={job.id} /><input type="hidden" name="saved" value={savedIds.has(job.id) ? "true" : "false"} /><button className="icon-button" aria-label={savedIds.has(job.id) ? "Remove saved opportunity" : "Save opportunity"}><Bookmark size={17} fill={savedIds.has(job.id) ? "currentColor" : "none"} /></button></form></div><p>{job.description}</p><div className="career-tag-row"><span className="badge badge--blue">{job.kind}</span>{job.work_mode && <span className="badge">{job.work_mode}</span>}{job.location && <span className="badge">{job.location}</span>}{job.deadline && <span className="badge">Deadline {job.deadline}</span>}{job.skills.slice(0, 5).map((skill) => <span className="career-skill" key={skill}>{skill}</span>)}</div><div className="career-card-footer"><a className="text-link" href={job.source_url ?? "#"} target="_blank" rel="noreferrer">View source <ExternalLink size={14} /></a>{apps.some((application) => application.opportunity_id === job.id) ? <span className="badge badge--green">In your tracker</span> : <form action={createApplication}><input type="hidden" name="opportunity_id" value={job.id} /><button className="button button--primary">Track application</button></form>}</div></article>)}</div> : <EmptyState icon={BriefcaseBusiness} title={tab === "saved" ? "No saved listings" : "No verified listings yet"} description={tab === "saved" ? "Save a published opportunity to keep it close." : "Only verified, source-backed listings appear here. Check again later or ask your college administrator to publish a verified listing."} />}
    </> : apps.length ? <div className="career-opportunity-list">{apps.map((app) => { const job = jobById.get(app.opportunity_id); return <article className="surface career-application" key={app.id}><div><h2>{job?.title ?? "Listing no longer available"}</h2><p>{job?.company ?? "This opportunity was removed."}</p><small className="muted">Updated {new Date(app.updated_at).toLocaleDateString("en", { dateStyle: "medium" })}</small></div><form action={updateApplication} className="career-application-form"><input type="hidden" name="application_id" value={app.id} /><label><span className="field-label">Status</span><select name="status" defaultValue={app.status}><option>Interested</option><option>Applied</option><option>Assessment</option><option>Interview</option><option>Offer</option><option>Rejected</option><option>Withdrawn</option></select></label><label><span className="field-label">Private notes</span><input name="notes" defaultValue={app.notes} maxLength={1000} /></label><button className="button button--secondary">Save</button></form></article>; })}</div> : <EmptyState icon={BriefcaseBusiness} title="Your tracker is ready" description="Add a verified opportunity to follow its application status here." />}
  </>;
}
