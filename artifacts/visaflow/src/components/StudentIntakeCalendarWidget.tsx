import { useGetUpcomingIntakeDeadlines } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";

type Entry = {
  id: number;
  label: string;
  deadlineType: string;
  windowStart: string | null;
  windowEnd: string;
  academicYear: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  campus_france: "Campus France",
  visa_appointment: "Visa",
  school_application: "École",
  other: "Autre",
};

function daysFromNow(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getTime();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function StudentIntakeCalendarWidget() {
  const { data, isLoading } = useGetUpcomingIntakeDeadlines({ limit: 3 });
  const rows = (data ?? []) as Entry[];

  return (
    <Card data-testid="card-intake-calendar">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          Prochaines échéances pour votre pays
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="text-sm text-slate-500 py-2">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500 py-2">
            Aucune échéance enregistrée pour votre nationalité.
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
                  <Badge variant="outline">{TYPE_LABELS[r.deadlineType] ?? r.deadlineType}</Badge>
                  <span className={
                    "text-xs " +
                    (days <= 7 ? "text-rose-700 font-medium" : days <= 30 ? "text-amber-700" : "text-slate-500")
                  }>
                    {days <= 0 ? "Aujourd'hui" : `J−${days}`}
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
