import { cn } from "@/lib/utils";

export type StatusKind = "up" | "due" | "overdue" | "incomplete";

const DEFAULT_LABELS: Record<StatusKind, string> = {
  up: "Up to date",
  due: "Due soon",
  overdue: "Overdue",
  incomplete: "Incomplete",
};

export function StatusBadge({
  kind,
  label,
  className,
}: {
  kind: StatusKind;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("pw-badge", kind, className)}>
      <span className="pw-dot" />
      {label ?? DEFAULT_LABELS[kind]}
    </span>
  );
}
