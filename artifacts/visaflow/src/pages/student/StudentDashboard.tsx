import { Link, Redirect } from "wouter";
import {
  useGetMe,
  useGetStudentDashboard,
  useGetStudentRiskScore,
  useListDocuments,
  useListStudentSteps,
} from "@workspace/api-client-react";
import type { StudentDashboardData, Document, Step, Comment } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/ProgressRing";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import { StudentIntakeCalendarWidget } from "@/components/StudentIntakeCalendarWidget";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  GraduationCap,
  ListChecks,
  MapPin,
  MessageSquare,
  Plane,
  Stamp,
  ShieldAlert,
} from "lucide-react";
import type { Appointment, PostArrivalStep } from "@/types";
import { useTranslation } from "react-i18next";

export function StudentDashboard() {
  const { t } = useTranslation();
  const { data: me } = useGetMe();
  const { data: raw, isLoading } = useGetStudentDashboard();
  const data = raw as unknown as StudentDashboardData | undefined;

  const studentId = data?.student?.id ?? 0;
  const { data: docsRaw } = useListDocuments(
    studentId,
    {},
    { query: { enabled: !!studentId, queryKey: ["docs", studentId] } },
  );
  const { data: stepsRaw } = useListStudentSteps(studentId, {
    query: { enabled: !!studentId, queryKey: ["steps", studentId] },
  });
  const { data: riskScore } = useGetStudentRiskScore(studentId, {
    query: { enabled: !!studentId, retry: false, queryKey: ["risk", studentId] },
  });

  if (me && me.role !== "student") return <Redirect to="/app" />;
  if (isLoading) return <div className="p-8">{t("dash.loading")}</div>;

  if (!data?.student) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <GraduationCap className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("dashboard.welcome")}
          </h2>
          <p className="text-slate-600 mb-6">{t("dash.studentWelcome")}</p>
          <Link href="/app/onboarding">
            <Button size="lg" data-testid="button-create-dossier">
              {t("dash.createDossier")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const docs = (docsRaw ?? []) as Document[];
  const steps = (stepsRaw ?? []) as Step[];
  const rejectedDocs = docs.filter((d) => d.status === "rejected");
  const blockedSteps = steps.filter((s) => s.status === "blocked");
  const nextStep =
    data.currentStep ??
    steps.find((s) => s.status === "in_progress") ??
    steps.find((s) => s.status === "pending");

  const apiActions = data.nextActions ?? [];
  const derivedActions: {
    label: string;
    href: string;
    icon: typeof FileText;
  }[] = [];
  if (rejectedDocs.length > 0) {
    derivedActions.push({
      label: t("dash.docsToCorrect", { n: rejectedDocs.length }),
      href: "/student/documents",
      icon: AlertTriangle,
    });
  }
  if (blockedSteps.length > 0) {
    derivedActions.push({
      label: t("dash.unblockSteps", { n: blockedSteps.length }),
      href: "/student/steps",
      icon: ListChecks,
    });
  }
  if (nextStep) {
    derivedActions.push({
      label: t("dash.advanceStep", { name: nextStep.stepName }),
      href: "/student/steps",
      icon: ArrowRight,
    });
  }
  if ((data.upcomingAppointments?.length ?? 0) > 0) {
    derivedActions.push({
      label: t("dash.prepareAppts", { n: data.upcomingAppointments!.length }),
      href: "/student/appointments",
      icon: Calendar,
    });
  }

  const advisorComments = (data.recentComments ?? []).filter(
    (c: Comment) => !c.isInternal && c.authorRole !== "student",
  );

  return (
    <div className="space-y-6" data-testid="student-dashboard">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {t("dashboard.myJourney")}
        </h1>
        <p className="text-slate-600 mt-1">
          {t("dash.stepsValidated", {
            completed: data.completedSteps,
            total: data.totalSteps,
          })}
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-6">
            <ProgressRing
              value={data.completionScore}
              label={t("dash.completed")}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sm text-slate-600">
                  {t("dash.dossierStatus")}
                </div>
                <StatusBadge status={data.student.status} />
              </div>
              <div className="text-lg font-semibold text-slate-900">
                {data.completedSteps} / {data.totalSteps}{" "}
                {t("dash.stepsCompleted")}
              </div>
              <Progress value={data.completionScore} className="h-2 mt-2" />
              {data.pendingDocuments > 0 && (
                <div className="text-sm text-amber-700 mt-3 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {t("dash.docsToCorrect", { n: data.pendingDocuments })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-visa-preparation">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            {t("dash.visaPreparation")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <ProgressRing
              value={data.completionScore}
              label={t("dash.visaPrepCompletion")}
            />
            <div className="flex-1 min-w-[12rem]">
              <div className="text-sm text-slate-600">
                {t("dash.visaPrepCompletion")}
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {data.completionScore}%
              </div>
              <Progress value={data.completionScore} className="h-2 mt-2" />
              {riskScore?.level && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    {t("dash.visaPrepRisk")}
                  </span>
                  <StatusBadge status={riskScore.level} />
                </div>
              )}
            </div>
          </div>
          {(riskScore?.recommendations?.length ?? 0) > 0 ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {t("dash.visaPrepActions")}
              </div>
              <ul className="space-y-2">
                {(riskScore?.recommendations ?? [])
                  .slice(0, 3)
                  .map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 text-sm text-slate-800"
                      data-testid={`visa-prep-action-${i}`}
                    >
                      <ArrowRight className="w-4 h-4 mt-0.5 text-indigo-600 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {t("dash.visaPrepOnTrack")}
            </div>
          )}
          <Link href="/student/steps">
            <a
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
              data-testid="link-visa-prep-steps"
            >
              {t("dash.visaPrepSeeSteps")}
              <ArrowRight className="w-3 h-3" />
            </a>
          </Link>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card data-testid="card-next-actions">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-blue-600" />
              {t("dash.nextActions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {apiActions.length === 0 && derivedActions.length === 0 ? (
              <div className="text-sm text-slate-500 flex items-center gap-2 py-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {t("dash.allUpToDate")}
              </div>
            ) : (
              <>
                {apiActions.map((action, i) => (
                  <div
                    key={`api-${i}`}
                    className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 text-sm text-slate-800"
                    data-testid={`next-action-api-${i}`}
                  >
                    <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                    <span>{action}</span>
                  </div>
                ))}
                {derivedActions.map((a, i) => (
                  <Link key={`derived-${i}`} href={a.href}>
                    <a
                      className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-sm text-slate-800 transition-colors"
                      data-testid={`next-action-${i}`}
                    >
                      <a.icon className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="flex-1">{a.label}</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </a>
                  </Link>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-advisor-comments">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              {t("dash.advisorComments")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {advisorComments.length === 0 ? (
              <div className="text-sm text-slate-500 py-4">
                {t("dash.noComments")}
              </div>
            ) : (
              advisorComments.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-lg border border-slate-200 bg-white"
                  data-testid={`advisor-comment-${c.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium text-slate-900">
                      {c.authorName}
                      <span className="ml-1 text-xs text-slate-500 font-normal">
                        ·{" "}
                        {t(`role.${c.authorRole}`, {
                          defaultValue: c.authorRole,
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(c.createdAt)}
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {c.content}
                  </div>
                </div>
              ))
            )}
            <Link href="/student/messages">
              <a
                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                data-testid="link-all-messages"
              >
                {t("dash.seeAllMessages")}
                <ArrowRight className="w-3 h-3" />
              </a>
            </Link>
          </CardContent>
        </Card>
      </div>

      {nextStep && (
        <Card data-testid="card-current-step">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-blue-600" />
              {t("dash.currentStep")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold shrink-0">
                {nextStep.stepOrder}
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900">
                  {nextStep.stepName}
                </div>
                <div className="mt-1">
                  <StatusBadge status={nextStep.status} />
                </div>
                {nextStep.blockedReason && (
                  <div className="text-sm text-rose-700 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {nextStep.blockedReason}
                  </div>
                )}
                {nextStep.notes && (
                  <div className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                    {nextStep.notes}
                  </div>
                )}
              </div>
              <Link href="/student/steps">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-view-step"
                >
                  {t("dash.seeStep")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <StudentIntakeCalendarWidget />

      <Card data-testid="card-upcoming-appointments">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            {t("dash.upcomingAppts")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data.upcomingAppointments ?? []).length === 0 ? (
            <div className="text-sm text-slate-500 py-4">
              {t("dash.noAppts")}
            </div>
          ) : (
            (data.upcomingAppointments as Appointment[]).map((apt) => {
              const Icon =
                apt.type === "campus_france"
                  ? Building2
                  : apt.type === "tls" ||
                      apt.type === "vfs" ||
                      apt.type === "tls_vfs"
                    ? Stamp
                    : Calendar;
              return (
                <div
                  key={apt.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50"
                  data-testid={`appointment-${apt.id}`}
                >
                  <Icon className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900">
                      {apt.title}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {formatDateTime(apt.scheduledAt)}
                    </div>
                    {apt.location && (
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {apt.location}
                      </div>
                    )}
                  </div>
                  {apt.status && <StatusBadge status={apt.status} />}
                </div>
              );
            })
          )}
          <Link href="/student/appointments">
            <a
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
              data-testid="link-all-appointments"
            >
              {t("dash.seeAllAppts")}
              <ArrowRight className="w-3 h-3" />
            </a>
          </Link>
        </CardContent>
      </Card>

      {(data.postArrivalSteps?.length ?? 0) > 0 && (
        <Card data-testid="card-post-arrival">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plane className="w-4 h-4 text-blue-600" />
              {t("dash.postArrival")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.postArrivalSteps as PostArrivalStep[])
              .slice()
              .sort((a, b) => a.order - b.order)
              .slice(0, 4)
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50"
                  data-testid={`dashboard-post-arrival-${s.code}`}
                >
                  {s.status === "validated" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Plane className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900">{s.label}</div>
                    {s.dueDate && (
                      <div className="text-xs text-slate-600 mt-0.5">
                        {t("postArrival.dueBy", {
                          date: new Date(s.dueDate).toLocaleDateString(),
                        })}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            <Link href="/student/post-arrival">
              <a
                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                data-testid="link-all-post-arrival"
              >
                {t("dash.seeAllSteps")}
                <ArrowRight className="w-3 h-3" />
              </a>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <FileText className="w-6 h-6 text-blue-600 mb-2" />
            <div className="text-2xl font-bold">{data.documentsCount}</div>
            <div className="text-sm text-slate-600">
              {t("dash.uploadsCount")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Calendar className="w-6 h-6 text-blue-600 mb-2" />
            <div className="text-2xl font-bold">
              {data.upcomingAppointments?.length ?? 0}
            </div>
            <div className="text-sm text-slate-600">
              {t("dash.upcomingAppts")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ListChecks className="w-6 h-6 text-blue-600 mb-2" />
            <div className="text-2xl font-bold">{data.completedSteps}</div>
            <div className="text-sm text-slate-600">
              {t("dash.stepsCompleted")}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
