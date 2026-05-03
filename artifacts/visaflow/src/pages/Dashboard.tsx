import { useGetMe, useGetStudentDashboard, useGetAdvisorDashboard, useGetAdminDashboard, useListStudents } from "@workspace/api-client-react";
import type {
  StudentDashboardData,
  Appointment,
  AuditLog,
  StudentSummary,
} from "@/types";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressRing } from "@/components/ProgressRing";
import { formatDateTime, formatDate, ROLE_LABELS } from "@/lib/utils";
import {
  GraduationCap,
  FileText,
  Calendar,
  Bell,
  Users,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Plane,
  ClipboardList,
} from "lucide-react";

export function Dashboard() {
  const { t: tr } = useTranslation();
  const { data: me } = useGetMe();
  const role = me?.role;

  if (!me) return <div className="p-8">Chargement…</div>;

  if (role === "student") return <StudentDashboard />;
  if (["admin", "superadmin"].includes(role!)) return <AdminDashboard />;
  return <AdvisorDashboard />;
}

function StudentDashboard() {
  const { t: tr } = useTranslation();
  const { data: raw, isLoading } = useGetStudentDashboard();
  const data = raw as unknown as StudentDashboardData | undefined;
  if (isLoading) return <div>Chargement…</div>;

  if (!data?.student) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <GraduationCap className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">{tr("dashboard.welcome")}</h2>
          <p className="text-slate-600 mb-6">
            Créons votre dossier visa étudiant pour démarrer votre parcours en France.
          </p>
          <Link href="/app/onboarding">
            <Button size="lg" data-testid="button-create-dossier">
              Créer mon dossier
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{tr("dashboard.myJourney")}</h1>
        <p className="text-slate-600 mt-1">
          {data.completedSteps} sur {data.totalSteps} étapes validées
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-6">
            <ProgressRing value={data.completionScore} label="complété" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sm text-slate-600">Statut du dossier</div>
                <StatusBadge status={data.student.status} />
              </div>
              <div className="text-lg font-semibold text-slate-900">
                {data.completedSteps} / {data.totalSteps} étapes validées
              </div>
              <Progress value={data.completionScore} className="h-2 mt-2" />
              {data.pendingDocuments > 0 && (
                <div className="text-sm text-amber-700 mt-3 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {data.pendingDocuments} document(s) à corriger
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <FileText className="w-6 h-6 text-blue-600 mb-2" />
            <div className="text-2xl font-bold">{data.documentsCount}</div>
            <div className="text-sm text-slate-600">Documents téléversés</div>
            {data.pendingDocuments > 0 && (
              <div className="text-xs text-amber-600 mt-1">
                {data.pendingDocuments} à corriger
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Calendar className="w-6 h-6 text-blue-600 mb-2" />
            <div className="text-2xl font-bold">{data.upcomingAppointments?.length ?? 0}</div>
            <div className="text-sm text-slate-600">Rendez-vous à venir</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Bell className="w-6 h-6 text-blue-600 mb-2" />
            <div className="text-2xl font-bold">{data.unreadNotifications}</div>
            <div className="text-sm text-slate-600">Notifications non lues</div>
          </CardContent>
        </Card>
      </div>

      {data.currentStep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochaine étape</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                {data.currentStep.stepOrder}
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900">{data.currentStep.stepName}</div>
                <StatusBadge status={data.currentStep.status} />
              </div>
              <Link href="/app/dossier">
                <Button variant="outline" size="sm" data-testid="button-view-step">
                  Voir
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {data.upcomingAppointments && data.upcomingAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendez-vous à venir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingAppointments.map((apt: Appointment) => (
              <div
                key={apt.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
              >
                <div>
                  <div className="font-medium">{apt.title}</div>
                  <div className="text-sm text-slate-600">
                    {formatDateTime(apt.scheduledAt)} {apt.location && `· ${apt.location}`}
                  </div>
                </div>
                <StatusBadge status={apt.type} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdvisorDashboard() {
  const { data: me } = useGetMe();
  const { data, isLoading } = useGetAdvisorDashboard();
  const { data: highRiskStudents = [] } = useListStudents({ riskLevel: "high" });
  const explained = (highRiskStudents as unknown as StudentSummary[])
    .filter((s) => s.riskNarrative && s.riskNarrative.trim().length > 0)
    .slice(0, 5);
  if (isLoading) return <div>Chargement…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Bonjour, {me?.firstName} 👋
        </h1>
        <p className="text-slate-600 mt-1">
          Vous suivez actuellement {data?.totalStudents ?? 0} étudiant(s)
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Étudiants à risque"
          value={data?.highRiskStudents ?? 0}
          tone="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label="Dossiers bloqués"
          value={data?.blockedStudents ?? 0}
          tone="red"
        />
        <StatCard
          icon={Plane}
          label="RDV aujourd'hui"
          value={data?.todayAppointments ?? 0}
          tone="green"
        />
        <StatCard
          icon={ClipboardList}
          label="Docs à valider"
          value={data?.documentsAwaitingReview ?? 0}
          tone="amber"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Étudiants à suivre</CardTitle>
          <Link href="/app/students">
            <Button variant="outline" size="sm" data-testid="link-all-students">
              Tous les étudiants
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data?.urgentStudents ?? []).slice(0, 8).map((s) => (
              <Link key={s.id} href={`/app/students/${s.id}`}>
                <a className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <div>
                    <div className="font-medium">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="text-sm text-slate-500">{s.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">{s.completionScore}%</div>
                      <Progress value={s.completionScore} className="w-20 h-1.5" />
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                </a>
              </Link>
            ))}
            {(!data?.urgentStudents || data.urgentStudents.length === 0) && (
              <div className="text-center text-slate-500 py-8">
                Aucun étudiant à suivre
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {explained.length > 0 && (
        <Card data-testid="card-risk-narratives">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Risques expliqués par l'IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {explained.map((s) => (
                <Link key={s.id} href={`/app/students/${s.id}`}>
                  <a className="block p-3 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-slate-900">
                        {s.firstName} {s.lastName}
                      </div>
                      <span className="text-xs uppercase tracking-wide font-semibold text-red-600">
                        Risque élevé
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {s.riskNarrative}
                    </p>
                  </a>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdminDashboard() {
  const { t: tr } = useTranslation();
  const { data, isLoading } = useGetAdminDashboard();
  if (isLoading) return <div>Chargement…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{tr("dashboard.controlCenter")}</h1>
        <p className="text-slate-600 mt-1">Vue globale de la plateforme</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Conseillers actifs" value={data?.totalAdvisors ?? 0} tone="blue" />
        <StatCard
          icon={GraduationCap}
          label="Étudiants"
          value={data?.totalStudents ?? 0}
          tone="indigo"
        />
        <StatCard
          icon={FileText}
          label="Score moyen"
          value={data?.avgCompletionScore ?? 0}
          tone="purple"
        />
        <StatCard icon={Plane} label="Visas obtenus" value={data?.studentsWithVisa ?? 0} tone="green" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des dossiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="En cours" value={data?.studentsInProgress ?? 0} />
            <Row label="Bloqués" value={data?.studentsBlocked ?? 0} />
            <Row label="Visas obtenus" value={data?.studentsWithVisa ?? 0} />
            <Row label="Visas refusés" value={data?.visaRefused ?? 0} />
            <Row label="Risque élevé" value={data?.highRiskCount ?? 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Étudiants par étape</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.byStep ?? []).slice(0, 6).map((s) => (
              <Row key={s.label} label={s.label} value={s.count} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité récente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recentAuditLogs ?? []).slice(0, 10).map((log: AuditLog) => (
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
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600 text-sm">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: "blue" | "red" | "green" | "amber" | "indigo" | "purple";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    red: "bg-rose-100 text-rose-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
    purple: "bg-purple-100 text-purple-700",
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
