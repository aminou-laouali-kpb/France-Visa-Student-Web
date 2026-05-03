import { useState } from "react";
import { Link } from "wouter";
import {
  useListStudents,
  useListUsers,
  useAssignStudent,
  useListCountries,
  useListSchools,
} from "@workspace/api-client-react";
import type { AssignStudentBody } from "@workspace/api-client-react";
import type { StudentSummary, UserRow, Country, School } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { CountryFlag } from "@/components/CountryFlag";
import { formatDate } from "@/lib/utils";
import { Search, AlertTriangle } from "lucide-react";

export function AdminStudents() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [countryId, setCountryId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [risk, setRisk] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [sortBy, setSortBy] = useState<keyof StudentSummary>("lastActivityAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const params: Record<string, string | number> = {};
  if (q) params.search = q;
  if (status) params.status = status;
  if (countryId) params.countryId = Number(countryId);
  if (schoolId) params.schoolId = Number(schoolId);
  if (risk) params.riskLevel = risk;
  if (advisorFilter === "unassigned") params.advisorId = 0;
  else if (advisorFilter) params.advisorId = Number(advisorFilter);

  const { data: studentsRaw = [], refetch, isLoading } = useListStudents(params);
  const { data: usersRaw = [] } = useListUsers({});
  const { data: countries = [] } = useListCountries();
  const { data: schools = [] } = useListSchools();
  const assign = useAssignStudent();

  const studentsArr = studentsRaw as unknown as StudentSummary[];
  const users = usersRaw as unknown as UserRow[];
  const advisors = users.filter((u) => u.role === "advisor" && u.isActive);
  const reviewers = users.filter((u) => u.role === "reviewer" && u.isActive);

  const students = studentsArr.slice().sort((a, b) => {
    const av = (a[sortBy] ?? "") as string | number;
    const bv = (b[sortBy] ?? "") as string | number;
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (key: keyof StudentSummary) => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const setAdvisor = async (studentId: number, advisorId: number | null) => {
    const data: AssignStudentBody = { advisorId };
    await assign.mutateAsync({ studentId, data });
    refetch();
  };

  const setReviewer = async (studentId: number, reviewerId: number | null) => {
    const data: AssignStudentBody = { reviewerId };
    await assign.mutateAsync({ studentId, data });
    refetch();
  };

  return (
    <div className="space-y-6" data-testid="admin-students">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tous les étudiants</h1>
        <p className="text-slate-600 mt-1">
          Vue transverse sur tous les conseillers, avec affectation
        </p>
      </div>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={status} onChange={setStatus} testid="select-status">
            <option value="">Tous statuts</option>
            <option value="prospect">Prospect</option>
            <option value="active">Actif</option>
            <option value="blocked">Bloqué</option>
            <option value="submitted">Déposé</option>
            <option value="visa_obtained">Visa obtenu</option>
            <option value="visa_refused">Visa refusé</option>
          </Select>
          <Select
            value={countryId}
            onChange={setCountryId}
            testid="select-country"
          >
            <option value="">Tous pays</option>
            {(countries as unknown as Country[]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={schoolId} onChange={setSchoolId} testid="select-school">
            <option value="">Toutes écoles</option>
            {(schools as unknown as School[]).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={risk} onChange={setRisk} testid="select-risk">
            <option value="">Tous risques</option>
            <option value="low">Risque faible</option>
            <option value="medium">Risque moyen</option>
            <option value="high">Risque élevé</option>
          </Select>
          <Select
            value={advisorFilter}
            onChange={setAdvisorFilter}
            testid="select-advisor-filter"
          >
            <option value="">Tous conseillers</option>
            <option value="unassigned">Non affectés</option>
            {advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {students.length} étudiant{students.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Chargement…</div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Aucun étudiant ne correspond à ces filtres.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <Th onClick={() => toggleSort("lastName")}>Étudiant</Th>
                    <Th>Pays</Th>
                    <Th>École</Th>
                    <Th>Étape</Th>
                    <Th onClick={() => toggleSort("completionScore")}>
                      Progression
                    </Th>
                    <Th>Risque</Th>
                    <Th onClick={() => toggleSort("lastActivityAt")}>
                      Activité
                    </Th>
                    <Th>Conseiller</Th>
                    <Th>Relecteur</Th>
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
                          <a
                            className="block"
                            data-testid={`link-student-${s.id}`}
                          >
                            <div className="font-medium text-slate-900">
                              {s.firstName} {s.lastName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {s.email}
                            </div>
                            <div className="mt-1">
                              <StatusBadge status={s.status} />
                            </div>
                          </a>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <CountryFlag
                          code={
                            (countries as unknown as Country[]).find(
                              (c) => c.id === s.countryId,
                            )?.code
                          }
                          name={s.countryName}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {s.schoolName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                        {s.currentStepName ?? "—"}
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={s.completionScore}
                            className="h-2 flex-1"
                          />
                          <span className="font-medium w-9 text-right">
                            {s.completionScore}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RiskBadge level={s.riskLevel ?? null} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(s.lastActivityAt)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="border rounded px-2 py-1 text-sm bg-white"
                          value={s.advisorId ?? ""}
                          onChange={(e) =>
                            setAdvisor(
                              s.id,
                              e.target.value ? Number(e.target.value) : null,
                            )
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
                            setReviewer(
                              s.id,
                              e.target.value ? Number(e.target.value) : null,
                            )
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
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Select({
  value,
  onChange,
  testid,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <select
      className="border rounded-lg px-3 py-2 text-sm bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testid}
    >
      {children}
    </select>
  );
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th
      className={`text-left px-4 py-3 font-medium ${
        onClick ? "cursor-pointer hover:text-slate-700" : ""
      }`}
      onClick={onClick}
    >
      {children}
    </th>
  );
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-slate-400 text-xs">—</span>;
  const styles: Record<string, string> = {
    low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    high: "bg-rose-100 text-rose-700 border-rose-200",
  };
  const labels: Record<string, string> = {
    low: "Faible",
    medium: "Moyen",
    high: "Élevé",
  };
  return (
    <Badge variant="outline" className={`${styles[level] ?? ""}`}>
      {level === "high" && <AlertTriangle className="w-3 h-3 mr-1" />}
      {labels[level] ?? level}
    </Badge>
  );
}
