"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ConfigurationNotice } from "@/components/configuration-notice";

const emailSchema = z.string().trim().email("Enter a valid college email address.");
const passwordSchema = z.string().min(8, "Use at least 8 characters.");

type AuthMode = "login" | "register" | "forgot" | "reset";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const email = typeof values.email === "string" ? values.email.trim() : "";
    const password = typeof values.password === "string" ? values.password : "";

    const emailCheck = emailSchema.safeParse(email);
    if (mode !== "reset" && !emailCheck.success) return setError(emailCheck.error.issues[0]?.message ?? "Check the email address.");
    if ((mode === "login" || mode === "register" || mode === "reset") && !passwordSchema.safeParse(password).success) return setError("Use a password with at least 8 characters.");
    if (!configured) return setError("Supabase is not configured yet. Ask your campus administrator to complete the setup.");

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured yet.");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace("/app");
        router.refresh();
      } else if (mode === "register") {
        const fullName = String(values.fullName ?? "").trim();
        if (fullName.length < 2) throw new Error("Enter your full name.");
        if (fullName.length > 120) throw new Error("Name must be 120 characters or fewer.");
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace("/app");
          router.refresh();
        } else {
          setMessage("Check your college email to verify the account. Your account is created with the student role; faculty and administrator access is provisioned by your college.");
        }
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (authError) throw authError;
        setMessage("If an account exists for that address, a reset link has been sent.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("Password updated. You can now sign in with the new password.");
        window.setTimeout(() => router.replace("/login"), 1200);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Sign in" : mode === "register" ? "Create a student account" : mode === "forgot" ? "Reset your password" : "Choose a new password";
  const description = mode === "login" ? "Sign in to continue to your academic workspace." : mode === "register" ? "Use your college email. New public accounts receive student access." : mode === "forgot" ? "We’ll send a secure reset link if an account matches." : "Choose a new password for your account.";

  return (
    <section className="surface auth-card" aria-labelledby="auth-title">
      <h2 id="auth-title">{title}</h2>
      <p>{description}</p>
      {!configured && <div style={{ marginBottom: 16 }}><ConfigurationNotice compact /></div>}
      <form className="form-stack" onSubmit={onSubmit} noValidate>
        {mode === "register" && <label className="field"><span className="field-label">Full name</span><input className="input" name="fullName" autoComplete="name" required maxLength={120} placeholder="Your name" /></label>}
        {mode !== "reset" && <label className="field"><span className="field-label">College email</span><input className="input" type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@college.edu" /></label>}
        {(mode === "login" || mode === "register" || mode === "reset") && <label className="field"><span className="field-label">{mode === "reset" ? "New password" : "Password"}</span><input className="input" type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} placeholder="At least 8 characters" /></label>}
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        {message && <div className="notice notice--info" role="status">{message}</div>}
        <button className="button button--primary" type="submit" disabled={busy || !configured}>
          {busy ? <><LoaderCircle size={16} className="spin" /> Working…</> : <>{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"} <ArrowRight size={15} /></>}
        </button>
      </form>
      <div className="auth-links">
        {mode === "login" ? <><Link href="/forgot-password">Forgot password?</Link><Link href="/register">Create account</Link></> : mode === "register" ? <Link href="/login">Already have an account? Sign in</Link> : <Link href="/login">Back to sign in</Link>}
      </div>
    </section>
  );
}
