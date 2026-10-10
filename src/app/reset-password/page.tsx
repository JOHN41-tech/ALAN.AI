import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { AuthForm } from "@/features/auth/auth-form";
import { BrandMark } from "@/components/brand-mark";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <main className="container">
      <header className="public-nav"><Link href="/" aria-label="College Companion home"><BrandMark /></Link><Link className="button button--ghost" href="/login"><ArrowLeft size={15} /> Back to sign in</Link></header>
      <div className="auth-wrap">
        <div className="auth-aside"><span className="eyebrow"><KeyRound size={14} /> Secure recovery</span><h1>Choose a password you can rely on.</h1><p className="body-copy" style={{ fontSize: 15 }}>This form works only after Supabase verifies your recovery link.</p></div>
        <AuthForm mode="reset" />
      </div>
    </main>
  );
}
