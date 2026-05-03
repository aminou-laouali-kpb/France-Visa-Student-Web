import { useState } from "react";
import {
  useListWorkflowTemplates,
  useListWorkflowTemplateSteps,
  useCreateWorkflowStep,
  useUpdateWorkflowStep,
} from "@workspace/api-client-react";
import type { WorkflowTemplate, WorkflowTemplateStep } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Plus, Building2 } from "lucide-react";

export function AdminWorkflow() {
  const { data: templatesRaw = [] } = useListWorkflowTemplates();
  const templates = templatesRaw as unknown as WorkflowTemplate[];
  const [templateId, setTemplateId] = useState<number | null>(null);
  const activeId = templateId ?? templates[0]?.id ?? null;

  return (
    <div className="space-y-6" data-testid="admin-workflow">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Configuration du parcours</h1>
        <p className="text-slate-600 mt-1">Modèles d'étapes et activation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modèles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {templates.length === 0 && (
            <span className="text-sm text-slate-500">
              Aucun modèle de parcours.
            </span>
          )}
          {templates.map((t) => (
            <Button
              key={t.id}
              variant={activeId === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTemplateId(t.id)}
              data-testid={`button-template-${t.id}`}
            >
              {t.name}
              {t.isDefault && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  Défaut
                </Badge>
              )}
            </Button>
          ))}
        </CardContent>
      </Card>

      {activeId && <WorkflowSteps templateId={activeId} />}
    </div>
  );
}

function WorkflowSteps({ templateId }: { templateId: number }) {
  const { data: stepsRaw = [], refetch } = useListWorkflowTemplateSteps(templateId);
  const steps = (stepsRaw as unknown as WorkflowTemplateStep[])
    .slice()
    .sort((a, b) => a.order - b.order);
  const update = useUpdateWorkflowStep();
  const create = useCreateWorkflowStep();

  const [newName, setNewName] = useState("");

  const toggleActive = async (s: WorkflowTemplateStep) => {
    await update.mutateAsync({
      stepId: s.id,
      data: { isActive: !s.isActive } as never,
    });
    refetch();
  };

  const toggleCampusFrance = async (s: WorkflowTemplateStep) => {
    await update.mutateAsync({
      stepId: s.id,
      data: { isCampusFranceStep: !s.isCampusFranceStep } as never,
    });
    refetch();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = steps[idx + dir];
    const me = steps[idx];
    if (!target || !me) return;
    await Promise.all([
      update.mutateAsync({ stepId: me.id, data: { order: target.order } as never }),
      update.mutateAsync({ stepId: target.id, data: { order: me.order } as never }),
    ]);
    refetch();
  };

  const addStep = async () => {
    if (!newName.trim()) return;
    const order = (steps[steps.length - 1]?.order ?? 0) + 1;
    await create.mutateAsync({
      templateId,
      data: { name: newName.trim(), order } as never,
    });
    setNewName("");
    refetch();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Étapes ({steps.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                s.isActive ? "bg-white" : "bg-slate-50 opacity-60"
              }`}
              data-testid={`workflow-step-${s.id}`}
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center shrink-0">
                {s.order}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 flex items-center gap-2">
                  {s.name}
                  {s.isCampusFranceStep && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                    >
                      <Building2 className="w-3 h-3 mr-1" />
                      Campus France
                    </Badge>
                  )}
                  {s.isRequired && (
                    <Badge variant="outline" className="text-[10px]">
                      Obligatoire
                    </Badge>
                  )}
                </div>
                {s.description && (
                  <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  data-testid={`button-up-${s.id}`}
                  aria-label="Monter"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  data-testid={`button-down-${s.id}`}
                  aria-label="Descendre"
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleCampusFrance(s)}
                  data-testid={`button-toggle-cf-${s.id}`}
                >
                  Campus France
                </Button>
                <Button
                  size="sm"
                  variant={s.isActive ? "default" : "outline"}
                  onClick={() => toggleActive(s)}
                  data-testid={`button-toggle-active-${s.id}`}
                >
                  {s.isActive ? "Active" : "Inactive"}
                </Button>
              </div>
            </div>
          ))}
          {steps.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-500">
              Aucune étape pour ce modèle.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter une étape</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input
            placeholder="Nom de l'étape"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            data-testid="input-new-step"
          />
          <Button onClick={addStep} data-testid="button-add-step">
            <Plus className="w-4 h-4 mr-1" /> Ajouter
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
