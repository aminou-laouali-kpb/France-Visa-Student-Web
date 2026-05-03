import { useState, useMemo } from "react";
import { useListAuditLogs, useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { AuditLog, UserRow } from "@/types";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

const PAGE_SIZE = 25;

export function AdminAuditLogs() {
  const [userId, setUserId] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [page, setPage] = useState(0);

  const params = useMemo(() => {
    const p: Record<string, number | string> = {};
    if (userId) p.userId = Number(userId);
    if (action) p.action = action;
    return p;
  }, [userId, action]);

  const { data: logsRaw = [] } = useListAuditLogs(params);
  const { data: usersRaw = [] } = useListUsers({});
  const users = usersRaw as unknown as UserRow[];
  const allLogs = logsRaw as unknown as AuditLog[];

  const filtered = useMemo(() => {
    let out = allLogs;
    if (studentId) {
      const sid = Number(studentId);
      out = out.filter(
        (l) =>
          l.studentId === sid ||
          (l.entityType === "student" && l.entityId === sid),
      );
    }
    return out;
  }, [allLogs, studentId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const userById = (id?: number | null) => {
    if (!id) return null;
    return users.find((u) => u.id === id) ?? null;
  };

  const reset = () => {
    setUserId("");
    setAction("");
    setStudentId("");
    setPage(0);
  };

  return (
    <div className="space-y-6" data-testid="admin-audit-logs">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Journal d'audit</h1>
        <p className="text-slate-600 mt-1">
          Toutes les actions effectuées sur la plateforme
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <CardTitle className="text-sm font-medium">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500">Utilisateur</label>
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2 bg-white text-sm"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(0);
              }}
              data-testid="filter-user"
            >
              <option value="">Tous</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Action</label>
            <Input
              placeholder="ex. student.update"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(0);
              }}
              data-testid="filter-action"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">ID étudiant</label>
            <Input
              type="number"
              placeholder="ex. 42"
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value);
                setPage(0);
              }}
              data-testid="filter-student"
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={reset} data-testid="button-reset-filters">
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Entité</th>
                  <th className="text-left px-4 py-3 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => {
                  const actor = userById(l.userId);
                  return (
                    <tr
                      key={l.id}
                      className="border-b hover:bg-slate-50"
                      data-testid={`audit-row-${l.id}`}
                    >
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDateTime(l.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {actor ? (
                          <>
                            <div className="font-medium">
                              {actor.firstName} {actor.lastName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {actor.email}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">Système</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{l.action}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.entityType} #{l.entityId ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-md truncate">
                        {l.details ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      Aucune entrée pour ces filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between p-3 border-t bg-slate-50">
              <div className="text-xs text-slate-500">
                {filtered.length} entrées · page {page + 1} / {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
