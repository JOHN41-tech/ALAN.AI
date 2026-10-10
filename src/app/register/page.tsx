import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { AuthForm } from "@/features/auth/auth-form";
import { BrandMark } from "@/components/brand-mark";

export const metadata = { title: "Create a student account" };

export default function RegisterPage() {
  return (
    <main className="container">
      <header className="public-nav"><Link href="/" aria-label="College Companion home"><BrandMark /></Link><Link className="button button--ghost" href="/"><ArrowLeft size={15} /> Back home</Link></header>
      <div className="auth-wrap">
        <div className="auth-aside"><span className="eyebrow"><GraduationCap size={14} /> Student registration</span><h1>A clear view of what’s next.</h1><p className="body-copy" style={{ fontSize: 15 }}>Create a student account with your college email. Faculty and administrator access is provisioned separately by your college.</p></div>
        <AuthForm mode="register" />
      </div>
    </main>
  );
}
