import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, BriefcaseBusiness, Compass, MessageCircle, Map, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Career and learning hub" };

export default async function CareerHubPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="Career and learning" /><StatusMessage error="Configure Supabase to continue." /></>;
  const [opportunities, applications, roads, attempts] = await Promise.all([
    supabase.from("phase2_opportunities").select("id", { count: "exact", head: true }).eq("published", true).eq("verification_status", "verified"),
    supabase.from("phase2_applications").select("id", { count: "exact", head: true }).eq("user_id", current.userId),
    supabase.from("phase2_roadmaps").select("id,title,domain,created_at").eq("user_id", current.userId).order("created_at", { ascending: false }).limit(3),
    supabase.from("phase2_assessment_attempts").select("id", { count: "exact", head: true }).eq("user_id", current.userId),
  ]);
  const setupError = [opportunities.error, applications.error, roads.error, attempts.error].find(Boolean)?.message;
  const links = [
    { href: "/career/opportunities", title: "Explore opportunities", text: "Search verified listings and keep your applications organized.", icon: BriefcaseBusiness, label: `${opportunities.count ?? 0} published listings` },
    { href: "/career/discovery", title: "Discover your direction", text: "Reflect on interests and skills with transparent path suggestions.", icon: Compass, label: "Your profile, your pace" },
    { href: "/career/roadmaps", title: "Build a learning roadmap", text: "Turn a goal into milestones you can track over time.", icon: Map, label: `${roads.data?.length ?? 0} saved roadmaps` },
    { href: "/career/resources", title: "Browse learning resources", text: "Find curated starting points and save useful references.", icon: BookOpen, label: "Curated library" },
    { href: "/career/assessments", title: "Check your knowledge", text: "Try objective practice questions and review your saved results.", icon: Sparkles, label: `${attempts.count ?? 0} saved attempts` },
    { href: "/career/companion", title: "Ask ALAN.AI", text: "Get help thinking through study topics and career next steps.", icon: MessageCircle, label: "Private conversations" },
  ];
  return <>
    <PageHeading title={`Your next chapter, ${current.profile.preferred_name || current.profile.full_name.split(" ")[0]}`} description="Academic planning and career growth in one student workspace. Suggestions are starting points, not promises." />
    <StatusMessage error={params.error || setupError} success={params.success} />
    {setupError && <p className="notice notice--warning">Phase 2 needs its Supabase migration before your saved career data can load. Your academic workspace remains available.</p>}
    <section className="career-hub-grid" aria-label="Career and learning features">
      {links.map(({ href, title, text, icon: Icon, label }) => <Link className="surface career-hub-card" href={href} key={href}><span className="career-hub-icon"><Icon size={21} /></span><span className="eyebrow">{label}</span><h2>{title}</h2><p>{text}</p><span className="text-link">Open feature <ArrowRight size={15} /></span></Link>)}
    </section>
    <section className="surface career-section"><div className="section-heading"><div><div className="eyebrow">YOUR WORK IN PROGRESS</div><h2>Learning roadmaps</h2></div><Link className="button button--secondary" href="/career/roadmaps">View all <ArrowRight size={15} /></Link></div>
      {roads.data?.length ? <div className="career-list">{roads.data.map((road) => <Link key={road.id} href={`/career/roadmaps/${road.id}`} className="career-list-row"><div><strong>{road.title}</strong><small>{road.domain}</small></div><ArrowRight size={16} /></Link>)}</div> : <p className="muted">No roadmap yet. Choose a goal and create one when you are ready.</p>}
    </section>
  </>;
}
