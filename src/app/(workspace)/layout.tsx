import { AppShell } from "@/components/app-shell";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const current = await requireAuthenticatedProfile();
  return <AppShell profile={current.profile}>{children}</AppShell>;
}
