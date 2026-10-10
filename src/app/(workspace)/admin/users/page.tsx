import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { updateCollegeAccount, inviteCollegeAccount } from "@/features/admin/actions";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People and access" };
type Search = Promise<{ error?: string; success?: string }>;

const optionList = (rows: { id: string; name?: string; code?: string; title?: string }[] | null, key: "name" | "code" | "title") => (rows ?? []).map((row) => ({ id: row.id, label: row.code ? `${row.code} · ${row[key] ?? row.name ?? row.title ?? ""}` : row[key] ?? "Academic record" }));

export default async function PeopleAccessPage({ searchParams }: { searchParams: Search }) {
  await requireAuthenticatedProfile(["administrator"]);
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const [profiles, departments, programs, years, semesters, sections] = await Promise.all([
    supabase.from("profiles").select("id,role,full_name,preferred_name,college_email,account_status,department_id,program_id,academic_year_id,semester_id,section_id,student_identifier,created_at").order("full_name"),
    supabase.from("departments").select("id,name,code").eq("is_active", true).order("name"),
    supabase.from("programs").select("id,name,code,department_id").eq("is_active", true).order("name"),
    supabase.from("academic_years").select("id,name").order("starts_on", { ascending: false }),
    supabase.from("semesters").select("id,name,number,program_id,academic_year_id").order("starts_on", { ascending: false }),
    supabase.from("sections").select("id,name,program_id,semester_id").eq("is_active", true).order("name"),
  ]);
  const queryError = [profiles.error, departments.error, programs.error, years.error, semesters.error, sections.error].find(Boolean)?.message;
  const departmentMap = new Map((departments.data ?? []).map((row) => [row.id, `${row.code} · ${row.name}`]));
  const programMap = new Map((programs.data ?? []).map((row) => [row.id, `${row.code} · ${row.name}`]));
  const semesterMap = new Map((semesters.data ?? []).map((row) => [row.id, row.name]));
  const sectionMap = new Map((sections.data ?? []).map((row) => [row.id, row.name]));
  const departmentOptions = optionList(departments.data, "name");
  const programOptions = (programs.data ?? []).map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` }));
  const yearOptions = (years.data ?? []).map((row) => ({ id: row.id, label: row.name }));
  const semesterOptions = (semesters.data ?? []).map((row) => ({ id: row.id, label: row.name }));
  const sectionOptions = (sections.data ?? []).map((row) => ({ id: row.id, label: `${row.name} · ${semesterMap.get(row.semester_id) ?? "Semester"}` }));
  const hasServerKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return <>
    <PageHeading title="People and access" description="Invite trusted staff, manage account status, and place student accounts into academic groups." />
    <StatusMessage error={params.error ?? queryError} success={params.success} />
    <section className="surface panel">
      <div className="panel-heading"><div><h2>Invite faculty or an administrator</h2><p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 0" }}>Student accounts use public student registration. New staff accounts receive an email invitation; elevated access is assigned only by this administrator action.</p></div></div>
      {!hasServerKey && <div className="notice notice--warning">Server-only Supabase service configuration is required before staff invitations can be sent.</div>}
      <form action={inviteCollegeAccount} className="account-form-grid" style={{ marginTop: 14 }}>
        <label className="field"><span className="field-label">Full name</span><input className="input" type="text" name="full_name" minLength={2} maxLength={120} required /></label>
        <label className="field"><span className="field-label">College email</span><input className="input" type="email" name="email" maxLength={254} required /></label>
        <label className="field"><span className="field-label">Role</span><select className="select" name="role" required><option value="faculty">Faculty</option><option value="administrator">Administrator</option></select></label>
        <button className="button button--primary" type="submit" disabled={!hasServerKey}>Send invitation</button>
      </form>
    </section>
    <section className="surface panel" style={{ marginTop: 16 }}>
      <div className="panel-heading"><div><h2>College accounts</h2><p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 0" }}>Role and placement changes are validated and audit logged. Active enrollments are synchronized from the selected program/semester offerings.</p></div><span className="badge">{profiles.data?.length ?? 0} profiles</span></div>
      {!profiles.data?.length ? <div className="empty-state"><strong>No profile records found.</strong><span>Registered users appear here when their Supabase profile is created.</span></div> : <div className="table-wrap" style={{ marginTop: 14 }}><table className="data-table account-table"><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Academic placement</th><th>Manage</th></tr></thead><tbody>{profiles.data.map((person) => <tr key={person.id}>
        <td><strong>{person.preferred_name || person.full_name}</strong><br /><span style={{ color: "var(--muted)", fontSize: 11 }}>{person.college_email || "Email unavailable"}</span>{person.student_identifier && <><br /><span style={{ color: "var(--muted)", fontSize: 11 }}>ID · {person.student_identifier}</span></>}</td>
        <td><span className="badge">{person.role}</span></td><td><span className={`badge ${person.account_status === "active" ? "badge--green" : "badge--amber"}`}>{person.account_status}</span></td>
        <td style={{ fontSize: 12, lineHeight: 1.7 }}>{person.department_id ? departmentMap.get(person.department_id) : "—"}<br />{person.program_id ? programMap.get(person.program_id) : "No program"} · {person.semester_id ? semesterMap.get(person.semester_id) : "No semester"} · {person.section_id ? sectionMap.get(person.section_id) : "No section"}</td>
        <td><details><summary style={{ cursor: "pointer", color: "var(--cobalt)", fontWeight: 650, fontSize: 12 }}>Edit access</summary><form action={updateCollegeAccount} className="form-stack" style={{ minWidth: 280, padding: "10px 0", gap: 9 }}>
          <input type="hidden" name="id" value={person.id} />
          <label className="field"><span className="field-label">Role</span><select className="select" name="role" defaultValue={person.role}><option value="student">Student</option><option value="faculty">Faculty</option><option value="administrator">Administrator</option></select></label>
          <label className="field"><span className="field-label">Account status</span><select className="select" name="account_status" defaultValue={person.account_status}><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option></select></label>
          <label className="field"><span className="field-label">Student identifier</span><input className="input" name="student_identifier" maxLength={48} defaultValue={person.student_identifier ?? ""} /></label>
          <label className="field"><span className="field-label">Department</span><select className="select" name="department_id" defaultValue={person.department_id ?? ""}><option value="">Not set</option>{departmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="field"><span className="field-label">Program</span><select className="select" name="program_id" defaultValue={person.program_id ?? ""}><option value="">Not set</option>{programOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="field"><span className="field-label">Academic year</span><select className="select" name="academic_year_id" defaultValue={person.academic_year_id ?? ""}><option value="">Not set</option>{yearOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="field"><span className="field-label">Semester</span><select className="select" name="semester_id" defaultValue={person.semester_id ?? ""}><option value="">Not set</option>{semesterOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="field"><span className="field-label">Section</span><select className="select" name="section_id" defaultValue={person.section_id ?? ""}><option value="">Not set</option>{sectionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <button className="button button--primary" type="submit" disabled={!hasServerKey}>Save access and placement</button>
        </form></details></td>
      </tr>)}</tbody></table></div>}
    </section>
  </>;
}
