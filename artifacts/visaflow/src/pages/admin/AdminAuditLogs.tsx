import { useState, useMemo } from "react";
import { useListAuditLogs, useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 25;

export function AdminAuditLogs() {
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [page, setPage] = useState(0);

  const params = useMemo(() => {
    const p: Record<string, number | string> = {
      limit: PAGE_SIZE + 1,
      offset: page * PAGE_SIZE,
    };
    if (userId) p.userId = Number(userId);
    if (action) p.action = action;
    if (studentId) p.studentId = Number(studentId);
    return p;
  }, [userId, action, studentId, page]);

  const { data: allLogs = [], isLoading } = useListAuditLogs(params);
  const { data: users = [] } = useListUsers({});

  const hasNext = allLogs.length > PAGE_SIZE;
  const visible = allLogs.slice(0, PAGE_SIZE);

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

  const onFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  return (
    <div className="space-y-6" data-testid="admin-audit-logs">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t("audit.title")}</h1>
        <p className="text-slate-600 mt-1">
          {t("audit.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <CardTitle className="text-sm font-medium">{t("audit.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500">{t("audit.userLabel")}</label>
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2 bg-white text-sm"
              value={userId}
              onChange={(e) => onFilterChange(setUserId)(e.target.value)}
              data-testid="filter-user"
            >
              <option value="">{t("filter.allUsers")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">{t("audit.actionLabel")}</label>
            <Input
              placeholder="ex. student.update"
              value={action}
              onChange={(e) => onFilterChange(setAction)(e.target.value)}
              data-testid="filter-action"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">{t("audit.studentIdLabel")}</label>
            <Input
              type="number"
              placeholder="ex. 42"
              value={studentId}
              onChange={(e) => onFilterChange(setStudentId)(e.target.value)}
              data-testid="filter-student"
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={reset} data-testid="button-reset-filters">
              {t("filter.reset")}
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
                  <th className="text-left px-4 py-3 font-medium">{t("table.date")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("table.user")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("table.action")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("table.entity")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("table.details")}</th>
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
                          <span className="text-slate-400">{t("audit.system")}</span>
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
                {!isLoading && visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      {t("audit.noEntries")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-3 border-t bg-slate-50">
            <div className="text-xs text-slate-500">{t("common.page")} {page + 1}</div>
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
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
