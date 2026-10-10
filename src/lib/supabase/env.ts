import { z } from "zod";

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type SupabaseEnvironment = z.infer<typeof supabaseEnvSchema>;

export function getSupabaseEnvironment(): SupabaseEnvironment | null {
  const parsed = supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return parsed.success ? parsed.data : null;
}

export function hasSupabaseConfiguration(): boolean {
  return getSupabaseEnvironment() !== null;
}
