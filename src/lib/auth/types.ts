export const APP_ROLES = ["student", "faculty", "administrator"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type StudentProfile = {
  id: string;
  role: AppRole;
  full_name: string;
  preferred_name: string | null;
  college_email: string | null;
  profile_image_path: string | null;
  department_id: string | null;
  program_id: string | null;
  academic_year_id: string | null;
  semester_id: string | null;
  section_id: string | null;
  student_identifier: string | null;
  account_status: "active" | "suspended" | "invited";
  created_at: string;
  updated_at: string;
};

export type AuthenticatedProfile = {
  userId: string;
  email: string | null;
  profile: StudentProfile;
};
