import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteCompanionConversation, sendCompanionMessage } from "@/features/career/companion-actions";
import type { ChatMessage } from "@/features/career/types";

export const metadata: Metadata = { title: "AI companion" };
type Search = Promise<{ conversation?: string; error?: string; success?: string }>;

export default async function CompanionPage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="AI companion" /><StatusMessage error="Configure Supabase to continue." /></>;
  const { data: conversations, error } = await supabase.from("phase2_conversations").select("id,title,updated_at").eq("user_id", current.userId).order("updated_at", { ascending: false }).limit(20);
  const selected = conversations?.find((row) => row.id === params.conversation);
  let messages: ChatMessage[] = [];
  let messageError: string | undefined;
  if (selected) {
    const result = await supabase.from("phase2_messages").select("id,role,content,created_at").eq("conversation_id", selected.id).order("created_at", { ascending: false }).limit(30);
    messages = ((result.data ?? []) as ChatMessage[]).reverse();
    messageError = result.error?.message;
  }
  const rotationReady = [process.env.ALAN_AI_API_KEY_1, process.env.ALAN_AI_API_KEY_2, process.env.ALAN_AI_API_KEY_3].filter((key) => Boolean(key?.trim())).length === 3;
  return <>
    <PageHeading title="ALAN.AI companion" description="A private study and career-planning conversation. It is not an official source for college records or policies." />
    <StatusMessage error={params.error || error?.message || messageError} success={params.success} />
    <div className="career-companion-layout"><aside className="surface career-conversation-list"><div className="career-conversation-list-head"><h2>Conversations</h2><Link className="icon-button" href="/career/companion" aria-label="Start a new conversation"><Plus size={17} /></Link></div>{conversations?.length ? conversations.map((conversation) => <Link className={`career-conversation-link ${selected?.id === conversation.id ? "is-active" : ""}`} href={`/career/companion?conversation=${conversation.id}`} key={conversation.id}><MessageCircle size={15} /><span>{conversation.title}</span></Link>) : <p className="muted-small">Your private conversation history will appear here.</p>}</aside>
      <section className="surface career-chat-panel"><div className="career-chat-header"><span className="career-hub-icon"><Sparkles size={20} /></span><div><strong>Study &amp; career companion</strong><small>{rotationReady ? "Three protected keys available for fallback rotation" : "AI provider configuration is incomplete"}</small></div>{selected && <form action={deleteCompanionConversation}><input type="hidden" name="conversation_id" value={selected.id} /><button className="icon-button" aria-label="Delete this conversation"><Trash2 size={16} /></button></form>}</div>
        {!rotationReady && <p className="notice notice--warning">The AI companion needs its protected server credentials and a compatible HTTPS provider endpoint.</p>}
        {selected ? <div className="career-chat-messages" aria-live="polite">{messages.map((message) => <article className={`career-message career-message--${message.role}`} key={message.id}><span className="eyebrow">{message.role === "assistant" ? "ALAN.AI" : "You"}</span><p>{message.content}</p></article>)}</div> : <div className="career-chat-welcome"><Sparkles size={24} /><h2>What would you like to work through?</h2><p>Ask for an explanation, study strategy, practice idea or a way to explore a career goal. Do not share passwords or highly sensitive personal information.</p></div>}
        <form action={sendCompanionMessage} className="career-chat-form">{selected && <input type="hidden" name="conversation_id" value={selected.id} />}<label className="field"><span className="field-label">Focus</span><select name="topic" defaultValue="general"><option value="general">General</option><option value="study">Study help</option><option value="career">Career guidance</option></select></label><label className="field"><span className="field-label">Message</span><textarea className="input" name="message" rows={3} maxLength={4000} required placeholder="Tell ALAN.AI what you want help with…" /></label><label className="career-consent"><input type="checkbox" name="share_preferences" /> <span>Share my saved career interests and skills for this reply only. Off by default; academic records and identity details are never included.</span></label><div className="career-chat-submit"><small>Keep personal data minimal. Responses can be incomplete; verify important decisions independently.</small><button className="button button--primary">Send <Send size={15} /></button></div></form>
      </section></div>
  </>;
}
