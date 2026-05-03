import { useState } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@clerk/react";
import type {
  Student,
  Step,
  Document,
  Comment,
  Task,
  Appointment,
  UserRow,
  Country,
  School,
  UploadUrlResponse,
  StudentFormData,
} from "@/types";
import type {
  UpdateStudentStepBody,
  ReviewDocumentBody,
  CreateCommentBody,
  CreateTaskBody,
  UpdateTaskBody,
  CreateAppointmentBody,
  AssignStudentBody,
  UpdateStudentBody,
} from "@workspace/api-client-react";

import {
  useGetStudent,
  useUpdateStudent,
  useListStudentSteps,
  useUpdateStudentStep,
  useGetStepChecklist,
  useUpdateChecklistItem,
  useListDocuments,
  useReviewDocument,
  useListComments,
  useCreateComment,
  useListStudentTasks,
  useCreateTask,
  useUpdateTask,
  useListAppointments,
  useCreateAppointment,
  useGetStudentRiskScore,
  useRecalculateRiskScore,
  useAssignStudent,
  useListUsers,
  useGetMe,
  useListCountries,
  useListSchools,
} from "@workspace/api-client-react";
import type { ChecklistItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatDateTime, ROLE_LABELS } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertCircle,
  FileText,
  MessageSquare,
  CheckSquare,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  UserCog,
} from "lucide-react";

