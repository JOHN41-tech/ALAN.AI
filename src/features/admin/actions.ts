"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { getSupabaseEnvironment } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_ROLES } from "@/lib/auth/types";

const uuid = z.string().uuid();
const clean = (value: FormDataEntryValue | null, max = 160) => String(value ?? "").trim().slice(0, max);
const failTo = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);
const succeedAt = (path: string, message: string): never => redirect(`${path}?success=${encodeURIComponent(message)}`);

async function requireAdmin() {
  const current = await requireAuthenticatedProfile(["administrator"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  return { current, supabase };
}

const entityFields: Record<string, { table: string; fields: string[]; label: string }> = {
  department: { table: "departments", fields: ["code", "name", "description"], label: "department" },
  program: { table: "programs", fields: ["department_id", "code", "name", "degree_level"], label: "program" },
  academic_year: { table: "academic_years", fields: ["name", "starts_on", "ends_on", "is_current"], label: "academic year" },
  semester: { table: "semesters", fields: ["academic_year_id", "program_id", "number", "name", "starts_on", "ends_on", "is_current"], label: "semester" },
  section: { table: "sections", fields: ["semester_id", "program_id", "name", "capacity"], label: "section" },
  course: { table: "courses", fields: ["department_id", "program_id", "code", "title", "credits"], label: "course" },
  classroom: { table: "classrooms", fields: ["code", "name", "capacity", "location"], label: "classroom" },
  course_offering: { table: "course_offerings", fields: ["program_id", "course_id", "semester_id", "is_active"], label: "course offering" },
};

function parseEntityData(formData: FormData, entity: string) {
  const config = entityFields[entity];
  if (!config) throw new Error("Choose a supported academic record type.");
  const value: Record<string, unknown> = {};
  for (const field of config.fields) {
    const input = clean(formData.get(field));
    if (field === "is_current" || field === "is_active") value[field] = formData.get(field) === "on";
    else if (field === "number" || field === "capacity" || field === "credits") value[field] = input ? Number(input) : null;
    else if (field === "program_id" && !input) value[field] = null;
    else if (field === "description" || field === "location" || field === "name" || field === "degree_level") value[field] = input || null;
    else value[field] = input;
  }
  const recordId = clean(formData.get("id"), 40);
  if (recordId) value.id = recordId;
  if (["program", "section", "course"].includes(entity) && value.department_id === "") value.department_id = null;
  return { config, recordId, value };
}

export async function saveAcademicRecord(formData: FormData) {
  const { supabase } = await requireAdmin();
  const entity = clean(formData.get("entity"), 40);
  const path = "/admin/structure";
  try {
    const { config, recordId, value } = parseEntityData(formData, entity);
    if (entity === "department" && (!value.code || !value.name)) throw new Error("Department code and name are required.");
    if (entity === "program" && (!value.department_id || !value.code || !value.name)) throw new Error("Program department, code and name are required.");
    if (entity === "academic_year" && (!value.name || !value.starts_on || !value.ends_on)) throw new Error("Academic year name and both dates are required.");
    if (entity === "semester" && (!value.academic_year_id || !value.number || !value.name || !value.starts_on || !value.ends_on)) throw new Error("Semester year, number, name and dates are required.");
    if (entity === "section" && (!value.semester_id || !value.program_id || !value.name)) throw new Error("Section semester, program and name are required.");
    if (entity === "course" && (!value.department_id || !value.code || !value.title)) throw new Error("Course department, code and title are required.");
    if (entity === "classroom" && !value.code) throw new Error("Classroom code is required.");
    if (entity === "course_offering" && (!value.program_id || !value.course_id || !value.semester_id)) throw new Error("Offering program, course and semester are required.");
    if (recordId && !uuid.safeParse(recordId).success) throw new Error("Record identifier is invalid.");
    const fields = { ...value };
    delete fields.id;
    const result = recordId
      ? await supabase.from(config.table).update(fields).eq("id", recordId)
      : await supabase.from(config.table).insert(fields);
    if (result.error) throw new Error(result.error.message);
    revalidatePath(path);
    succeedAt(path, `${config.label[0]?.toUpperCase()}${config.label.slice(1)} saved.`);
  } catch (error) {
    failTo(path, error instanceof Error ? error.message : "The record could not be saved.");
  }
}

export async function setAcademicRecordActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const entity = clean(formData.get("entity"), 40);
  const id = clean(formData.get("id"), 40);
  const active = formData.get("active") === "true";
  const config = entityFields[entity];
  if (!config || !uuid.safeParse(id).success) failTo("/admin/structure", "Record type or identifier is invalid.");
  const activeField = entity === "academic_year" || entity === "semester" ? "is_current" : "is_active";
  const { error } = await supabase.from(config.table).update({ [activeField]: active }).eq("id", id);
  if (error) failTo("/admin/structure", error.message);
  revalidatePath("/admin/structure");
  succeedAt("/admin/structure", `${config.label} updated.`);
}

function getServiceRoleClient() {
  const env = getSupabaseEnvironment();
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) throw new Error("A protected Supabase secret key is required for administrator-controlled account provisioning.");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function inviteCollegeAccount(formData: FormData) {
  const { current } = await requireAdmin();
  const name = clean(formData.get("full_name"), 120);
  const email = clean(formData.get("email"), 254).toLowerCase();
  const role = clean(formData.get("role"), 30);
  const parsed = z.object({ full_name: z.string().min(2).max(120), email: z.email(), role: z.enum(["faculty", "administrator"]) }).safeParse({ full_name: name, email, role });
  if (!parsed.success) return failTo("/admin/users", parsed.error.issues[0]?.message ?? "Check the account details.");
  try {
    const admin = getServiceRoleClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { data: { full_name: parsed.data.full_name } });
    if (error || !data.user) throw new Error(error?.message ?? "The invitation was not created.");
    const { error: profileError } = await admin.from("profiles").update({ role: parsed.data.role, full_name: parsed.data.full_name, account_status: "active" }).eq("id", data.user.id);
    if (profileError) throw new Error(`The invitation was created, but the profile role could not be assigned: ${profileError.message}`);
    await admin.from("admin_audit_logs").insert({ actor_id: current.userId, action: "invite_account", entity_type: "profile", entity_id: data.user.id, details: { role: parsed.data.role } });
    revalidatePath("/admin/users");
    succeedAt("/admin/users", `Invitation sent to ${parsed.data.email}.`);
  } catch (error) {
    failTo("/admin/users", error instanceof Error ? error.message : "Account provisioning failed.");
  }
}

