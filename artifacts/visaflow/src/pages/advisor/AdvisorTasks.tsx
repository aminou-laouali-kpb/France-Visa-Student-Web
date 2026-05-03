import { useListMyTasks, useUpdateTask } from "@workspace/api-client-react";
import type { UpdateTaskBody, UpdateTaskBodyStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/types";
import { AlertTriangle, Clock, ListTodo } from "lucide-react";

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "Élevée",
  medium: "Moyenne",
  low: "Basse",
};
const PRIORITY_TONES: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-700 border-rose-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

function urgencyBadge(dueDate?: string | null) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (days < 0) {
    return (
      <Badge className="bg-rose-600 hover:bg-rose-600 text-white">
        <AlertTriangle className="w-3 h-3 mr-1" />
        En retard de {Math.abs(days)} j
      </Badge>
    );
  }
  if (days === 0) {
    return (
      <Badge className="bg-rose-500 hover:bg-rose-500 text-white">
        <Clock className="w-3 h-3 mr-1" />
        Aujourd'hui
      </Badge>
    );
  }
  if (days <= 3) {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-500 text-white">
        <Clock className="w-3 h-3 mr-1" />
        Dans {days} j
      </Badge>
    );
  }
  if (days <= 7) {
    return (
      <Badge variant="outline" className="text-amber-700 border-amber-300">
        <Clock className="w-3 h-3 mr-1" />
        Dans {days} j
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-slate-600">
      Dans {days} j
    </Badge>
  );
}

export function AdvisorTasks() {
  const { data: tasksRaw = [], refetch } = useListMyTasks({});
  const tasks = tasksRaw as unknown as Task[];
  const update = useUpdateTask();

  const toggle = async (id: number, status: UpdateTaskBodyStatus) => {
    const data: UpdateTaskBody = { status };
    await update.mutateAsync({ taskId: id, data });
    refetch();
  };

  const pending = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const groups = PRIORITY_ORDER.map((p) => ({
    priority: p,
    tasks: pending
      .filter((t) => t.priority === p)
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }),
  }));

  return (
    <div className="space-y-6" data-testid="advisor-tasks">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mes tâches</h1>
        <p className="text-slate-600 mt-1">
          Triées par priorité avec décompte d'échéance
        </p>
      </div>

      {pending.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <ListTodo className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            Aucune tâche en cours
          </CardContent>
        </Card>
      )}

      {groups.map(
        (g) =>
          g.tasks.length > 0 && (
            <Card key={g.priority} data-testid={`group-priority-${g.priority}`}>
              <CardHeader className="flex flex-row items-center gap-2">
                <Badge
                  variant="outline"
                  className={`${PRIORITY_TONES[g.priority]} font-semibold`}
                >
                  {PRIORITY_LABELS[g.priority]}
                </Badge>
                <CardTitle className="text-base">
                  {g.tasks.length} tâche{g.tasks.length > 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {g.tasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-4"
                      data-testid={`task-${t.id}`}
                    >
                      <input
                        type="checkbox"
                        onChange={(e) =>
                          toggle(t.id, e.target.checked ? "done" : "pending")
                        }
                        data-testid={`checkbox-task-${t.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{t.title}</div>
                        {t.description && (
                          <div className="text-sm text-slate-600">
                            {t.description}
                          </div>
                        )}
                        {t.dueDate && (
                          <div className="text-xs text-slate-500 mt-1">
                            Échéance : {formatDate(t.dueDate)}
                          </div>
                        )}
                      </div>
                      {urgencyBadge(t.dueDate)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ),
      )}

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">
              Terminées ({done.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {done.slice(0, 20).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-4 opacity-60"
                >
                  <input type="checkbox" checked readOnly />
                  <div className="flex-1 line-through">{t.title}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
