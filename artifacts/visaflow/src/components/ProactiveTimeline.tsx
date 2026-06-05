import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Calendar, CheckCircle2, Circle, AlertTriangle, Clock } from "lucide-react";
import type { ProactiveMilestone } from "@/types";

const STATUS_ICON: Record<
  ProactiveMilestone["status"],
  typeof CheckCircle2
> = {
  done: CheckCircle2,
  current: Circle,
  upcoming: Clock,
  overdue: AlertTriangle,
  blocked: AlertTriangle,
};

const STATUS_CLASS: Record<ProactiveMilestone["status"], string> = {
  done: "text-emerald-600",
  current: "text-blue-600",
  upcoming: "text-slate-400",
  overdue: "text-rose-600",
  blocked: "text-rose-600",
};

export function ProactiveTimeline({ milestones }: { milestones: ProactiveMilestone[] }) {
  const { t } = useTranslation();
  if (milestones.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">{t("timeline.empty")}</p>
    );
  }

  return (
    <ol className="space-y-3" data-testid="proactive-timeline">
      {milestones.map((m) => {
        const Icon = STATUS_ICON[m.status];
        const row = (
          <div className="flex items-start gap-3 text-sm">
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${STATUS_CLASS[m.status]}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900">{m.label}</div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span>{t(`timeline.status_${m.status}`)}</span>
                {m.dueDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {m.dueDate}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
        return (
          <li key={m.id} data-testid={`milestone-${m.id}`}>
            {m.href ? (
              <Link href={m.href}>
                <a className="block rounded-lg hover:bg-white/80 p-1 -m-1 transition-colors">
                  {row}
                </a>
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ol>
  );
}
