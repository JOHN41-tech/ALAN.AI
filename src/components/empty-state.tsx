import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div>
        <div className="empty-state-icon"><Icon size={20} aria-hidden="true" /></div>
        <h3>{title}</h3>
        <p>{description}</p>
        {action && <div style={{ marginTop: 14 }}>{action}</div>}
      </div>
    </div>
  );
}
