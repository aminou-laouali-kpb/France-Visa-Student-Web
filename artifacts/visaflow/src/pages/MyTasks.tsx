import { useListMyTasks, useUpdateTask } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/types";
import type { UpdateTaskBody } from "@workspace/api-client-react";

export function MyTasks() {
  const { data: tasksRaw = [], refetch } = useListMyTasks({});
  const tasks = tasksRaw as unknown as Task[];
  const update = useUpdateTask();

  const toggle = async (id: number, status: string) => {
    await update.mutateAsync({ taskId: id, data: { status } as unknown as UpdateTaskBody });
    refetch();
  };

  const pending = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Mes tâches</h1>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {pending.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  onChange={(e) => toggle(t.id, e.target.checked ? "done" : "pending")}
                  data-testid={`checkbox-task-${t.id}`}
                />
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  {t.description && (
                    <div className="text-sm text-slate-600">{t.description}</div>
                  )}
                  {t.dueDate && (
                    <div className="text-xs text-slate-500 mt-1">
                      Échéance : {formatDate(t.dueDate)}
                    </div>
                  )}
                </div>
                <StatusBadge status={t.priority} />
                <StatusBadge status={t.status} />
              </div>
            ))}
            {pending.length === 0 && (
              <div className="p-8 text-center text-slate-500">Aucune tâche en cours</div>
            )}
          </div>
        </CardContent>
      </Card>

      {done.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mt-8">Terminées</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {done.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-4 opacity-60">
                    <input type="checkbox" checked readOnly />
                    <div className="flex-1 line-through">{t.title}</div>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