export function StudentDetail() {
  const params = useParams<{ id: string }>();
  const studentId = Number(params.id);
  const { data: studentRaw, refetch } = useGetStudent(studentId);
  const student = studentRaw as unknown as Student | undefined;
  const { data: me } = useGetMe();
  const isStaff = me && ["advisor", "reviewer", "admin", "superadmin"].includes(me.role);

  if (!student) return <div className="p-8">Chargement…</div>;

  return (
    <div className="space-y-6">
      <Link href="/advisor">
        <a className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour à la liste
        </a>
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {student.firstName} {student.lastName}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-600">
            <span>{student.email}</span>
            {student.phone && <span>· {student.phone}</span>}
            <StatusBadge status={student.status} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500">Progression</div>
          <div className="text-3xl font-bold text-blue-700">{student.completionScore}%</div>
          <Progress value={student.completionScore} className="w-32 h-2 mt-1" />
        </div>
      </div>

      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps" data-testid="tab-steps">Parcours</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="comments" data-testid="tab-comments">Messages</TabsTrigger>
          {isStaff && (
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tâches</TabsTrigger>
          )}
          <TabsTrigger value="appointments" data-testid="tab-appointments">Rendez-vous</TabsTrigger>
          {isStaff && (
            <TabsTrigger value="risk" data-testid="tab-risk">Risque</TabsTrigger>
          )}
          <TabsTrigger value="profile" data-testid="tab-profile">Profil</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-4">
          <StepsTab studentId={studentId} canEdit={!!isStaff || me?.id === student.userId} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab studentId={studentId} isStaff={!!isStaff} />
        </TabsContent>
        <TabsContent value="comments" className="mt-4">
          <CommentsTab studentId={studentId} isStaff={!!isStaff} currentUserId={me?.id ?? 0} />
        </TabsContent>
        {isStaff && (
          <TabsContent value="tasks" className="mt-4">
            <TasksTab studentId={studentId} isStaff={!!isStaff} />
          </TabsContent>
        )}
        <TabsContent value="appointments" className="mt-4">
          <AppointmentsTab studentId={studentId} isStaff={!!isStaff} />
        </TabsContent>
        {isStaff && (
          <TabsContent value="risk" className="mt-4">
            <RiskTab studentId={studentId} />
          </TabsContent>
        )}
        <TabsContent value="profile" className="mt-4">
          <ProfileTab studentId={studentId} student={student} isStaff={!!isStaff} onUpdate={refetch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StepsTab({ studentId, canEdit }: { studentId: number; canEdit: boolean }) {
  const { data: steps = [], refetch } = useListStudentSteps(studentId);
  const update = useUpdateStudentStep();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleStatus = async (stepId: number, status: string) => {
    await update.mutateAsync({
      studentId,
      stepId,
      data: { status } as unknown as UpdateStudentStepBody,
    });
    refetch();
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
            {(steps as unknown as Step[]).map((step) => {
            const isCompleted = step.status === "validated";
            const isBlocked = step.status === "blocked" || step.status === "rejected";
            const isExpanded = expandedId === step.id;
            return (
              <div key={step.id} data-testid={`step-${step.id}`}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-controls={`step-checklist-${step.id}`}
                  className="flex items-start gap-4 p-4 hover:bg-slate-50 cursor-pointer focus:outline-none focus:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => setExpandedId(isExpanded ? null : step.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(isExpanded ? null : step.id);
                    }
                  }}
                >
                  <div className="mt-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : isBlocked ? (
                      <AlertCircle className="w-6 h-6 text-rose-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Étape {step.stepOrder}</span>
                      {step.isCampusFranceStep && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          Campus France
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-slate-900">{step.stepName}</div>
                    {step.notes && <div className="text-sm text-slate-600 mt-1">{step.notes}</div>}
                    {step.blockedReason && (
                      <div className="text-sm text-rose-600 mt-1">⚠️ {step.blockedReason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <StatusBadge status={step.status} />
                    {canEdit && !isCompleted && (
                      <select
                        className="text-xs border rounded px-2 py-1"
                        value={step.status}
                        onChange={(e) => handleStatus(step.id, e.target.value)}
                        data-testid={`select-step-status-${step.id}`}
                      >
                        <option value="not_started">À faire</option>
                        <option value="in_progress">En cours</option>
                        <option value="submitted">Soumis</option>
                        <option value="under_review">En revue</option>
                        <option value="blocked">Bloqué</option>
                        <option value="validated">Validé</option>
                        <option value="rejected">Rejeté</option>
                      </select>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div id={`step-checklist-${step.id}`}>
                    <StepChecklist
                      studentId={studentId}
                      stepId={step.id}
                      canEdit={canEdit}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {steps.length === 0 && (
            <div className="p-8 text-center text-slate-500">Aucune étape configurée</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StepChecklist({
  studentId,
  stepId,
  canEdit,
}: {
  studentId: number;
  stepId: number;
  canEdit: boolean;
}) {
  const { data: items = [], refetch } = useGetStepChecklist(studentId, stepId);
  const update = useUpdateChecklistItem();
  const list = items as unknown as ChecklistItem[];

  const toggle = async (itemId: number, isChecked: boolean) => {
    await update.mutateAsync({ studentId, itemId, data: { isChecked } });
    refetch();
  };

  if (list.length === 0) {
    return (
      <div className="px-14 pb-4 text-sm text-slate-500">
        Aucune sous-tâche pour cette étape.
      </div>
    );
  }

  return (
    <div className="px-14 pb-4 space-y-2 bg-slate-50/40">
      {list.map((it) => (
        <label
          key={it.id}
          className="flex items-start gap-3 text-sm cursor-pointer"
          data-testid={`checklist-${it.id}`}
        >
          <input
            type="checkbox"
            checked={it.isChecked}
            disabled={!canEdit}
            onChange={(e) => toggle(it.id, e.target.checked)}
            className="mt-1"
            data-testid={`checkbox-checklist-${it.id}`}
          />
          <span
            className={
              it.isChecked
                ? "line-through text-slate-400"
                : "text-slate-700"
            }
          >
            {it.label}
            {it.isRequired && (
              <span className="text-rose-600 ml-1">*</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

const DOCUMENT_CATEGORIES = [
  { value: "passeport", label: "Passeport" },
  { value: "piece_identite", label: "Pièce d'identité" },
  { value: "diplome", label: "Diplôme" },
  { value: "releve_notes", label: "Relevé de notes" },
  { value: "test_langue", label: "Test de langue" },
  { value: "lettre_admission", label: "Lettre d'admission" },
  { value: "attestation_campus_france", label: "Attestation Campus France" },
  { value: "justificatif_financier", label: "Justificatif financier" },
  { value: "justificatif_hebergement", label: "Justificatif d'hébergement" },
  { value: "assurance", label: "Assurance santé" },
  { value: "billet_avion", label: "Billet d'avion" },
  { value: "autre", label: "Autre" },
];

function DocumentsTab({ studentId, isStaff }: { studentId: number; isStaff: boolean }) {
  const { data: docs = [], refetch } = useListDocuments(studentId);
  const review = useReviewDocument();
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("passeport");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");

  const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

  const handleUpload = async () => {
    if (!file || !name) return;
    setUploading(true);
    try {
      const token = (await getToken()) ?? "";
      const authHeaders = {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      } as const;

      const tokenRes = (await fetch(`${apiBase}/storage/upload-url`, {
        method: "POST",
        credentials: "include",
        headers: authHeaders,
        body: JSON.stringify({
          name: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      }).then((r) => r.json())) as UploadUrlResponse;

      await fetch(tokenRes.uploadURL, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });

      await fetch(`${apiBase}/students/${studentId}/documents`, {
        method: "POST",
        credentials: "include",
        headers: authHeaders,
        body: JSON.stringify({
          category,
          name,
          fileName: file.name,
          objectPath: tokenRes.objectPath,
          uploadToken: tokenRes.uploadToken,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      setFile(null);
      setName("");
      refetch();
    } finally {
      setUploading(false);
    }
  };

  const [rejectDocId, setRejectDocId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [optimisticStatus, setOptimisticStatus] = useState<
    Record<number, { status: string; rejectionReason?: string | null }>
  >({});

  const handleValidate = async (documentId: number) => {
    setOptimisticStatus((s) => ({
      ...s,
      [documentId]: { status: "validated", rejectionReason: null },
    }));
    try {
      const data: ReviewDocumentBody = { decision: "validated", comment: "" };
      await review.mutateAsync({ studentId, documentId, data });
      refetch();
    } catch (err) {
      setOptimisticStatus((s) => {
        const { [documentId]: _, ...rest } = s;
        return rest;
      });
      throw err;
    }
  };

  const submitRejection = async () => {
    if (!rejectDocId || !rejectReason.trim()) return;
    const documentId = rejectDocId;
    const reason = rejectReason.trim();
    setOptimisticStatus((s) => ({
      ...s,
      [documentId]: { status: "rejected", rejectionReason: reason },
    }));
    setRejectDocId(null);
    setRejectReason("");
    try {
      const data: ReviewDocumentBody = { decision: "rejected", comment: reason };
      await review.mutateAsync({ studentId, documentId, data });
      refetch();
    } catch (err) {
      setOptimisticStatus((s) => {
        const { [documentId]: _, ...rest } = s;
        return rest;
      });
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Téléverser un document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Catégorie</Label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="select-doc-category"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Nom du document</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Passeport scan recto-verso"
                data-testid="input-doc-name"
              />
            </div>
          </div>
          <div>
            <Label>Fichier</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              data-testid="input-doc-file"
            />
          </div>
          <Button onClick={handleUpload} disabled={!file || !name || uploading} data-testid="button-upload">
            {uploading ? "Téléversement…" : "Téléverser"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {(docs as unknown as Document[]).map((d) => {
              const o = optimisticStatus[d.id];
              const status = o?.status ?? d.status;
              const rejectionReason = o
                ? o.rejectionReason ?? null
                : d.rejectionReason;
              const canReview =
                isStaff && (status === "received" || status === "under_review");
              return (
                <div key={d.id} className="flex items-center gap-4 p-4">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-sm text-slate-500">
                      {DOCUMENT_CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category} ·
                      v{d.version} · {formatDate(d.uploadedAt)}
                    </div>
                    {rejectionReason && (
                      <div className="text-sm text-rose-600 mt-1">⚠️ {rejectionReason}</div>
                    )}
                  </div>
                  <StatusBadge status={status} />
                  {canReview && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleValidate(d.id)}
                        data-testid={`button-validate-${d.id}`}
                      >
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectDocId(d.id);
                          setRejectReason("");
                        }}
                        data-testid={`button-reject-${d.id}`}
                      >
                        Rejeter
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {docs.length === 0 && (
              <div className="p-8 text-center text-slate-500">Aucun document</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={rejectDocId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejectDocId(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le document</DialogTitle>
            <DialogDescription>
              Indiquez le motif du rejet. L'étudiant sera notifié.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motif du rejet</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex. Document illisible, page manquante…"
              data-testid="textarea-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDocId(null);
                setRejectReason("");
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={submitRejection}
              data-testid="button-confirm-reject"
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CommentsTab({
  studentId,
  isStaff,
  currentUserId,
}: {
  studentId: number;
  isStaff: boolean;
  currentUserId: number;
}) {
  const { data: comments = [], refetch } = useListComments(studentId);
  const create = useCreateComment();
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isCorrection, setIsCorrection] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await create.mutateAsync({
      studentId,
      data: {
        content,
        isInternal,
        isCorrectionRequest: isCorrection,
      } as unknown as CreateCommentBody,
    });
    setContent("");
    setIsInternal(false);
    setIsCorrection(false);
    refetch();
  };

  const list = (comments as unknown as Comment[]).filter(
    (c) => isStaff || !c.isInternal,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            placeholder="Écrire un message…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            data-testid="textarea-comment"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              {isStaff && (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      data-testid="checkbox-internal"
                    />
                    Note interne
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isCorrection}
                      onChange={(e) => setIsCorrection(e.target.checked)}
                      data-testid="checkbox-correction"
                    />
                    Demande de correction
                  </label>
                </>
              )}
            </div>
            <Button onClick={handleSubmit} disabled={!content.trim()} data-testid="button-send-comment">
              Envoyer
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {list.map((c) => {
          const mine = c.authorId === currentUserId;
          return (
            <div
              key={c.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
              data-testid={`comment-${c.id}`}
            >
              <div className="max-w-[75%]">
                <div
                  className={`text-xs text-slate-500 mb-1 flex items-center gap-2 ${mine ? "justify-end" : ""}`}
                >
                  {!mine && (
                    <span className="font-medium text-slate-700">
                      {c.authorName}
                    </span>
                  )}
                  <span>{formatDateTime(c.createdAt)}</span>
                  {mine && (
                    <span className="font-medium text-slate-700">Moi</span>
                  )}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-sm whitespace-pre-wrap ${
                    c.isCorrectionRequest
                      ? "bg-rose-50 border border-rose-200 text-rose-900"
                      : c.isInternal
                        ? "bg-amber-50 border border-amber-200 text-amber-900"
                        : mine
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-slate-200 text-slate-800"
                  }`}
                >
                  {(c.isCorrectionRequest || c.isInternal) && (
                    <div className="flex items-center gap-1 text-xs font-semibold mb-1 uppercase tracking-wide">
                      {c.isCorrectionRequest && (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          Correction demandée
                        </>
                      )}
                      {c.isInternal && !c.isCorrectionRequest && (
                        <span>Note interne</span>
                      )}
                    </div>
                  )}
                  {c.content}
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              Aucun message pour l'instant
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TasksTab({ studentId, isStaff }: { studentId: number; isStaff: boolean }) {
  const { data: tasks = [], refetch } = useListStudentTasks(studentId);
  const { data: users = [] } = useListUsers({});
  const create = useCreateTask();
  const update = useUpdateTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState<string>("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    await create.mutateAsync({
      studentId,
      data: {
        title,
        description,
        priority,
        dueDate: dueDate || undefined,
        assignedToId: assignedToId ? Number(assignedToId) : undefined,
      } as unknown as CreateTaskBody,
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssignedToId("");
    refetch();
  };

  const toggleStatus = async (taskId: number, status: string) => {
    await update.mutateAsync({ taskId, data: { status } as unknown as UpdateTaskBody });
    refetch();
  };

  const staff = (users as unknown as UserRow[]).filter((u) =>
    ["advisor", "reviewer", "admin", "superadmin"].includes(u.role),
  );

  return (
    <div className="space-y-4">
      {isStaff && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle tâche</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-task-title"
            />
            <Textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <div className="grid md:grid-cols-3 gap-3">
              <select
                className="border rounded-lg px-3 py-2 bg-white"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                data-testid="select-priority"
              >
                <option value="low">Priorité basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-due-date"
              />
              <select
                className="border rounded-lg px-3 py-2 bg-white"
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                data-testid="select-assignee"
              >
                <option value="">Non assignée</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} — {ROLE_LABELS[u.role]}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleCreate} disabled={!title.trim()} data-testid="button-create-task">
              Créer la tâche
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {(tasks as unknown as Task[]).map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-4">
                <input
                  type="checkbox"
                  checked={t.status === "done"}
                  onChange={(e) => toggleStatus(t.id, e.target.checked ? "done" : "pending")}
                  className="mt-1.5"
                  data-testid={`checkbox-task-${t.id}`}
                />
                <div className="flex-1">
                  <div className={`font-medium ${t.status === "done" ? "line-through text-slate-400" : ""}`}>
                    {t.title}
                  </div>
                  {t.description && (
                    <div className="text-sm text-slate-600 mt-0.5">{t.description}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-1 flex gap-3">
                    {t.dueDate && <span>📅 {formatDate(t.dueDate)}</span>}
                    <span>Priorité: {t.priority}</span>
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="p-8 text-center text-slate-500">Aucune tâche</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AppointmentsTab({ studentId, isStaff }: { studentId: number; isStaff: boolean }) {
  const { data: apts = [], refetch } = useListAppointments(studentId);
  const create = useCreateAppointment();
  const [type, setType] = useState("campus_france");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");

  const handleCreate = async () => {
    if (!title || !scheduledAt) return;
    await create.mutateAsync({
      studentId,
      data: { type, title, scheduledAt, location } as unknown as CreateAppointmentBody,
    });
    setTitle("");
    setScheduledAt("");
    setLocation("");
    refetch();
  };

  return (
    <div className="space-y-4">
      {isStaff && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programmer un rendez-vous</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <select
                className="border rounded-lg px-3 py-2 bg-white"
                value={type}
                onChange={(e) => setType(e.target.value)}
                data-testid="select-apt-type"
              >
                <option value="campus_france">Campus France</option>
                <option value="tls_vfs">TLS / VFS</option>
                <option value="other">Autre</option>
              </select>
              <Input
                placeholder="Titre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-apt-title"
              />
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                data-testid="input-apt-date"
              />
              <Input
                placeholder="Lieu"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={!title || !scheduledAt} data-testid="button-create-apt">
              Créer
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {(apts as unknown as Appointment[]).map((a) => (
              <div key={a.id} className="flex items-center gap-4 p-4">
                <Calendar className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-sm text-slate-600">
                    {formatDateTime(a.scheduledAt)} {a.location && `· ${a.location}`}
                  </div>
                </div>
                <StatusBadge status={a.type} />
                <StatusBadge status={a.status ?? "upcoming"} />
              </div>
            ))}
            {apts.length === 0 && (
              <div className="p-8 text-center text-slate-500">Aucun rendez-vous</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskTab({ studentId }: { studentId: number }) {
  const { data: score, refetch } = useGetStudentRiskScore(studentId);
  const recalc = useRecalculateRiskScore();

  const handleRecalc = async () => {
    await recalc.mutateAsync({ studentId });
    refetch();
  };

  if (!score) return <div>Chargement…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <div>
                <div className="text-sm text-slate-600">Niveau de risque</div>
                <div className="text-2xl font-bold">
                  <StatusBadge status={score.level} />
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600">Score</div>
              <div className="text-3xl font-bold">{score.score}/100</div>
            </div>
          </div>
          <Progress value={score.score} className="h-2" />
          <Button variant="outline" size="sm" className="mt-4" onClick={handleRecalc} data-testid="button-recalc-risk">
            <Sparkles className="w-4 h-4 mr-1" /> Recalculer
          </Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facteurs de risque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <RiskRow label="Documents manquants" value={score.missingDocuments} />
            <RiskRow label="Documents rejetés" value={score.rejectedDocuments} />
            <RiskRow label="Tâches en retard" value={score.overdueTasks} />
            <RiskRow
              label="Étapes Campus France manquantes"
              value={score.missingCampusFrance ? "Oui" : "Non"}
            />
            <RiskRow
              label="Aucun rendez-vous à venir"
              value={score.missingAppointments ? "Oui" : "Non"}
            />
            <RiskRow
              label="Antécédent de refus de visa"
              value={score.hasVisaRefusal ? "Oui" : "Non"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommandations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(score.recommendations ?? []).map((rec: string, i: number) => (
              <div key={i} className="flex gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <span>{rec}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RiskRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ProfileTab({
  studentId,
  student,
  isStaff,
  onUpdate,
}: {
  studentId: number;
  student: Student;
  isStaff: boolean;
  onUpdate: () => void;
}) {
  const update = useUpdateStudent();
  const assign = useAssignStudent();
  const { data: countries = [] } = useListCountries();
  const { data: schools = [] } = useListSchools();
  const { data: users = [] } = useListUsers({});
  const [form, setForm] = useState<StudentFormData>(
    student as unknown as StudentFormData,
  );

  const handleSave = async () => {
    await update.mutateAsync({ studentId, data: form as unknown as UpdateStudentBody });
    onUpdate();
  };

  const handleAssign = async (advisorId: number | null, reviewerId: number | null) => {
    await assign.mutateAsync({
      studentId,
      data: { advisorId, reviewerId } as unknown as AssignStudentBody,
    });
    onUpdate();
  };

  const allUsers = users as unknown as UserRow[];
  const advisors = allUsers.filter((u) => u.role === "advisor");
  const reviewers = allUsers.filter((u) => u.role === "reviewer");

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <Input
                value={form.firstName ?? ""}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field label="Nom">
              <Input
                value={form.lastName ?? ""}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Téléphone">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={form.whatsapp ?? ""}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </Field>
          <Field label="Date de naissance">
            <Input
              type="date"
              value={form.dateOfBirth ?? ""}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </Field>
          <Field label="Numéro de passeport">
            <Input
              value={form.passportNumber ?? ""}
              onChange={(e) => setForm({ ...form, passportNumber: e.target.value })}
            />
          </Field>
          <Field label="Date d'expiration passeport">
            <Input
              type="date"
              value={form.passportExpiry ?? ""}
              onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })}
            />
          </Field>
          <Button onClick={handleSave} data-testid="button-save-profile">
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dossier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Pays d'origine">
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={form.countryId ?? ""}
              onChange={(e) =>
                setForm({ ...form, countryId: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">—</option>
              {(countries as unknown as Country[]).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.requiresCampusFrance ? "(Campus France requis)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="École cible">
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={form.schoolId ?? ""}
              onChange={(e) =>
                setForm({ ...form, schoolId: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">—</option>
              {(schools as unknown as School[]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type de financement">
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={form.financingType ?? ""}
              onChange={(e) => setForm({ ...form, financingType: e.target.value })}
            >
              <option value="">—</option>
              <option value="self">Auto-financé</option>
              <option value="bourse">Boursier</option>
              <option value="parents">Parents</option>
              <option value="autre">Autre</option>
            </select>
          </Field>
          <Field label="Date de rentrée prévue">
            <Input
              type="date"
              value={form.intakeDate ?? ""}
              onChange={(e) => setForm({ ...form, intakeDate: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hasVisaRefusalHistory ?? false}
              onChange={(e) =>
                setForm({ ...form, hasVisaRefusalHistory: e.target.checked })
              }
            />
            Antécédent de refus de visa
          </label>

          {isStaff && (
            <div className="border-t pt-3 mt-3">
              <Field label="Conseiller assigné">
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={form.advisorId ?? ""}
                  onChange={(e) =>
                    handleAssign(
                      e.target.value ? Number(e.target.value) : null,
                      form.reviewerId ?? null,
                    )
                  }
                  data-testid="select-advisor"
                >
                  <option value="">—</option>
                  {advisors.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Examinateur assigné">
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={form.reviewerId ?? ""}
                  onChange={(e) =>
                    handleAssign(
                      form.advisorId ?? null,
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  data-testid="select-reviewer"
                >
                  <option value="">—</option>
                  {reviewers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Statut du dossier">
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  data-testid="select-status"
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Actif</option>
                  <option value="blocked">Bloqué</option>
                  <option value="submitted">Déposé</option>
                  <option value="visa_obtained">Visa obtenu</option>
                  <option value="visa_refused">Visa refusé</option>
                  <option value="withdrawn">Abandonné</option>
                </select>
              </Field>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
