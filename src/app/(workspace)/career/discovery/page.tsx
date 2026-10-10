import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Compass, Info } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveCareerProfile } from "@/features/career/career-actions";
import { recommendCareerPaths } from "@/features/career/rules";
import type { CareerAnswers } from "@/features/career/types";

export const metadata: Metadata = { title: "Career discovery" };
type Search = Promise<{ error?: string; success?: string }>;
const emptyAnswers: CareerAnswers = { interests: [], skills: [], learningStyle: "mixed", availableHours: 5, targetDomain: null };

export default async function CareerDiscoveryPage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="Career discovery" /><StatusMessage error="Configure Supabase to continue." /></>;
  const { data: saved, error: queryError } = await supabase.from("phase2_career_profiles").select("answers,target_domain").eq("user_id", current.userId).maybeSingle();
  const raw = saved?.answers && typeof saved.answers === "object" ? saved.answers as Partial<CareerAnswers> : {};
  const answers: CareerAnswers = {
    interests: Array.isArray(raw.interests) ? raw.interests : [],
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    learningStyle: raw.learningStyle ?? emptyAnswers.learningStyle,
    availableHours: Number(raw.availableHours) || emptyAnswers.availableHours,
    targetDomain: saved?.target_domain ?? raw.targetDomain ?? null,
  };
  const recommendations = recommendCareerPaths(answers);
  return <>
    <PageHeading title="Discover your direction" description="A few reflections can help you decide what to explore next. Change your answers whenever your interests grow." />
    <StatusMessage error={params.error || queryError?.message} success={params.success} />
    <div className="career-discovery-grid"><section className="surface career-section"><div className="eyebrow">YOUR SIGNALS</div><h2>What feels interesting right now?</h2><p className="muted">Use commas between interests and skills. Keep it broad; this is your private starting point.</p>
      <form action={saveCareerProfile} className="career-form">
        <label className="field"><span className="field-label">Interests</span><input className="input" name="interests" maxLength={900} defaultValue={answers.interests.join(", ")} placeholder="e.g. building websites, data, design" /></label>
        <label className="field"><span className="field-label">Skills you already use</span><input className="input" name="skills" maxLength={1600} defaultValue={answers.skills.join(", ")} placeholder="e.g. Python, writing, research" /></label>
        <label className="field"><span className="field-label">Learning style you enjoy</span><select className="input" name="learning_style" defaultValue={answers.learningStyle}><option value="mixed">A mix of approaches</option><option value="project">Building projects</option><option value="reading">Reading and explanation</option><option value="video">Video lessons</option><option value="practice">Short practice exercises</option></select></label>
        <label className="field"><span className="field-label">Time available each week</span><div className="career-inline-input"><input className="input" name="available_hours" type="number" min="1" max="40" defaultValue={answers.availableHours} required /><span>hours</span></div></label>
        <label className="field"><span className="field-label">A field you are curious about (optional)</span><input className="input" name="target_domain" defaultValue={answers.targetDomain ?? ""} maxLength={100} placeholder="e.g. software engineering" /></label>
        <button className="button button--primary">Save my reflections</button>
      </form>
    </section><aside className="surface career-section"><div className="eyebrow">EXPLORATION IDEAS</div><h2>Paths to look into</h2><p className="muted">Transparent keyword overlap from your own saved reflections. This is not an AI score, aptitude test, salary forecast, or prediction.</p><div className="career-recommendations">{recommendations.map((item) => <article className="career-recommendation" key={item.id}><div className="career-recommendation-head"><Compass size={18} /><span className="badge">{item.matchLabel}</span></div><h3>{item.title}</h3><p>{item.intro}</p><Link className="text-link" href={`/career/roadmaps?domain=${encodeURIComponent(item.title)}`}>Create a learning plan <ArrowRight size={14} /></Link></article>)}</div><p className="notice notice--info"><Info size={15} /> A suggestion is only a prompt for exploration. It does not predict admission, employment or earnings.</p></aside></div>
  </>;
}
