import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/auth/guards";

export default async function AppEntryPage() {
  const current = await getAuthenticatedProfile();
  if (!current) redirect("/login");
  if (current.profile.role === "administrator") redirect("/admin");
  redirect("/dashboard");
}
