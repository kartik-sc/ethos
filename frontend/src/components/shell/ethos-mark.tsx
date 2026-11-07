import { cn } from "@/lib/utils";

export function EthosMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="6"
        className="fill-primary/12 stroke-primary/45"
        strokeWidth="1"
      />
      <path
        d="M7.5 8.5 11 12l-3.5 3.5"
        className="stroke-primary"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12.5 15.5h4"
        className="stroke-primary/70"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
