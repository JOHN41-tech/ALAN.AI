import { generateClassSessions, saveFacultyAssignment, saveRecurringTimetableEntry, toggleFacultyAssignment, toggleRecurringTimetableEntry, updateScheduledSession } from "@/features/timetable/actions";
import { addCalendarDays, dateKeyInZone, isoToLocalDateTimeInput } from "@/lib/timezone";

type Faculty = { id: string; full_name: string; college_email: string | null };
type Course = { id: string; code: string; title: string };
type Semester = { id: string; name: string; number: number };
type Section = { id: string; name: string };
type Room = { id: string; code: string; name: string | null };
type Assignment = { id: string; faculty_id: string; course_id: string; semester_id: string; section_id: string; is_active: boolean };
type Entry = { id: string; course_id: string; semester_id: string; section_id: string; faculty_assignment_id: string; classroom_id: string | null; weekday: number; starts_at_local: string; ends_at_local: string; valid_from: string; valid_until: string | null; is_active: boolean };
type DatedSession = { id: string; starts_at: string; ends_at: string; status: string; cancellation_reason: string | null; classroom_id: string | null; substitute_faculty_id?: string | null };
const weekdays = [[0, "Sunday"], [1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"]] as const;

export function FacultyAssignmentForm({ faculties, courses, semesters, sections }: { faculties: Faculty[]; courses: Course[]; semesters: Semester[]; sections: Section[] }) {
  return <form action={saveFacultyAssignment} className="form-stack"><div className="record-form-grid">
    <label className="field"><span className="field-label">Faculty member</span><select className="select" name="faculty_id" required defaultValue=""><option value="" disabled>Select faculty</option>{faculties.map((person) => <option value={person.id} key={person.id}>{person.full_name} · {person.college_email ?? ""}</option>)}</select></label>
    <label className="field"><span className="field-label">Course</span><select className="select" name="course_id" required defaultValue=""><option value="" disabled>Select course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}</select></label>
    <label className="field"><span className="field-label">Semester</span><select className="select" name="semester_id" required defaultValue=""><option value="" disabled>Select semester</option>{semesters.map((semester) => <option value={semester.id} key={semester.id}>{semester.name} · {semester.number}</option>)}</select></label>
    <label className="field"><span className="field-label">Section</span><select className="select" name="section_id" required defaultValue=""><option value="" disabled>Select section</option>{sections.map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}</select></label>
  </div><p className="muted-small">The course must have an active semester-specific offering and the section must belong to the same program and semester.</p><button className="button button--primary" type="submit">Assign faculty</button></form>;
}

export function AssignmentToggle({ assignment }: { assignment: Assignment }) {
  return <form action={toggleFacultyAssignment}><input type="hidden" name="id" value={assignment.id} /><input type="hidden" name="active" value={String(!assignment.is_active)} /><button className="button button--secondary button--small" type="submit">{assignment.is_active ? "Deactivate" : "Reactivate"}</button></form>;
}

export function RecurringEntryForm({ entry, assignments, courses, semesters, sections, rooms, timeZone }: { entry?: Entry; assignments: Assignment[]; courses: Course[]; semesters: Semester[]; sections: Section[]; rooms: Room[]; timeZone: string }) {
  return <form action={saveRecurringTimetableEntry} className="form-stack">{entry && <input type="hidden" name="id" value={entry.id} />}<div className="record-form-grid">
    <label className="field"><span className="field-label">Course</span><select className="select" name="course_id" required defaultValue={entry?.course_id ?? ""}><option value="" disabled>Select course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}</select></label>
    <label className="field"><span className="field-label">Semester</span><select className="select" name="semester_id" required defaultValue={entry?.semester_id ?? ""}><option value="" disabled>Select semester</option>{semesters.map((semester) => <option value={semester.id} key={semester.id}>{semester.name} · {semester.number}</option>)}</select></label>
    <label className="field"><span className="field-label">Section</span><select className="select" name="section_id" required defaultValue={entry?.section_id ?? ""}><option value="" disabled>Select section</option>{sections.map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}</select></label>
    <label className="field"><span className="field-label">Faculty assignment</span><select className="select" name="faculty_assignment_id" required defaultValue={entry?.faculty_assignment_id ?? ""}><option value="" disabled>Select matching assignment</option>{assignments.filter((assignment) => assignment.is_active).map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.id.slice(0, 8)} · {courses.find((course) => course.id === assignment.course_id)?.code ?? "Course"} · {sections.find((section) => section.id === assignment.section_id)?.name ?? "Section"}</option>)}</select></label>
    <label className="field"><span className="field-label">Classroom (optional)</span><select className="select" name="classroom_id" defaultValue={entry?.classroom_id ?? ""}><option value="">No room assigned</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code}{room.name ? ` · ${room.name}` : ""}</option>)}</select></label>
    <label className="field"><span className="field-label">Weekday</span><select className="select" name="weekday" defaultValue={entry?.weekday ?? 1}>{weekdays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="field"><span className="field-label">Starts (college time)</span><input className="input" name="starts_at_local" type="time" required defaultValue={entry?.starts_at_local.slice(0, 5) ?? "09:00"} /></label>
    <label className="field"><span className="field-label">Ends (college time)</span><input className="input" name="ends_at_local" type="time" required defaultValue={entry?.ends_at_local.slice(0, 5) ?? "10:00"} /></label>
    <label className="field"><span className="field-label">Valid from</span><input className="input" name="valid_from" type="date" required defaultValue={entry?.valid_from ?? dateKeyInZone(new Date(), timeZone)} /></label>
    <label className="field"><span className="field-label">Valid until (optional)</span><input className="input" name="valid_until" type="date" defaultValue={entry?.valid_until ?? ""} /></label>
  </div><p className="muted-small">Room/faculty conflicts are checked against overlapping active recurrences. Dated sessions are generated separately.</p><button className="button button--primary" type="submit">{entry ? "Save recurring entry" : "Create recurring entry"}</button></form>;
}

