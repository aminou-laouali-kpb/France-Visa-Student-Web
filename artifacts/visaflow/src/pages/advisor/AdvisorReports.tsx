import {
  useGetPortfolioStats,
  useListStudents,
} from "@workspace/api-client-react";
import type { CountStat } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const HISTOGRAM_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "0–20%", min: 0, max: 20 },
  { label: "21–40%", min: 21, max: 40 },
  { label: "41–60%", min: 41, max: 60 },
  { label: "61–80%", min: 61, max: 80 },
  { label: "81–100%", min: 81, max: 100 },
];

export function AdvisorReports() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useGetPortfolioStats();
  const { data: students = [] } = useListStudents({});

  if (isLoading) return <div className="p-8">{t("dash.loading")}</div>;

  const byStatus = stats?.byStatus ?? [];
  const byCountry = stats?.byCountry ?? [];
  const byRisk = stats?.byRiskLevel ?? [];
  const byRefusalMotif = stats?.visaRefusedByMotif ?? [];

  const byCompletion: CountStat[] = HISTOGRAM_BUCKETS.map((b) => {
    const count = students.filter(
      (s) => s.completionScore >= b.min && s.completionScore <= b.max,
    ).length;
    return {
      label: b.label,
      count,
      percentage: students.length
        ? Math.round((count / students.length) * 100)
        : 0,
    };
  });

  return (
    <div className="space-y-6" data-testid="advisor-reports">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t("reports.title")}</h1>
        <p className="text-slate-600 mt-1">{t("reports.subtitle")}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ChartCard title={t("reports.byStatus")}>
          {byStatus.length === 0 ? (
            <Empty t={t} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry: CountStat) => entry.label}
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t("reports.byCountry")}>
          {byCountry.length === 0 ? (
            <Empty t={t} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byCountry}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t("reports.byRisk")}>
          {byRisk.length === 0 ? (
            <Empty t={t} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byRisk}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byRisk.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.label === "high"
                          ? "#ef4444"
                          : entry.label === "medium"
                            ? "#f59e0b"
                            : "#10b981"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t("reports.byRefusalMotif")}>
          {byRefusalMotif.length === 0 ? (
            <Empty t={t} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byRefusalMotif}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t("reports.byCompletion")}>
          {students.length === 0 ? (
            <Empty t={t} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byCompletion}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="count"
                  name={t("table.student")}
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ t }: { t: (k: string) => string }) {
  return (
    <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">
      {t("reports.noData")}
    </div>
  );
}
