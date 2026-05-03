import { useGetPortfolioStats } from "@workspace/api-client-react";
import type { PortfolioStatsData, CountStat } from "@/types";
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
  LineChart,
  Line,
} from "recharts";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export function AdvisorReports() {
  const { data: rawStats, isLoading } = useGetPortfolioStats();
  const stats = rawStats as unknown as PortfolioStatsData | undefined;

  if (isLoading) return <div className="p-8">Chargement…</div>;

  const byStatus = stats?.byStatus ?? [];
  const byCountry = stats?.byCountry ?? [];
  const byRisk = stats?.byRiskLevel ?? [];
  const byMonth = stats?.byIntakeMonth ?? [];

  return (
    <div className="space-y-6" data-testid="advisor-reports">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Statistiques du portefeuille</h1>
        <p className="text-slate-600 mt-1">Indicateurs clés de votre activité</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ChartCard title="Étudiants par statut">
          {byStatus.length === 0 ? (
            <Empty />
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

        <ChartCard title="Étudiants par pays">
          {byCountry.length === 0 ? (
            <Empty />
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

        <ChartCard title="Niveau de risque">
          {byRisk.length === 0 ? (
            <Empty />
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

        <ChartCard title="Tendance des admissions">
          {byMonth.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Étudiants"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
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

function Empty() {
  return (
    <div className="h-[280px] flex items-center justify-center text-sm text-slate-500">
      Pas encore de données.
    </div>
  );
}
