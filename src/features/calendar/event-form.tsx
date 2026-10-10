import { saveAcademicEvent } from "@/features/calendar/actions";
import { isoToLocalDateTimeInput } from "@/lib/timezone";

type Option = { id: string; label: string };
type AcademicEvent = { id: string; title: string; description: string | null; category: string; starts_at: string; ends_at: string; location: string | null; status: string; targets?: { target_type: string; target_id: string | null }[] };
const types = [["internal_exam", "Internal examination"], ["semester_exam", "Semester examination"], ["assignment", "Assignment deadline"], ["project_review", "Project review"], ["laboratory", "Laboratory session"], ["seminar", "Seminar / workshop"], ["holiday", "College holiday"], ["department_event", "Department event"], ["other", "Other"]] as const;

export function EventForm({ event, departments, semesters, sections, timeZone }: { event?: AcademicEvent; departments: Option[]; semesters: Option[]; sections: Option[]; timeZone: string }) {
  return <form action={saveAcademicEvent} className="form-stack event-form">{event && <input type="hidden" name="id" value={event.id} />}
    <label className="field"><span className="field-label">Event title</span><input className="input" name="title" defaultValue={event?.title} minLength={3} maxLength={180} required /></label>
    <label className="field"><span className="field-label">Details</span><textarea className="textarea" name="description" defaultValue={event?.description ?? ""} maxLength={10000} rows={3} /></label>
    <div className="record-form-grid"><label className="field"><span className="field-label">Category</span><select className="select" name="category" defaultValue={event?.category ?? "internal_exam"}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field"><span className="field-label">Location (optional)</span><input className="input" name="location" defaultValue={event?.location ?? ""} maxLength={160} /></label>
      <label className="field"><span className="field-label">Starts ({timeZone})</span><input className="input" name="starts_at" type="datetime-local" defaultValue={event ? isoToLocalDateTimeInput(event.starts_at, timeZone) : ""} required /></label>
      <label className="field"><span className="field-label">Ends ({timeZone})</span><input className="input" name="ends_at" type="datetime-local" defaultValue={event ? isoToLocalDateTimeInput(event.ends_at, timeZone) : ""} required /></label>
      <label className="field"><span className="field-label">Publication state</span><select className="select" name="status" defaultValue={event?.status ?? "draft"}><option value="draft">Draft</option><option value="published">Publish now</option><option value="archived">Archive</option></select></label>
    </div>
    <fieldset className="audience-fieldset"><legend>Audience</legend><label className="choice-line"><input type="checkbox" name="college_wide" defaultChecked={event?.targets?.some((target) => target.target_type === "college")} /><span>Entire college</span></label><div className="audience-grid">{[["Departments", "department_ids", "department", departments], ["Semesters", "semester_ids", "semester", semesters], ["Sections", "section_ids", "section", sections]].map(([label, name, kind, options]) => <div key={String(name)}><strong>{String(label)}</strong><div className="audience-options">{(options as Option[]).map((option) => <label className="choice-line" key={option.id}><input type="checkbox" name={String(name)} value={option.id} defaultChecked={event?.targets?.some((target) => target.target_type === kind && target.target_id === option.id)} /><span>{option.label}</span></label>)}{!(options as Option[]).length && <span className="muted-small">No active records yet.</span>}</div></div>)}</div><p className="muted-small">Students see published events only when they match at least one selected group.</p></fieldset>
    <button type="submit" className="button button--primary">{event ? "Save event" : "Create event"}</button>
  </form>;
}
