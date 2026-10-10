import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GraduationCap, KeyRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { RoleLabel } from "@/components/app-shell";
import { updateProfileDetails } from "@/features/admin/actions";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My profile" };
type Search = Promise<{ error?: string; success?: string }>;

export default async function ProfilePage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile();
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const profile = current.profile;
  const [department, program, year, semester, section] = await Promise.all([
    profile.department_id ? supabase.from("departments").select("id,code,name").eq("id", profile.department_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    profile.program_id ? supabase.from("programs").select("id,code,name,degree_level").eq("id", profile.program_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    profile.academic_year_id ? supabase.from("academic_years").select("id,name,starts_on,ends_on").eq("id", profile.academic_year_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    profile.semester_id ? supabase.from("semesters").select("id,name,number,starts_on,ends_on").eq("id", profile.semester_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    profile.section_id ? supabase.from("sections").select("id,name").eq("id", profile.section_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const lookupError = [department.error, program.error, year.error, semester.error, section.error].find(Boolean)?.message;
  return <>
    <PageHeading title="My profile" description="Your account identity and official academic placement." />
    <StatusMessage error={params.error ?? lookupError} success={params.success} />
    <div className="profile-grid"><section className="surface panel"><div className="panel-heading"><div><h2>Account details</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Official email and role changes are controlled by college administrators.</p></div><RoleLabel role={profile.role} /></div>
      <form action={updateProfileDetails} className="form-stack"><label className="field"><span className="field-label">Full name</span><input className="input" name="full_name" defaultValue={profile.full_name} minLength={2} maxLength={120} required /></label><label className="field"><span className="field-label">Preferred name (optional)</span><input className="input" name="preferred_name" defaultValue={profile.preferred_name ?? ""} maxLength={80} /></label><div className="profile-readonly"><span>College email</span><strong>{profile.college_email ?? current.email ?? "Not set"}</strong></div><div className="profile-readonly"><span>Account status</span><strong>{profile.account_status}</strong></div><button type="submit" className="button button--primary">Save profile</button></form><Link className="back-link" href="/forgot-password"><KeyRound size={14} /> Reset password</Link>
    </section><section className="surface panel"><div className="panel-heading"><div><h2>Academic placement</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Set and verified by an administrator.</p></div><GraduationCap size={18} /></div><div className="placement-list"><div><span>Department</span><strong>{department.data ? `${department.data.code} · ${department.data.name}` : "Not assigned"}</strong></div><div><span>Program</span><strong>{program.data ? `${program.data.name} · ${program.data.degree_level}` : "Not assigned"}</strong></div><div><span>Academic year</span><strong>{year.data?.name ?? "Not assigned"}</strong></div><div><span>Semester</span><strong>{semester.data ? `${semester.data.name} · ${semester.data.number}` : "Not assigned"}</strong></div><div><span>Section</span><strong>{section.data?.name ?? "Not assigned"}</strong></div><div><span>Student identifier</span><strong>{profile.student_identifier ?? "Not assigned"}</strong></div></div>{profile.role === "student" && !profile.section_id && <div className="notice notice--info" style={{ marginTop: 16 }}>Your timetable and subject attendance will appear after an administrator assigns your academic section.</div>}</section></div>
  </>;
}
