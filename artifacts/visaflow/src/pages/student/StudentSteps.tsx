import { useState } from "react";
import { Link } from "wouter";
import {
  useListStudentSteps,
  useGetStepChecklist,
  useUpdateChecklistItem,
  useListDocuments,
} from "@workspace/api-client-react";
import type { ChecklistItem } from "@workspace/api-client-react";
import type { Step, Document } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  FileText,
  Sparkles,
} from "lucide-react";
import { StudentGate, useMyStudent } from "./StudentLayout";
import { formatDate } from "@/lib/utils";
import { shouldShowMotivationInterviewCta } from "@/lib/interviewCta";
import { useTranslation } from "react-i18next";

/** Legacy Campus France steps are identified by name, not the isCampusFranceStep flag. */
function isCampusFranceStepLabel(stepName: string): boolean {
  const n = stepName.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return n.includes("campus france") || n.includes("etudes en france");
}

export function StudentSteps() {
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
  const { data: steps = [] } = useListStudentSteps(studentId);
  const { data: docs = [] } = useListDocuments(studentId);
  const list = steps as unknown as Step[];
  const documents = docs as unknown as Document[];
  const [expandedId, setExpandedId] = useState<number | null>(
    list.find((s) => s.status !== "validated")?.id ?? null,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {t("dashboard.myJourney")}
        </h1>
        <p className="text-slate-600 mt-1">{t("steps.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <ol className="relative">
            {list.map((step, idx) => {
              const isCompleted = step.status === "validated";
              const isBlocked =
                step.status === "blocked" || step.status === "rejected";
              const isExpanded = expandedId === step.id;
              const isLast = idx === list.length - 1;
              return (
                <li
                  key={step.id}
                  className="relative pl-14 pr-4 py-4 border-b last:border-b-0"
                  data-testid={`step-${step.id}`}
                >
                  <div className="absolute left-6 top-6 z-10">
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 bg-white" />
                    ) : isBlocked ? (
                      <AlertCircle className="w-6 h-6 text-rose-500 bg-white" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300 bg-white" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`absolute left-[35px] top-12 bottom-0 w-0.5 ${
                        isCompleted ? "bg-emerald-300" : "bg-slate-200"
                      }`}
                    />
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`student-step-checklist-${step.id}`}
                    className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    onClick={() => setExpandedId(isExpanded ? null : step.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedId(isExpanded ? null : step.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">
                            {t("stepDetail.stepN", { n: step.stepOrder })}
                          </span>
                          {isCampusFranceStepLabel(step.stepName) && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              {t("detail.campusFranceStep")}
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-slate-900">
                          {step.stepName}
                        </div>
                        {step.blockedReason && (
                          <div className="text-sm text-rose-600 mt-1">
                            ⚠️ {step.blockedReason}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={step.status} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div
                      id={`student-step-checklist-${step.id}`}
                      className="mt-3 space-y-3"
                    >
                      <StepChecklist studentId={studentId} stepId={step.id} />
                      <StepDocuments
                        documents={documents}
                        stepName={step.stepName}
                      />
                      {step.notes && (
                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                          <strong>{t("stepDetail.advisorNote")}</strong>{" "}
                          {step.notes}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {list.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                {t("stepDetail.noSteps")}
              </div>
            )}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function StepChecklist({
  studentId,
  stepId,
}: {
  studentId: number;
  stepId: number;
}) {
  const { t } = useTranslation();
  const { data: items = [], refetch } = useGetStepChecklist(studentId, stepId);
  const update = useUpdateChecklistItem();
  const list = items as unknown as ChecklistItem[];

  if (list.length === 0) return null;

  const toggle = async (itemId: number, isChecked: boolean) => {
    await update.mutateAsync({ studentId, itemId, data: { isChecked } });
    refetch();
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t("stepDetail.toDo")}
      </div>
      {list.map((it) => (
        <label
          key={it.id}
          className="flex items-start gap-3 text-sm cursor-pointer"
          data-testid={`checklist-${it.id}`}
        >
          <input
            type="checkbox"
            checked={it.isChecked}
            onChange={(e) => toggle(it.id, e.target.checked)}
            className="mt-1"
            data-testid={`checkbox-checklist-${it.id}`}
          />
          <span
            className={
              it.isChecked ? "line-through text-slate-400" : "text-slate-700"
            }
          >
            {it.label}
            {it.isRequired && <span className="text-rose-600 ml-1">*</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function StepDocuments({
  documents,
  stepName,
}: {
  documents: Document[];
  stepName: string;
}) {
  const { t } = useTranslation();
  const lower = stepName.toLowerCase();
  const matched = documents.filter((d) => {
    const cat = d.category.toLowerCase();
    const name = d.name.toLowerCase();
    return (
      lower.includes(cat) ||
      cat.split("_").some((p) => lower.includes(p)) ||
      (name && lower.includes(name))
    );
  });
  if (matched.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t("stepDetail.relatedDocs")}
      </div>
      {matched.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded"
        >
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="flex-1 truncate">{d.name}</span>
          <span className="text-xs text-slate-500">
            v{d.version} · {formatDate(d.uploadedAt)}
          </span>
          <StatusBadge status={d.status} />
        </div>
      ))}
    </div>
  );
}
