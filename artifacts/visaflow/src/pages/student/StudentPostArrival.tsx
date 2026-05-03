import { useQueryClient } from "@tanstack/react-query";
import {
  useListPostArrivalSteps,
  useUpdatePostArrivalStep,
} from "@workspace/api-client-react";
import type { PostArrivalStep } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Plane,
  CheckCircle2,
  Circle,
  Clock,
  HeartPulse,
  Banknote,
  ShieldCheck,
  Landmark,
  RefreshCw,
} from "lucide-react";
import { StudentGate, useMyStudent } from "./StudentLayout";
import { useTranslation } from "react-i18next";

const ICONS: Record<string, typeof Plane> = {
  anef_validation: ShieldCheck,
  ofii_medical: HeartPulse,
  caf: Banknote,
  secu_etudiante: ShieldCheck,
  bank: Landmark,
  titre_renewal: RefreshCw,
};

export function StudentPostArrival() {
  return (
    <StudentGate>
      <Inner />
    </StudentGate>
  );
}

function Inner() {
  const { t } = useTranslation();
  const { student } = useMyStudent();
  const studentId = student!.id;
  const { data, isLoading } = useListPostArrivalSteps(studentId);
  const steps = ((data ?? []) as unknown as PostArrivalStep[]).slice().sort(
    (a, b) => a.order - b.order,
  );

  if (isLoading) return <div className="p-8">{t("dash.loading")}</div>;

  const arrival = student?.arrivalDate;
  const expiry = student?.titreExpiryDate;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Plane className="w-7 h-7 text-blue-600" /> {t("postArrival.title")}
        </h1>
        <p className="text-slate-600 mt-1">
          {t("postArrival.subtitle")}
        </p>
      </div>

      {(arrival || expiry) && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-6 text-sm">
            {arrival && (
              <div>
                <div className="text-xs text-slate-500">{t("postArrival.arrivalDate")}</div>
                <div className="font-medium text-slate-900">
                  {new Date(arrival).toLocaleDateString()}
                </div>
              </div>
            )}
            {expiry && (
              <div>
                <div className="text-xs text-slate-500">
                  {t("postArrival.titreExpiry")}
                </div>
                <div className="font-medium text-slate-900">
                  {new Date(expiry).toLocaleDateString()}
                </div>
              </div>
            )}
            {student?.visaType && (
              <div>
                <div className="text-xs text-slate-500">{t("postArrival.visaType")}</div>
                <div className="font-medium text-slate-900 uppercase">
                  {student.visaType.replace("_", "-")}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {steps.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <Plane className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            {t("postArrival.noSteps")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {steps.map((s) => (
            <PostArrivalCard key={s.id} step={s} studentId={studentId} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostArrivalCard({
  step,
  studentId,
}: {
  step: PostArrivalStep;
  studentId: number;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[step.code] ?? Circle;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState(step.notes ?? "");
  const [editing, setEditing] = useState(false);
  const updateMut = useUpdatePostArrivalStep({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries();
        toast({ title: t("postArrival.updated") });
      },
    },
  });
  const isDone = step.status === "validated";
  const due = step.dueDate ? new Date(step.dueDate) : null;
  const overdue =
    due && !isDone && due.getTime() < Date.now() - 24 * 3600 * 1000;

  return (
    <Card data-testid={`post-arrival-${step.code}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isDone
                ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
          </div>
          <span className="flex-1">{step.label}</span>
          <StatusBadge status={step.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {step.description && (
          <p className="text-sm text-slate-600">{step.description}</p>
        )}
        {due && (
          <div
            className={`text-xs flex items-center gap-1 ${overdue ? "text-rose-600 font-medium" : "text-slate-500"}`}
          >
            <Clock className="w-3.5 h-3.5" />
            {t("postArrival.dueBy", { date: due.toLocaleDateString() })}
            {overdue && " " + t("postArrival.overdue")}
          </div>
        )}
        {editing ? (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("postArrival.notesPh")}
            rows={3}
            data-testid={`post-arrival-notes-${step.code}`}
          />
        ) : (
          step.notes && (
            <div className="text-sm text-slate-700 bg-slate-50 rounded p-2 whitespace-pre-wrap">
              {step.notes}
            </div>
          )
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {!isDone && (
            <Button
              size="sm"
              data-testid={`post-arrival-done-${step.code}`}
              onClick={() =>
                updateMut.mutate({
                  studentId,
                  stepId: step.id,
                  data: { status: "validated" },
                })
              }
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> {t("postArrival.markDone")}
            </Button>
          )}
          {!isDone && step.status === "not_started" && (
            <Button
              size="sm"
              variant="outline"
              data-testid={`post-arrival-start-${step.code}`}
              onClick={() =>
                updateMut.mutate({
                  studentId,
                  stepId: step.id,
                  data: { status: "in_progress" },
                })
              }
            >
              {t("postArrival.start")}
            </Button>
          )}
          {editing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateMut.mutate({
                    studentId,
                    stepId: step.id,
                    data: { notes },
                  });
                  setEditing(false);
                }}
              >
                {t("postArrival.saveNotes")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNotes(step.notes ?? "");
                  setEditing(false);
                }}
              >
                {t("postArrival.cancel")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              data-testid={`post-arrival-edit-${step.code}`}
            >
              {step.notes ? t("postArrival.editNote") : t("postArrival.addNote")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
