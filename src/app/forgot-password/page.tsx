import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { AuthForm } from "@/features/auth/auth-form";
import { BrandMark } from "@/components/brand-mark";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <main className="container">
      <header className="public-nav"><Link href="/" aria-label="College Companion home"><BrandMark /></Link><Link className="button button--ghost" href="/login"><ArrowLeft size={15} /> Back to sign in</Link></header>
      <div className="auth-wrap">
        <div className="auth-aside"><span className="eyebrow"><KeyRound size={14} /> Account recovery</span><h1>Let’s get you back in.</h1><p className="body-copy" style={{ fontSize: 15 }}>Request a secure link. The response won’t disclose whether an email is registered.</p></div>
        <AuthForm mode="forgot" />
      </div>
    </main>
  );
}
