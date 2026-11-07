import { cn } from "@/lib/utils";

interface ProgressRingProps {
  /** 0–1, or null when there is nothing to measure yet. */
  ratio: number | null;
  size?: number;
  stroke?: number;
  className?: string;
}

export function ProgressRing({ ratio, size = 56, stroke = 4, className }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = ratio === null ? null : Math.round(ratio * 100);

  return (
    <div
      role="img"
      aria-label={percent === null ? "No progress yet" : `${percent}% of linked tasks done`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
          strokeDasharray={ratio === null ? "2 4" : undefined}
        />
        {ratio !== null && ratio > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out-quint motion-reduce:transition-none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className="absolute font-mono text-[0.6875rem] font-medium text-foreground tabular-nums"
      >
        {percent === null ? "—" : `${percent}%`}
      </span>
    </div>
  );
}
