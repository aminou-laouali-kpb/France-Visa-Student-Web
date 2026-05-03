import { useState } from "react";
import { Link } from "wouter";
import {
  useListStudents,
  useListUsers,
  useAssignStudent,
} from "@workspace/api-client-react";
import type { StudentSummary, UserRow } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { Search } from "lucide-react";

export function AdminStudents() {
  const [q, setQ] = useState("");
  const { data: studentsRaw = [], refetch } = useListStudents(q ? { search: q } : {});
  const { data: usersRaw = [] } = useListUsers({});
  const assign = useAssignStudent();

  const students = studentsRaw as unknown as StudentSummary[];
  const users = usersRaw as unknown as UserRow[];
  const advisors = users.filter((u) => u.role === "advisor" && u.isActive);
  const reviewers = users.filter((u) => u.role === "reviewer" && u.isActive);

  const setAdvisor = async (studentId: number, advisorId: number | null) => {
    await assign.mutateAsync({
      studentId,
      data: { advisorId } as never,
    });
    refetch();
  };

  const setReviewer = async (studentId: number, reviewerId: number | null) => {
    await assign.mutateAsync({
      studentId,
      data: { reviewerId } as never,
    });
    refetch();
  };

  return (
    <div className="space-y-6" data-testid="admin-students">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tous les étudiants</h1>
        <p className="text-slate-600 mt-1">Affecter conseillers et relecteurs</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher par nom ou email…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Étudiant</th>
                  <th className="text-left px-4 py-3 font-medium">Statut</th>
                  <th className="text-left px-4 py-3 font-medium">Progression</th>
                  <th className="text-left px-4 py-3 font-medium">Conseiller</th>
                  <th className="text-left px-4 py-3 font-medium">Relecteur</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b hover:bg-slate-50"
                    data-testid={`row-admin-student-${s.id}`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/advisor/students/${s.id}`}>
                        <a className="block">
                          <div className="font-medium">
                            {s.firstName} {s.lastName}
                          </div>
                          <div className="text-xs text-slate-500">{s.email}</div>
                        </a>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 w-44">
                      <div className="flex items-center gap-2">
                        <Progress value={s.completionScore} className="h-2 flex-1" />
                        <span className="font-medium w-9 text-right">
                          {s.completionScore}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="border rounded px-2 py-1 text-sm bg-white"
                        value={s.advisorId ?? ""}
                        onChange={(e) =>
                          setAdvisor(s.id, e.target.value ? Number(e.target.value) : null)
                        }
                        data-testid={`select-advisor-${s.id}`}
                      >
                        <option value="">Non affecté</option>
                        {advisors.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.firstName} {a.lastName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="border rounded px-2 py-1 text-sm bg-white"
                        value={s.reviewerId ?? ""}
                        onChange={(e) =>
                          setReviewer(s.id, e.target.value ? Number(e.target.value) : null)
                        }
                        data-testid={`select-reviewer-${s.id}`}
                      >
                        <option value="">Non affecté</option>
                        {reviewers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.firstName} {r.lastName}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      Aucun étudiant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