export async function updateCollegeAccount(formData: FormData) {
  const { current } = await requireAdmin();
  const id = clean(formData.get("id"), 40);
  const role = clean(formData.get("role"), 30);
  const accountStatus = clean(formData.get("account_status"), 20);
  const departmentId = clean(formData.get("department_id"), 40) || null;
  const programId = clean(formData.get("program_id"), 40) || null;
  const academicYearId = clean(formData.get("academic_year_id"), 40) || null;
  const semesterId = clean(formData.get("semester_id"), 40) || null;
  const sectionId = clean(formData.get("section_id"), 40) || null;
  const studentIdentifier = clean(formData.get("student_identifier"), 48) || null;
  if (!uuid.safeParse(id).success || !APP_ROLES.includes(role as (typeof APP_ROLES)[number]) || !["active", "suspended", "invited"].includes(accountStatus)) return failTo("/admin/users", "Profile, role or account status is invalid.");
  if ([departmentId, programId, academicYearId, semesterId, sectionId].some((value) => value !== null && !uuid.safeParse(value).success)) return failTo("/admin/users", "One of the academic placement IDs is invalid.");
  if (id === current.userId && role !== "administrator") return failTo("/admin/users", "You cannot remove your own administrator access here.");
  try {
    const admin = getServiceRoleClient();
    const { error } = await admin.rpc("admin_update_profile_access", {
      p_actor_id: current.userId,
      p_profile_id: id,
      p_role: role,
      p_account_status: accountStatus,
      p_department_id: departmentId,
      p_program_id: programId,
      p_academic_year_id: academicYearId,
      p_semester_id: semesterId,
      p_section_id: sectionId,
      p_student_identifier: studentIdentifier,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/users");
    succeedAt("/admin/users", "Account access and academic placement updated; course enrollments synchronized and change logged.");
  } catch (error) {
    failTo("/admin/users", error instanceof Error ? error.message : "Account access could not be updated.");
  }
}

export async function updateProfileDetails(formData: FormData) {
  const current = await requireAuthenticatedProfile();
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const name = clean(formData.get("full_name"), 120);
  const preferred = clean(formData.get("preferred_name"), 80);
  const parsed = z.object({ full_name: z.string().min(2).max(120), preferred_name: z.string().max(80) }).safeParse({ full_name: name, preferred_name: preferred });
  if (!parsed.success) return failTo("/profile", parsed.error.issues[0]?.message ?? "Check the profile details.");
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.full_name, preferred_name: parsed.data.preferred_name || null }).eq("id", current.userId);
  if (error) failTo("/profile", error.message);
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  succeedAt("/profile", "Profile updated.");
}
