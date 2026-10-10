"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
function errorTo(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }

export async function markNotificationRead(form: FormData) {
  const current = await requireAuthenticatedProfile();
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const id = String(form.get("notification_id") ?? "").trim();
  if (!uuid.safeParse(id).success) return errorTo("/notifications", "Notification identifier is invalid.");
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", current.userId).is("read_at", null);
  if (error) return errorTo("/notifications", error.message);
  revalidatePath("/notifications"); revalidatePath("/dashboard");
  redirect("/notifications?success=Notification%20marked%20as%20read.");
}

export async function markAllNotificationsRead() {
  const current = await requireAuthenticatedProfile();
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", current.userId).is("read_at", null);
  if (error) return errorTo("/notifications", error.message);
  revalidatePath("/notifications"); revalidatePath("/dashboard");
  redirect("/notifications?success=All%20notifications%20marked%20as%20read.");
}
