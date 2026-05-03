import { useState } from "react";
import { Link } from "wouter";
import {
  useGetAdvisorDashboard,
  useListStudents,
  useListCountries,
  useListSchools,
} from "@workspace/api-client-react";
import type { StudentSummary } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { CountryFlag } from "@/components/CountryFlag";
import {
  AlertTriangle,
  Clock,
  FileText,
  Calendar,
  Users,
  Search,
  ShieldAlert,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function AdvisorPortfolio() {
  const { t } = useTranslation();
  const { data: dash } = useGetAdvisorDashboard();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [countryId, setCountryId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [risk, setRisk] = useState("");
  const [sortBy, setSortBy] = useState<keyof StudentSummary>("lastActivityAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const params: Record<string, string | number> = {};
  if (status) params.status = status;
  if (countryId) params.countryId = Number(countryId);
  if (schoolId) params.schoolId = Number(schoolId);
  if (risk) params.riskLevel = risk;
  if (q) params.search = q;

  const { data: studentsRaw = [], isLoading } = useListStudents(params);
  const { data: countries = [] } = useListCountries();
  const { data: schools = [] } = useListSchools();

  const students = studentsRaw.slice().sort((a, b) => {
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

  return (
    <div className="space-y-6" data-testid="advisor-portfolio">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t("portfolio.title")}</h1>
        <p className="text-slate-600 mt-1">{t("portfolio.subtitle")}</p>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        <KpiCard
          icon={Users}
          label={t("portfolio.students") ?? "Étudiants"}
          value={dash?.totalStudents ?? 0}
          tone="blue"
        />
        <KpiCard
          icon={Clock}
          label={t("portfolio.late") ?? "En retard"}
          value={dash?.lateStudents ?? 0}
          tone="amber"
        />
        <KpiCard
          icon={ShieldAlert}
          label={t("portfolio.highRisk") ?? "Risque élevé"}
          value={dash?.highRiskStudents ?? 0}
          tone="red"
        />
        <KpiCard
          icon={FileText}
          label={t("portfolio.docsToValidate") ?? "Docs à valider"}
          value={dash?.documentsAwaitingReview ?? 0}
          tone="indigo"
        />
        <KpiCard
          icon={Calendar}
          label={t("portfolio.todayAppts") ?? "RDV aujourd'hui"}
          value={dash?.todayAppointments ?? 0}
          tone="green"
        />
      </div>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t("common.search") ?? "Rechercher…"}
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="input-search-students"
            />
          </div>
          <Select value={status} onChange={setStatus} testid="select-status">
            <option value="">{t("filter.allStatuses")}</option>
            <option value="prospect">{t("status.prospect")}</option>
            <option value="active">{t("status.active")}</option>
            <option value="blocked">{t("status.blocked")}</option>
            <option value="submitted">{t("status.submitted")}</option>
            <option value="visa_obtained">{t("status.visa_obtained")}</option>
            <option value="visa_refused">{t("status.visa_refused")}</option>
          </Select>
          <Select value={countryId} onChange={setCountryId} testid="select-country">
            <option value="">{t("filter.allCountries")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={schoolId} onChange={setSchoolId} testid="select-school">
            <option value="">{t("filter.allSchools")}</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={risk} onChange={setRisk} testid="select-risk">
            <option value="">{t("filter.allRisks")}</option>
            <option value="low">{t("filter.riskLow")}</option>
            <option value="medium">{t("filter.riskMedium")}</option>
            <option value="high">{t("filter.riskHigh")}</option>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {students.length > 1
              ? t("dash.nStudentsPlural", { n: students.length })
              : t("dash.nStudents", { n: students.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">{t("dash.loading")}</div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              {t("portfolio.noMatch")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <Th onClick={() => toggleSort("lastName")}>{t("table.student")}</Th>
                    <Th>{t("table.country")}</Th>
                    <Th>{t("table.school")}</Th>
                    <Th>{t("table.step")}</Th>
                    <Th onClick={() => toggleSort("completionScore")}>{t("table.progress")}</Th>
                    <Th>{t("table.risk")}</Th>
                    <Th onClick={() => toggleSort("lastActivityAt")}>{t("table.activity")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b hover:bg-slate-50"
                      data-testid={`row-student-${s.id}`}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/advisor/students/${s.id}`}>
                          <a className="block" data-testid={`link-student-${s.id}`}>
                            <div className="font-medium text-slate-900">
                              {s.firstName} {s.lastName}
                            </div>
                            <div className="text-xs text-slate-500">{s.email}</div>
                            <div className="mt-1">
                              <StatusBadge status={s.status} />
                            </div>
                          </a>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <CountryFlag
                          code={
                            countries.find(
                              (c) => c.id === s.countryId,
                            )?.code
                          }
                          name={s.countryName}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.schoolName ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">
                        {s.currentStepName ?? "—"}
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
                        <RiskBadge
                          level={s.riskLevel ?? null}
                          narrative={(s as { riskNarrative?: string | null }).riskNarrative ?? null}
                          t={t}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(s.lastActivityAt)}
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

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: "blue" | "red" | "green" | "amber" | "indigo";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    red: "bg-rose-100 text-rose-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-600">{label}</div>
      </CardContent>
    </Card>
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

function RiskBadge({
  level,
  narrative,
  t,
}: {
  level: string | null;
  narrative?: string | null;
  t: (key: string) => string;
}) {
  if (!level) return <span className="text-slate-400 text-xs">—</span>;
  const styles: Record<string, string> = {
    low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    high: "bg-rose-100 text-rose-700 border-rose-200",
  };
  const labels: Record<string, string> = {
    low: t("risk.low"),
    medium: t("risk.medium"),
    high: t("risk.high"),
  };
  const tooltip = narrative ? narrative : t("risk.noExplanation");
  return (
    <span title={tooltip} data-testid={narrative ? "risk-narrative-tooltip" : undefined}>
      <Badge variant="outline" className={`${styles[level] ?? ""}`}>
        {level === "high" && <AlertTriangle className="w-3 h-3 mr-1" />}
        {labels[level] ?? level}
      </Badge>
    </span>
  );
}
