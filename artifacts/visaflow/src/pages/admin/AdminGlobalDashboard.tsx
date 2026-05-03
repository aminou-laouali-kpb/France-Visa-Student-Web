import { useGetAdminDashboard } from "@workspace/api-client-react";
import type { AdminDashboardData, AuditLog, CountStat } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, Plane, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

export function AdminGlobalDashboard() {
  const { data: raw, isLoading } = useGetAdminDashboard();
  const data = raw as unknown as AdminDashboardData | undefined;

  if (isLoading) return <div className="p-8">Chargement…</div>;

  const successRate =
    (data?.studentsWithVisa ?? 0) > 0
      ? Math.round(
          ((data?.studentsWithVisa ?? 0) /
            Math.max(1, (data?.studentsWithVisa ?? 0) + (data?.visaRefused ?? 0))) *
            100,
        )
      : 0;

  return (
    <div className="space-y-6" data-testid="admin-global-dashboard">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Centre de pilotage</h1>
        <p className="text-slate-600 mt-1">Vue globale de la plateforme</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Kpi
          icon={GraduationCap}
          label="Étudiants"
          value={data?.totalStudents ?? data?.studentCount ?? 0}
          tone="blue"
        />
        <Kpi
          icon={Users}
          label="Conseillers actifs"
          value={data?.totalAdvisors ?? 0}
          tone="indigo"
        />
        <Kpi
          icon={Plane}
          label="Taux de réussite visa"
          value={`${successRate}%`}
          tone="green"
        />
        <Kpi
          icon={ShieldAlert}
          label="Risque élevé"
          value={data?.highRiskCount ?? 0}
          tone="red"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ChartCard title="Étudiants par pays">
          <BarChartView data={data?.byCountry ?? []} />
        </ChartCard>
        <ChartCard title="Étudiants par école">
          <BarChartView data={data?.bySchool ?? []} />
        </ChartCard>
        <ChartCard title="Distribution par étape">
          <BarChartView data={data?.byStep ?? []} color="#8b5cf6" />
        </ChartCard>
        <ChartCard title="Tendance d'admission">
          <LineChartView data={data?.byIntakeMonth ?? []} />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité récente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {(data?.recentAuditLogs ?? data?.recentActivity ?? []).slice(0, 12).map((log: AuditLog) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-2 text-sm border-b last:border-0"
            >
              <div>
                <span className="font-medium">{log.action}</span>{" "}
                <span className="text-slate-500">sur {log.entityType}</span>
              </div>
              <div className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</div>
            </div>
          ))}
          {(data?.recentAuditLogs ?? data?.recentActivity ?? []).length === 0 && (
            <div className="text-center text-slate-500 py-6 text-sm">
              Aucune activité récente.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  tone: "blue" | "red" | "green" | "indigo";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    red: "bg-rose-100 text-rose-700",
    green: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-600">{label}</div>
      </CardContent>
    </Card>
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

function BarChartView({ data, color = "#2563eb" }: { data: CountStat[]; color?: string }) {
  if (data.length === 0)
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-slate-500">
        Pas encore de données.
      </div>
    );
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ data }: { data: CountStat[] }) {
  if (data.length === 0)
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-slate-500">
        Pas encore de données.
      </div>
    );
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
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
  );
}
