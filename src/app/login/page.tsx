import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/features/auth/auth-form";
import { BrandMark } from "@/components/brand-mark";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="container">
      <header className="public-nav"><Link href="/" aria-label="College Companion home"><BrandMark /></Link><Link className="button button--ghost" href="/"><ArrowLeft size={15} /> Back home</Link></header>
      <div className="auth-wrap">
        <div className="auth-aside"><span className="eyebrow"><ShieldCheck size={14} /> Your academic workspace</span><h1>Pick up where your week begins.</h1><p className="body-copy" style={{ fontSize: 15 }}>Your timetable, official updates and academic records stay together—and protected by your campus role.</p></div>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
