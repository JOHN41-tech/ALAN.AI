import { saveAnnouncement } from "@/features/announcements/actions";
import { isoToLocalDateTimeInput } from "@/lib/timezone";

type Option = { id: string; label: string };
type Target = { target_type: string; target_id: string | null };
type Announcement = { id: string; title: string; summary: string | null; body: string; category: string; priority: string; status: string; expires_at: string | null; targets?: Target[] };

export function AnnouncementForm({ announcement, departments, semesters, sections, timeZone }: { announcement?: Announcement; departments: Option[]; semesters: Option[]; sections: Option[]; timeZone: string }) {
  const groups: [string, string, string, Option[]][] = [["Departments", "department_ids", "department", departments], ["Semesters", "semester_ids", "semester", semesters], ["Sections", "section_ids", "section", sections]];
  return <form action={saveAnnouncement} className="form-stack announcement-form">
    {announcement && <input type="hidden" name="id" value={announcement.id} />}
    <label className="field"><span className="field-label">Title</span><input className="input" name="title" defaultValue={announcement?.title} maxLength={180} minLength={3} required /></label>
    <label className="field"><span className="field-label">Short summary</span><input className="input" name="summary" defaultValue={announcement?.summary ?? ""} maxLength={360} /></label>
    <label className="field"><span className="field-label">Full announcement</span><textarea className="textarea" name="body" defaultValue={announcement?.body} maxLength={20000} required rows={7} /></label>
    <div className="record-form-grid">
      <label className="field"><span className="field-label">Category</span><input className="input" name="category" defaultValue={announcement?.category ?? "general"} maxLength={48} required /></label>
      <label className="field"><span className="field-label">Priority</span><select className="select" name="priority" defaultValue={announcement?.priority ?? "normal"}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
      <label className="field"><span className="field-label">Publication state</span><select className="select" name="status" defaultValue={announcement?.status ?? "draft"}><option value="draft">Draft</option><option value="published">Publish now</option><option value="archived">Archive</option></select></label>
      <label className="field"><span className="field-label">Expires at (optional, {timeZone})</span><input className="input" type="datetime-local" name="expires_at" defaultValue={announcement?.expires_at ? isoToLocalDateTimeInput(announcement.expires_at, timeZone) : ""} /></label>
    </div>
    <fieldset className="audience-fieldset"><legend>Audience</legend><label className="choice-line"><input type="checkbox" name="college_wide" defaultChecked={announcement?.targets?.some((target) => target.target_type === "college")} /><span>Entire college</span></label><div className="audience-grid">
      {groups.map(([label, name, targetType, options]) => <div key={name}><strong>{label}</strong><div className="audience-options">{options.map((option) => <label className="choice-line" key={option.id}><input type="checkbox" name={name} value={option.id} defaultChecked={announcement?.targets?.some((target) => target.target_type === targetType && target.target_id === option.id)} /><span>{option.label}</span></label>)}{options.length === 0 && <span className="muted-small">No active records yet.</span>}</div></div>)}
    </div><p className="muted-small">Select the whole college or one or more targeted groups. Students see only notices for groups in their active profile.</p></fieldset>
    <button className="button button--primary" type="submit">{announcement ? "Save announcement" : "Create announcement"}</button>
  </form>;
}
