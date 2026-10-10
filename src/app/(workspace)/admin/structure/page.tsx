import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { EntityCatalog } from "@/features/admin/structure-forms";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Academic structure" };

type Search = Promise<{ error?: string; success?: string }>;

export default async function AcademicStructurePage({ searchParams }: { searchParams: Search }) {
  await requireAuthenticatedProfile(["administrator"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const [departments, programs, years, semesters, sections, courses, offerings, rooms] = await Promise.all([
    supabase.from("departments").select("*").order("name"),
    supabase.from("programs").select("*").order("name"),
    supabase.from("academic_years").select("*").order("starts_on", { ascending: false }),
    supabase.from("semesters").select("*").order("starts_on", { ascending: false }),
    supabase.from("sections").select("*").order("name"),
    supabase.from("courses").select("*").order("title"),
    supabase.from("course_offerings").select("*").order("created_at", { ascending: false }),
    supabase.from("classrooms").select("*").order("code"),
  ]);
  const departmentOptions = (departments.data ?? []).map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` }));
  const programOptions = (programs.data ?? []).map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` }));
  const yearOptions = (years.data ?? []).map((row) => ({ id: row.id, label: row.name }));
  const semesterOptions = (semesters.data ?? []).map((row) => ({ id: row.id, label: row.name }));
  const courseOptions = (courses.data ?? []).map((row) => ({ id: row.id, label: `${row.code} · ${row.title}` }));
  const catalogError = [departments.error, programs.error, years.error, semesters.error, sections.error, courses.error, offerings.error, rooms.error].find(Boolean)?.message;

  return <>
    <PageHeading title="Academic structure" description="Maintain the normalized academic catalog used by enrollments, schedules, notices and events." />
    <StatusMessage error={params.error ?? catalogError} success={params.success} />
    <div className="admin-catalog-grid">
      <EntityCatalog entity="department" title="Departments" description="College departments and ownership." records={departments.data ?? []} fields={[{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }, { name: "description", label: "Description", type: "textarea" }]} />
      <EntityCatalog entity="program" title="Programs" description="Degrees linked to a department." records={programs.data ?? []} fields={[{ name: "department_id", label: "Department", type: "select", required: true, options: departmentOptions }, { name: "code", label: "Program code", required: true }, { name: "name", label: "Program name", required: true }, { name: "degree_level", label: "Degree level", placeholder: "undergraduate" }]} />
      <EntityCatalog entity="academic_year" title="Academic years" description="Year boundaries and current-year selection." currentField="is_current" records={years.data ?? []} fields={[{ name: "name", label: "Name", required: true, placeholder: "2026–27" }, { name: "starts_on", label: "Starts on", type: "date", required: true }, { name: "ends_on", label: "Ends on", type: "date", required: true }, { name: "is_current", label: "Current", type: "checkbox" }]} />
      <EntityCatalog entity="semester" title="Semesters" description="Semester number, period and program." currentField="is_current" records={semesters.data ?? []} fields={[{ name: "academic_year_id", label: "Academic year", type: "select", required: true, options: yearOptions }, { name: "program_id", label: "Program", type: "select", options: programOptions }, { name: "number", label: "Semester number", type: "number", required: true }, { name: "name", label: "Name", required: true }, { name: "starts_on", label: "Starts on", type: "date", required: true }, { name: "ends_on", label: "Ends on", type: "date", required: true }, { name: "is_current", label: "Current", type: "checkbox" }]} />
      <EntityCatalog entity="section" title="Sections" description="Cohorts within a semester and program." records={sections.data ?? []} fields={[{ name: "semester_id", label: "Semester", type: "select", required: true, options: semesterOptions }, { name: "program_id", label: "Program", type: "select", required: true, options: programOptions }, { name: "name", label: "Section", required: true, placeholder: "A" }, { name: "capacity", label: "Capacity", type: "number" }]} />
      <EntityCatalog entity="course" title="Courses" description="Subjects taught in programs and semesters." records={courses.data ?? []} fields={[{ name: "department_id", label: "Department", type: "select", required: true, options: departmentOptions }, { name: "program_id", label: "Program", type: "select", options: programOptions }, { name: "code", label: "Course code", required: true }, { name: "title", label: "Course title", required: true }, { name: "credits", label: "Credits", type: "number" }]} />
      <EntityCatalog entity="course_offering" title="Course offerings" description="Courses available to a program in a specific semester; student placement synchronizes enrollments from these offerings." records={offerings.data ?? []} fields={[{ name: "program_id", label: "Program", type: "select", required: true, options: programOptions }, { name: "course_id", label: "Course", type: "select", required: true, options: courseOptions }, { name: "semester_id", label: "Semester", type: "select", required: true, options: semesterOptions }, { name: "is_active", label: "Active", type: "checkbox" }]} />
      <EntityCatalog entity="classroom" title="Classrooms" description="Rooms and labs available to schedules." records={rooms.data ?? []} fields={[{ name: "code", label: "Room code", required: true }, { name: "name", label: "Name" }, { name: "capacity", label: "Capacity", type: "number" }, { name: "location", label: "Location" }]} />
    </div>
  </>;
}
