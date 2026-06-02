import { useTranslation } from "react-i18next";

export type ReadinessLevel = "low" | "medium" | "high" | null | undefined;

const STYLES: Record<string, { dot: string; label: string }> = {
  high: { dot: "bg-emerald-500", label: "text-emerald-800" },
  medium: { dot: "bg-amber-500", label: "text-amber-800" },
  low: { dot: "bg-red-500", label: "text-red-800" },
};

export function ReadinessTrafficLight({
  level,
  score,
  compact = false,
}: {
  level: ReadinessLevel;
  score?: number | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (!level) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const style = STYLES[level] ?? STYLES.medium;
  const labelKey =
    level === "high"
      ? "readiness.green"
      : level === "medium"
        ? "readiness.amber"
        : "readiness.red";

  return (
    <div
      className="inline-flex items-center gap-2"
      data-testid={`readiness-${level}`}
      title={score != null ? `${score}/100` : undefined}
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} aria-hidden />
      {!compact && (
        <span className={`text-xs font-medium ${style.label}`}>{t(labelKey)}</span>
      )}
      {score != null && (
        <span className="text-xs text-slate-500 tabular-nums">{score}</span>
      )}
    </div>
  );
}