export function RecurringEntryToggle({ entry }: { entry: Entry }) {
  return <form action={toggleRecurringTimetableEntry}><input type="hidden" name="id" value={entry.id} /><input type="hidden" name="active" value={String(!entry.is_active)} /><button className="button button--secondary button--small" type="submit">{entry.is_active ? "Deactivate" : "Reactivate"}</button></form>;
}

export function GenerateSessionsForm({ timeZone }: { timeZone: string }) {
  const today = dateKeyInZone(new Date(), timeZone);
  return <form action={generateClassSessions} className="generation-form"><label className="field"><span className="field-label">From</span><input className="input" type="date" name="start_on" defaultValue={today} required /></label><label className="field"><span className="field-label">Through</span><input className="input" type="date" name="end_on" defaultValue={addCalendarDays(today, 13)} required /></label><button type="submit" className="button button--primary">Generate dated sessions</button></form>;
}

export function SessionMaintenanceForm({ session, rooms, faculties, timeZone }: { session: DatedSession; rooms: Room[]; faculties: Faculty[]; timeZone: string }) {
  return <details><summary className="edit-summary">Reschedule or cancel session</summary><div className="record-create-inner"><form action={updateScheduledSession} className="form-stack"><input type="hidden" name="session_id" value={session.id} /><div className="record-form-grid">
    <label className="field"><span className="field-label">Action</span><select className="select" name="action" defaultValue="reschedule"><option value="reschedule">Reschedule / update</option><option value="cancel">Cancel class</option></select></label>
    <label className="field"><span className="field-label">Starts</span><input className="input" type="datetime-local" name="starts_at" defaultValue={isoToLocalDateTimeInput(session.starts_at, timeZone)} required /></label>
    <label className="field"><span className="field-label">Ends</span><input className="input" type="datetime-local" name="ends_at" defaultValue={isoToLocalDateTimeInput(session.ends_at, timeZone)} required /></label>
    <label className="field"><span className="field-label">Room</span><select className="select" name="classroom_id" defaultValue={session.classroom_id ?? ""}><option value="">No room</option>{rooms.map((room) => <option value={room.id} key={room.id}>{room.code}{room.name ? ` · ${room.name}` : ""}</option>)}</select></label>
    <label className="field"><span className="field-label">Substitute faculty (optional)</span><select className="select" name="substitute_faculty_id" defaultValue={session.substitute_faculty_id ?? ""}><option value="">Original assigned faculty</option>{faculties.map((faculty) => <option value={faculty.id} key={faculty.id}>{faculty.full_name}</option>)}</select></label>
    <label className="field"><span className="field-label">Change note (8+ characters for reschedule)</span><input className="input" name="change_note" maxLength={1000} /></label>
    <label className="field"><span className="field-label">Cancellation reason (8+ characters when canceling)</span><input className="input" name="cancellation_reason" defaultValue={session.cancellation_reason ?? ""} maxLength={1000} /></label>
  </div><p className="muted-small">The selected operation applies to scheduled sessions only. A reschedule requires a reason for the in-app notification.</p><button type="submit" className="button button--secondary">Apply session change</button></form></div></details>;
}
