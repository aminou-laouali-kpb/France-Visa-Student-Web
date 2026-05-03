import { useState } from "react";
import { Link } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import type { Student } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function StudentsList() {
  const { t: tr } = useTranslation();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data: students = [], isLoading } = useListStudents(
    statusFilter ? { status: statusFilter } : {},
  );

  const filtered = (students as unknown as Student[]).filter((s: Student) => {
    if (!q) return true;
    const haystack = `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase();
    return haystack.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">{tr("students.title")}</h1>
        <Link href="/app/students/new">
          <Button data-testid="button-new-student">
            <Plus className="w-4 h-4 mr-2" /> Nouveau dossier
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher par nom ou email…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="select-status-filter"
          >
            <option value="">{tr("filter.allStatuses")}</option>
            <option value="prospect">{tr("status.prospect")}</option>
            <option value="active">{tr("status.active")}</option>
            <option value="blocked">{tr("status.blocked")}</option>
            <option value="submitted">{tr("students.submitted")}</option>
            <option value="visa_obtained">{tr("status.visa_obtained")}</option>
            <option value="visa_refused">{tr("status.visa_refused")}</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">{tr("common.loading")}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">{tr("students.empty")}</div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">{tr("table.student")}</th>
                  <th className="text-left px-4 py-3 font-medium">{tr("table.status")}</th>
                  <th className="text-left px-4 py-3 font-medium">{tr("table.progress")}</th>
                  <th className="text-left px-4 py-3 font-medium">{tr("table.activity")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: Student) => (
                  <tr key={s.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/app/students/${s.id}`}>
                        <a className="block" data-testid={`link-student-${s.id}`}>
                          <div className="font-medium text-slate-900">
                            {s.firstName} {s.lastName}
                          </div>
                          <div className="text-sm text-slate-500">{s.email}</div>
                        </a>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 w-48">
                      <div className="flex items-center gap-2">
                        <Progress value={s.completionScore} className="h-2 flex-1" />
                        <span className="text-sm font-medium w-10">{s.completionScore}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatDate(s.lastActivityAt ?? s.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
