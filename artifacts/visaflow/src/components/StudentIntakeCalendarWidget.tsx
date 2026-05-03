import { useGetUpcomingIntakeDeadlines } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";

type Entry = {
  id: number;
  label: string;
  deadlineType: string;
  windowStart: string | null;
  windowEnd: string;
  academicYear: string | null;
};

function daysFromNow(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getTime();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function StudentIntakeCalendarWidget() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetUpcomingIntakeDeadlines({ limit: 3 });
  const rows = (data ?? []) as Entry[];

  return (
    <Card data-testid="card-intake-calendar">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          {t("calendar.upcomingDeadlines")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="text-sm text-slate-500 py-2">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500 py-2">
            {t("calendar.noDeadlines")}
          </div>
        ) : (
          rows.map((r) => {
            const days = daysFromNow(r.windowEnd);
            return (
              <div
                key={r.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50"
                data-testid={`intake-deadline-${r.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900">{r.label}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {r.windowStart ? `${r.windowStart} → ` : ""}{r.windowEnd}
                    {r.academicYear ? ` · ${r.academicYear}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline">
                    {t(`calendar.deadlineType_${r.deadlineType}`, { defaultValue: r.deadlineType })}
                  </Badge>
                  <span className={
                    "text-xs " +
                    (days <= 7 ? "text-rose-700 font-medium" : days <= 30 ? "text-amber-700" : "text-slate-500")
                  }>
                    {days <= 0 ? t("calendar.today") : t("calendar.daysLeft", { n: days })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
