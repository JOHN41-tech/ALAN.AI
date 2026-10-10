import { AlertCircle, CheckCircle2 } from "lucide-react";

export function StatusMessage({ error, success }: { error?: string; success?: string }) {
  if (error) return <div className="notice notice--error" role="alert"><AlertCircle size={17} />{error}</div>;
  if (success) return <div className="notice notice--info" role="status"><CheckCircle2 size={17} />{success}</div>;
  return null;
}
