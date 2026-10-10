import { AlertTriangle, ExternalLink } from "lucide-react";

export function ConfigurationNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className="notice notice--info" role="status">
      <AlertTriangle size={17} aria-hidden="true" style={{ flex: "none", marginTop: 1 }} />
      <div>
        <strong>Connect a Supabase project to enable live accounts and academic data.</strong>
        {!compact && <p style={{ margin: "4px 0 0" }}>Set the Supabase project URL and publishable key using the protected project settings. This app does not replace missing data with sample statistics.</p>}
        <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, fontWeight: 650 }}>
          Open Supabase dashboard <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
