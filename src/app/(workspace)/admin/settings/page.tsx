import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { updateCollegeSettings } from "@/features/admin/settings-actions";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE } from "@/lib/timezone";

export const metadata: Metadata = { title: "College settings" };
type Search = Promise<{ error?: string; success?: string }>;
const suggestedZones = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Kathmandu", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Australia/Sydney", "UTC"];

export default async function AdminSettingsPage({ searchParams }: { searchParams: Search }) {
  await requireAuthenticatedProfile(["administrator"]);
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const [settings, policy] = await Promise.all([
    supabase.from("attendance_settings").select("college_name,time_zone").eq("id", true).maybeSingle(),
    supabase.from("attendance_policies").select("minimum_percent,target_percent,excused_counts_as_conducted,excused_counts_as_attended").eq("is_active", true).maybeSingle(),
  ]);
  const error = params.error ?? settings.error?.message ?? policy.error?.message;
  return <>
    <PageHeading title="College settings" description="Set the college's local clock and transparent attendance rules used across student views and reports." />
    <StatusMessage error={error} success={params.success} />
    {(!settings.data || !policy.data) && !error && <div className="notice notice--warning">The settings tables are empty. Apply the versioned Supabase migrations before saving these values.</div>}
    <form action={updateCollegeSettings} className="surface panel form-stack admin-settings-form"><div className="panel-heading"><div><h2>Academic defaults</h2><p className="muted-small" style={{ margin: "4px 0 0" }}>Changes are validated together and recorded in the administrator audit log.</p></div><Settings2 size={18} /></div>
      <label className="field"><span className="field-label">College name</span><input className="input" name="college_name" defaultValue={settings.data?.college_name ?? process.env.NEXT_PUBLIC_COLLEGE_NAME ?? "College Companion"} minLength={2} maxLength={100} required /></label>
      <label className="field"><span className="field-label">IANA timezone</span><input className="input" name="time_zone" list="college-timezones" defaultValue={settings.data?.time_zone ?? process.env.NEXT_PUBLIC_COLLEGE_TIME_ZONE ?? DEFAULT_TIME_ZONE} maxLength={64} required /><datalist id="college-timezones">{suggestedZones.map((zone) => <option key={zone} value={zone} />)}</datalist><span className="field-hint">For example, Asia/Kolkata or America/New_York. Timetable and event times are entered and displayed in this zone.</span></label>
      <div className="record-form-grid"><label className="field"><span className="field-label">Minimum attendance threshold (%)</span><input className="input" name="minimum_percent" type="number" min="0" max="100" step="0.01" defaultValue={policy.data?.minimum_percent ?? 75} required /></label><label className="field"><span className="field-label">Attendance target (%)</span><input className="input" name="target_percent" type="number" min="0" max="100" step="0.01" defaultValue={policy.data?.target_percent ?? 75} required /></label></div>
      <fieldset className="audience-fieldset"><legend>Excused-session counting</legend><label className="choice-line"><input type="checkbox" name="excused_counts_as_conducted" defaultChecked={policy.data?.excused_counts_as_conducted ?? false} /><span>Count excused sessions in the conducted-session denominator</span></label><label className="choice-line"><input type="checkbox" name="excused_counts_as_attended" defaultChecked={policy.data?.excused_counts_as_attended ?? false} /><span>Count excused sessions in attended-session numerator</span></label><p className="muted-small">The same policy is used in student summaries and target estimates. Administrators can still make an audited correction to an individual record.</p></fieldset>
      <button type="submit" className="button button--primary">Save college settings</button>
    </form>
  </>;
}
