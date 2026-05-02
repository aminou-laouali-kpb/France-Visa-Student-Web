import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetStudent,
  useUpdateStudent,
  useListStudentSteps,
  useUpdateStudentStep,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const student = studentRaw as any;
  const { data: me } = useGetMe();
  const isStaff = me && ["advisor", "reviewer", "admin", "superadmin"].includes(me.role);

  if (!student) return <div className="p-8">Chargement…</div>;

  return (
    <div className="space-y-6">
      <Link href="/app/students">
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
          <TabsTrigger value="comments" data-testid="tab-comments">Commentaires</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">Tâches</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">Rendez-vous</TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">Risque</TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">Profil</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-4">
          <StepsTab studentId={studentId} canEdit={!!isStaff || me?.id === student.userId} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab studentId={studentId} isStaff={!!isStaff} />
        </TabsContent>
        <TabsContent value="comments" className="mt-4">
          <CommentsTab studentId={studentId} isStaff={!!isStaff} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab studentId={studentId} isStaff={!!isStaff} />
        </TabsContent>
        <TabsContent value="appointments" className="mt-4">
          <AppointmentsTab studentId={studentId} isStaff={!!isStaff} />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <RiskTab studentId={studentId} />
        </TabsContent>
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

  const handleStatus = async (stepId: number, status: string) => {
    await update.mutateAsync({ studentId, stepId, data: { status } as any });
    refetch();
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {steps.map((step: any, i: number) => {
            const isCompleted = step.status === "validated";
            const isBlocked = step.status === "blocked" || step.status === "rejected";
            return (
              <div
                key={step.id}
                className="flex items-start gap-4 p-4 hover:bg-slate-50"
                data-testid={`step-${step.id}`}
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
                <div className="flex items-center gap-2">
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
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("passeport");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");

  const handleUpload = async () => {
    if (!file || !name) return;
    setUploading(true);
    try {
      // 1) Get presigned URL
      const tokenRes = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/storage/upload-url`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", authorization: `Bearer ${(await (window as any).Clerk?.session?.getToken?.()) ?? ""}` },
        body: JSON.stringify({ name: file.name, contentType: file.type }),
      }).then((r) => r.json());

      // 2) Upload to GCS
      await fetch(tokenRes.uploadURL, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });

      // 3) Register document
      await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/students/${studentId}/documents`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", authorization: `Bearer ${(await (window as any).Clerk?.session?.getToken?.()) ?? ""}` },
        body: JSON.stringify({
          category,
          name,
          fileName: file.name,
          objectPath: tokenRes.objectPath,
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

  const handleReview = async (documentId: number, decision: "validated" | "rejected") => {
    const comment = decision === "rejected" ? prompt("Motif du rejet :") ?? "" : "";
    await review.mutateAsync({ studentId, documentId, data: { decision, comment } as any });
    refetch();
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
            {docs.map((d: any) => (
              <div key={d.id} className="flex items-center gap-4 p-4">
                <FileText className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-slate-500">
                    {DOCUMENT_CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category} ·
                    v{d.version} · {formatDate(d.uploadedAt)}
                  </div>
                  {d.rejectionReason && (
                    <div className="text-sm text-rose-600 mt-1">⚠️ {d.rejectionReason}</div>
                  )}
                </div>
                <StatusBadge status={d.status} />
                {isStaff && (d.status === "received" || d.status === "under_review") && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReview(d.id, "validated")}
                      data-testid={`button-validate-${d.id}`}
                    >
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReview(d.id, "rejected")}
                      data-testid={`button-reject-${d.id}`}
                    >
                      Rejeter
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {docs.length === 0 && (
              <div className="p-8 text-center text-slate-500">Aucun document</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommentsTab({ studentId, isStaff }: { studentId: number; isStaff: boolean }) {
  const { data: comments = [], refetch } = useListComments(studentId);
  const create = useCreateComment();
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isCorrection, setIsCorrection] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await create.mutateAsync({
      studentId,
      data: { content, isInternal, isCorrectionRequest: isCorrection } as any,
    });
    setContent("");
    setIsInternal(false);
    setIsCorrection(false);
    refetch();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            placeholder="Écrire un commentaire…"
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

      <div className="space-y-2">
        {comments.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-500">
                    {formatDateTime(c.createdAt)}
                  </span>
                  {c.isInternal && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                      Interne
                    </span>
                  )}
                  {c.isCorrectionRequest && (
                    <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
                      Correction
                    </span>
                  )}
                </div>
              </div>
              <p className="text-slate-800 whitespace-pre-wrap">{c.content}</p>
            </CardContent>
          </Card>
        ))}
        {comments.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              Aucun commentaire
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
      } as any,
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssignedToId("");
    refetch();
  };

  const toggleStatus = async (taskId: number, status: string) => {
    await update.mutateAsync({ taskId, data: { status } as any });
    refetch();
  };

  const staff = users.filter((u: any) =>
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
                {staff.map((u: any) => (
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
            {tasks.map((t: any) => (
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
      data: { type, title, scheduledAt, location } as any,
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
            {apts.map((a: any) => (
              <div key={a.id} className="flex items-center gap-4 p-4">
                <Calendar className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-sm text-slate-600">
                    {formatDateTime(a.scheduledAt)} {a.location && `· ${a.location}`}
                  </div>
                </div>
                <StatusBadge status={a.type} />
                <StatusBadge status={a.status} />
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
  student: any;
  isStaff: boolean;
  onUpdate: () => void;
}) {
  const update = useUpdateStudent();
  const assign = useAssignStudent();
  const { data: countries = [] } = useListCountries();
  const { data: schools = [] } = useListSchools();
  const { data: users = [] } = useListUsers({});
  const [form, setForm] = useState(student);

  const handleSave = async () => {
    await update.mutateAsync({ studentId, data: form });
    onUpdate();
  };

  const handleAssign = async (advisorId: number | null, reviewerId: number | null) => {
    await assign.mutateAsync({ studentId, data: { advisorId, reviewerId } as any });
    onUpdate();
  };

  const advisors = users.filter((u: any) => u.role === "advisor");
  const reviewers = users.filter((u: any) => u.role === "reviewer");

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
              {countries.map((c: any) => (
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
              {schools.map((s: any) => (
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
                      form.reviewerId,
                    )
                  }
                  data-testid="select-advisor"
                >
                  <option value="">—</option>
                  {advisors.map((u: any) => (
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
                      form.advisorId,
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  data-testid="select-reviewer"
                >
                  <option value="">—</option>
                  {reviewers.map((u: any) => (
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
