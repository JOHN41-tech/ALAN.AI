import { cn } from "@/lib/utils";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
  markOnly?: boolean;
};

export function BrandMark({ compact = false, className, markOnly = false }: BrandMarkProps) {
  return (
    <span className={cn("brand-lockup", compact && "brand-lockup--compact", className)}>
      <svg className="brand-mark" viewBox="0 0 40 40" role="img" aria-label="ALAN.AI mark">
        <path d="M8.5 30 18.1 9.5h4.1L32 30M13.6 21.3h14.7" fill="none" stroke="currentColor" strokeWidth="3.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="30.6" cy="10.5" r="3.1" fill="currentColor" />
      </svg>
      {!markOnly && <span className="brand-name">ALAN<strong>.AI</strong></span>}
    </span>
  );
}
