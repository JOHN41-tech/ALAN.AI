import type { Metadata } from "next";
import { ExternalLink, BriefcaseBusiness } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveOpportunity } from "@/features/career/opportunity-actions";
import type { Opportunity } from "@/features/career/types";

export const metadata: Metadata = { title: "Career opportunity administration" };
type Search = Promise<{ error?: string; success?: string }>;

function OpportunityForm({ item }: { item?: Opportunity }) {
  return <form action={saveOpportunity} className="career-admin-form surface"><input type="hidden" name="id" value={item?.id ?? ""} /><h2>{item ? `Edit ${item.title}` : "Add a sourced opportunity"}</h2><p className="muted">Publish only after checking the employer&apos;s current original source. A source URL is required; example.com seed entries are not verified.</p><div className="career-admin-grid">
    <label className="field"><span className="field-label">Role title</span><input className="input" name="title" minLength={3} maxLength={180} defaultValue={item?.title} required /></label>
    <label className="field"><span className="field-label">Organization</span><input className="input" name="company" maxLength={160} defaultValue={item?.company} required /></label>
    <label className="field"><span className="field-label">Opportunity type</span><select className="input" name="kind" defaultValue={item?.kind ?? "Internship"}><option>Internship</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Apprenticeship</option><option>Scholarship</option></select></label>
    <label className="field"><span className="field-label">Work mode</span><select className="input" name="work_mode" defaultValue={item?.work_mode ?? ""}><option value="">Not specified</option><option>Remote</option><option>Hybrid</option><option>Onsite</option></select></label>
    <label className="field"><span className="field-label">Field/domain</span><input className="input" name="domain" maxLength={100} defaultValue={item?.domain ?? ""} /></label>
    <label className="field"><span className="field-label">Location</span><input className="input" name="location" maxLength={180} defaultValue={item?.location ?? ""} /></label>
    <label className="field"><span className="field-label">Deadline</span><input className="input" name="deadline" type="date" defaultValue={item?.deadline ?? ""} /></label>
    <label className="field"><span className="field-label">Skills (comma-separated)</span><input className="input" name="skills" maxLength={1000} defaultValue={item?.skills.join(", ")} /></label>
    <label className="field career-field-wide"><span className="field-label">Description</span><textarea className="input" name="description" rows={4} maxLength={6000} minLength={10} defaultValue={item?.description} required /></label>
    <label className="field career-field-wide"><span className="field-label">Original HTTPS source URL</span><input className="input" name="source_url" type="url" pattern="https://.*" defaultValue={item?.source_url ?? ""} required placeholder="https://employer.example/careers/role" /></label>
    <label className="field"><span className="field-label">Verification status</span><select className="input" name="verification_status" defaultValue={item?.verification_status ?? "unverified"}><option value="unverified">Unverified</option><option value="verified">Verified by administrator</option><option value="rejected">Rejected</option></select></label>
    <label className="career-checkbox-field"><input type="checkbox" name="published" defaultChecked={item?.published ?? false} /> <span>Publish to student listings (requires verified source)</span></label>
  </div><button className="button button--primary">{item ? "Save listing" : "Create listing"}</button></form>;
}

export default async function AdminCareerPage({ searchParams }: { searchParams: Search }) {
  await requireAuthenticatedProfile(["administrator"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="Career opportunities" /><StatusMessage error="Configure Supabase to continue." /></>;
  const { data, error } = await supabase.from("phase2_opportunities").select("id,title,company,kind,domain,location,work_mode,skills,description,deadline,source_url,verification_status,published").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as Array<Opportunity & { published: boolean }>;
  return <>
    <PageHeading title="Career opportunities" description="Manage sourced listings. Student-facing results require publication and verification; never use fabricated listings as live roles." />
    <StatusMessage error={params.error || error?.message} success={params.success} />
    <OpportunityForm />
    <section className="career-admin-list">{rows.length ? rows.map((row) => <article className="surface career-admin-row" key={row.id}><div className="career-opportunity-head"><BriefcaseBusiness size={19} /><div className="grow"><h2>{row.title}</h2><p>{row.company} · {row.kind}{row.domain ? ` · ${row.domain}` : ""}</p><div className="career-tag-row"><span className={`badge ${row.published ? "badge--green" : "badge--red"}`}>{row.published ? "Published" : "Unpublished"}</span><span className="badge">{row.verification_status}</span></div></div>{row.source_url && <a className="icon-button" href={row.source_url} target="_blank" rel="noreferrer" aria-label="Open original source"><ExternalLink size={16} /></a>}</div><details className="career-admin-edit"><summary>Edit listing and verification</summary><OpportunityForm item={row} /></details></article>) : <div className="surface career-section"><p className="muted">No listings yet. Add a source-backed role after verifying its details with the original publisher.</p></div>}</section>
  </>;
}
