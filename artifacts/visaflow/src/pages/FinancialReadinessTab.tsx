import { useState } from "react";
import { useAuth } from "@clerk/react";
import {
  useListFinancialProofs,
  useCreateFinancialProof,
  useUpdateFinancialProof,
  useDeleteFinancialProof,
  useListAccommodationRecords,
  useCreateAccommodationRecord,
  useUpdateAccommodationRecord,
  useDeleteAccommodationRecord,
  useListCvecPayments,
  useUpsertCvecPayment,
  useGetFinancialReadiness,
  useListScholarships,
  useGetFinanceReference,
  useSetSubmissionGateOverride,
  FinancialProofStatus,
  CreateFinancialProofBodyProofType,
  CreateAccommodationRecordBodyAccommodationType,
  CvecPaymentStatus,
} from "@workspace/api-client-react";
import type {
  CreateFinancialProofBody,
  CreateAccommodationRecordBody,
  UpsertCvecPaymentBody,
} from "@workspace/api-client-react";

// Runtime shape returned by /storage/upload-url (see documents.ts).
// Defined locally because the OpenAPI schema for UploadUrlResponse
// does not currently advertise `uploadURL`/`uploadToken`.
interface StorageUploadTokenResponse {
  uploadURL: string;
  objectPath: string;
  uploadToken: string;
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Trash2,
  Plus,
  CheckCircle2,
  Shield,
  Paperclip,
  Upload,
} from "lucide-react";

const STATUS_OPTIONS: { value: FinancialProofStatus; label: string }[] = [
  { value: FinancialProofStatus.pending, label: "En attente" },
  { value: FinancialProofStatus.valid, label: "Validé" },
  { value: FinancialProofStatus.expired, label: "Expiré" },
  { value: FinancialProofStatus.rejected, label: "Rejeté" },
];

const CVEC_STATUS_OPTIONS: { value: CvecPaymentStatus; label: string }[] = [
  { value: CvecPaymentStatus.pending, label: "En attente" },
  { value: CvecPaymentStatus.paid, label: "Payé" },
  { value: CvecPaymentStatus.exempted, label: "Exempté" },
  { value: CvecPaymentStatus.rejected, label: "Rejeté" },
];

function formatEur(n: number | string | null | undefined) {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(v)) return "—";
  return `${v.toLocaleString("fr-FR")} €`;
}

// ─── Reusable: file → upload → create document → return documentId ──────────
function DocumentAttachField({
  studentId,
  category,
  documentId,
  onChange,
  label = "Justificatif",
}: {
  studentId: number;
  category: string;
  documentId: number | null | undefined;
  onChange: (id: number | null) => void;
  label?: string;
}) {
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const token = (await getToken()) ?? "";
      const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      } as const;
      const tokenRes = (await fetch(`${apiBase}/storage/upload-url`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          name: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      }).then((r) => r.json())) as StorageUploadTokenResponse;

      await fetch(tokenRes.uploadURL, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });

      const created = await fetch(
        `${apiBase}/students/${studentId}/documents`,
        {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            category,
            name: file.name,
            fileName: file.name,
            objectPath: tokenRes.objectPath,
            uploadToken: tokenRes.uploadToken,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        },
      ).then((r) => r.json());

      if (typeof created?.id === "number") {
        onChange(created.id);
      } else {
        setError("Échec de l'enregistrement du document.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du téléversement.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="text-xs">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        {documentId ? (
          <>
            <span className="inline-flex items-center gap-1 text-green-700">
              <Paperclip size={12} /> Document #{documentId} attaché
            </span>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => onChange(null)}
              data-testid="doc-detach"
            >
              Retirer
            </Button>
          </>
        ) : (
          <label className="inline-flex items-center gap-1 cursor-pointer text-blue-700 hover:underline">
            <Upload size={12} />
            {uploading ? "Téléversement…" : "Téléverser un fichier"}
            <input
              type="file"
              className="hidden"
              onChange={handleFile}
              disabled={uploading}
              data-testid="doc-upload-input"
            />
          </label>
        )}
      </div>
      {error && <div className="text-red-600 mt-1">{error}</div>}
    </div>
  );
}

export function FinancialReadinessTab({
  studentId,
  isStaff,
  isAdmin,
}: {
  studentId: number;
  isStaff: boolean;
  isAdmin: boolean;
}) {
  const { data: readiness, refetch: refetchReadiness } =
    useGetFinancialReadiness(studentId);
  const { data: proofs, refetch: refetchProofs } =
    useListFinancialProofs(studentId);
  const { data: accommodations, refetch: refetchAcc } =
    useListAccommodationRecords(studentId);
  const { data: cvecList, refetch: refetchCvec } =
    useListCvecPayments(studentId);
  const { data: scholarships } = useListScholarships();
  const { data: ref } = useGetFinanceReference();

  const createProof = useCreateFinancialProof();
  const updateProof = useUpdateFinancialProof();
  const deleteProof = useDeleteFinancialProof();
  const createAcc = useCreateAccommodationRecord();
  const updateAcc = useUpdateAccommodationRecord();
  const deleteAcc = useDeleteAccommodationRecord();
  const upsertCvec = useUpsertCvecPayment();
  const setOverride = useSetSubmissionGateOverride();

  const reload = () => {
    refetchReadiness();
    refetchProofs();
    refetchAcc();
    refetchCvec();
  };

  const proofTypes = ref?.proofTypes ?? [];
  const accommodationTypes = ref?.accommodationTypes ?? [];

  const [proofForm, setProofForm] = useState<CreateFinancialProofBody>({
    proofType: CreateFinancialProofBodyProofType.bank_attestation,
    amountEur: "",
    currency: "EUR",
  });

  const [accForm, setAccForm] = useState<CreateAccommodationRecordBody>({
    accommodationType:
      CreateAccommodationRecordBodyAccommodationType.crous,
    countryCode: "FR",
  });

  const [cvecForm, setCvecForm] = useState<UpsertCvecPaymentBody>({
    amountEur: "103.00",
    status: CvecPaymentStatus.pending,
  });

  const [overrideReason, setOverrideReason] = useState("");

  const requiredPct = readiness
    ? Math.min(
        100,
        Math.round(
          (readiness.totalValidAmountEur /
            Math.max(1, readiness.requiredAmountEur)) *
            100,
        ),
      )
    : 0;

  const proofTypeLabel = (v: string) =>
    proofTypes.find((t) => t.value === v)?.label ?? v;
  const accTypeLabel = (v: string) =>
    accommodationTypes.find((t) => t.value === v)?.label ?? v;

  return (
    <div className="space-y-4">
      {/* ── READINESS BANNER ── */}
      {readiness && (
        <Card
          className={
            readiness.ready
              ? "border-green-300 bg-green-50"
              : readiness.overrideActive
                ? "border-amber-300 bg-amber-50"
                : "border-red-300 bg-red-50"
          }
          data-testid="readiness-banner"
        >
          <CardContent className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {readiness.ready ? (
                  <CheckCircle2 className="text-green-600" size={20} />
                ) : (
                  <AlertTriangle
                    className={
                      readiness.overrideActive
                        ? "text-amber-600"
                        : "text-red-600"
                    }
                    size={20}
                  />
                )}
                <span className="font-semibold">
                  {readiness.ready
                    ? "Dossier prêt à être soumis"
                    : readiness.overrideActive
                      ? "Soumission débloquée par dérogation administrateur"
                      : "Soumission bloquée"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-slate-600">Garantie financière</div>
                  <div className="font-medium">
                    {formatEur(readiness.totalValidAmountEur)} /{" "}
                    {formatEur(readiness.requiredAmountEur)}
                  </div>
                  <Progress value={requiredPct} className="h-2 mt-1" />
                  <div className="text-xs text-slate-500 mt-1">
                    {readiness.programDurationMonths} mois ×{" "}
                    {readiness.monthlyMinimumEur}€/mois
                    {readiness.programDurationIsEstimated && " (estimation)"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Logement</div>
                  <div
                    className={
                      readiness.accommodationReady
                        ? "font-medium text-green-700"
                        : "font-medium text-red-700"
                    }
                  >
                    {readiness.accommodationReady ? "Validé" : "Non validé"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">CVEC</div>
                  <div
                    className={
                      readiness.cvecReady
                        ? "font-medium text-green-700"
                        : "font-medium text-red-700"
                    }
                  >
                    {readiness.cvecReady
                      ? "Validé"
                      : `Non validé (${ref?.currentAcademicYear ?? ""})`}
                  </div>
                </div>
              </div>

              {readiness.blockingReasons.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
                  {readiness.blockingReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}

              {readiness.overrideActive && (
                <div className="mt-2 text-xs text-amber-800">
                  <Shield className="inline mr-1" size={14} />
                  Motif de dérogation : {readiness.overrideReason || "—"}
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="w-64 shrink-0 border-l pl-4">
                <Label className="text-xs">Dérogation administrateur</Label>
                {readiness.overrideActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1"
                    data-testid="btn-override-disable"
                    onClick={async () => {
                      await setOverride.mutateAsync({
                        studentId,
                        data: { enable: false },
                      });
                      reload();
                    }}
                  >
                    Retirer la dérogation
                  </Button>
                ) : (
                  <>
                    <Textarea
                      className="mt-1 text-xs"
                      rows={2}
                      placeholder="Motif (obligatoire)"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      data-testid="input-override-reason"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-1"
                      disabled={!overrideReason.trim()}
                      data-testid="btn-override-enable"
                      onClick={async () => {
                        await setOverride.mutateAsync({
                          studentId,
                          data: { enable: true, reason: overrideReason },
                        });
                        setOverrideReason("");
                        reload();
                      }}
                    >
                      Activer la dérogation
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── FINANCIAL PROOFS ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Justificatifs financiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(proofs ?? []).length === 0 && (
            <div className="text-sm text-slate-500">
              Aucun justificatif financier renseigné.
            </div>
          )}
          {(proofs ?? []).map((p) => {
            const derived = p.derivedStatus ?? p.status;
            return (
              <div
                key={p.id}
                className="border rounded p-3 flex items-center justify-between gap-3"
                data-testid={`proof-row-${p.id}`}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {proofTypeLabel(p.proofType)} — {formatEur(p.amountEur)}
                  </div>
                  <div className="text-xs text-slate-600">
                    {p.providerName ?? p.guarantorName ?? "—"}
                    {p.issueDate && ` • Émis : ${p.issueDate}`}
                    {p.expiryDate && ` • Expire : ${p.expiryDate}`}
                    {p.documentId && (
                      <span className="ml-2 inline-flex items-center gap-1 text-green-700">
                        <Paperclip size={11} /> doc #{p.documentId}
                      </span>
                    )}
                  </div>
                </div>
                {isStaff ? (
                  <select
                    className="border rounded px-2 py-1 text-xs"
                    value={p.status}
                    onChange={async (e) => {
                      await updateProof.mutateAsync({
                        studentId,
                        proofId: p.id,
                        data: {
                          status: e.target.value as FinancialProofStatus,
                        },
                      });
                      reload();
                    }}
                    data-testid={`proof-status-${p.id}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-500">
                    Statut : {p.status}
                  </span>
                )}
                <span
                  className={
                    "text-xs px-2 py-0.5 rounded " +
                    (derived === "valid"
                      ? "bg-green-100 text-green-800"
                      : derived === "expired"
                        ? "bg-red-100 text-red-800"
                        : derived === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-100 text-slate-700")
                  }
                >
                  {derived}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await deleteProof.mutateAsync({
                      studentId,
                      proofId: p.id,
                    });
                    reload();
                  }}
                  data-testid={`proof-delete-${p.id}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            );
          })}

          <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={proofForm.proofType}
                onChange={(e) =>
                  setProofForm((f) => ({
                    ...f,
                    proofType: e.target
                      .value as CreateFinancialProofBodyProofType,
                  }))
                }
                data-testid="proof-form-type"
              >
                {proofTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                    {t.validityMonths
                      ? ` (validité ${t.validityMonths} mois)`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            {proofForm.proofType ===
              CreateFinancialProofBodyProofType.scholarship_letter && (
              <div>
                <Label className="text-xs">Bourse</Label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={proofForm.scholarshipId ?? ""}
                  onChange={(e) =>
                    setProofForm((f) => ({
                      ...f,
                      scholarshipId: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                  data-testid="proof-form-scholarship"
                >
                  <option value="">— Sélectionner —</option>
                  {(scholarships ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label className="text-xs">Montant (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={proofForm.amountEur}
                onChange={(e) =>
                  setProofForm((f) => ({ ...f, amountEur: e.target.value }))
                }
                data-testid="proof-form-amount"
              />
            </div>
            <div>
              <Label className="text-xs">Date d'émission</Label>
              <Input
                type="date"
                value={proofForm.issueDate ?? ""}
                onChange={(e) =>
                  setProofForm((f) => ({
                    ...f,
                    issueDate: e.target.value || null,
                  }))
                }
                data-testid="proof-form-issue"
              />
            </div>
            <div>
              <Label className="text-xs">Émetteur / garant</Label>
              <Input
                value={proofForm.providerName ?? ""}
                onChange={(e) =>
                  setProofForm((f) => ({
                    ...f,
                    providerName: e.target.value || null,
                  }))
                }
                data-testid="proof-form-provider"
              />
            </div>
            <div className="md:col-span-2">
              <DocumentAttachField
                studentId={studentId}
                category="finance"
                documentId={proofForm.documentId}
                onChange={(id) =>
                  setProofForm((f) => ({ ...f, documentId: id }))
                }
              />
            </div>
            <div className="md:col-span-4">
              <Button
                size="sm"
                onClick={async () => {
                  if (!proofForm.amountEur) return;
                  await createProof.mutateAsync({
                    studentId,
                    data: proofForm,
                  });
                  setProofForm({
                    proofType:
                      CreateFinancialProofBodyProofType.bank_attestation,
                    amountEur: "",
                    currency: "EUR",
                  });
                  reload();
                }}
                disabled={!proofForm.amountEur}
                data-testid="proof-form-submit"
              >
                <Plus size={14} className="mr-1" />
                Ajouter le justificatif
              </Button>
              {proofForm.proofType ===
                CreateFinancialProofBodyProofType.bank_attestation && (
                <span className="ml-3 text-xs text-slate-500">
                  La date d'expiration sera calculée automatiquement (
                  {ref?.bankAttestationValidityMonths ?? 3} mois après
                  l'émission).
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── ACCOMMODATION ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hébergement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(accommodations ?? []).length === 0 && (
            <div className="text-sm text-slate-500">
              Aucun hébergement renseigné.
            </div>
          )}
          {(accommodations ?? []).map((a) => (
            <div
              key={a.id}
              className="border rounded p-3 flex items-center justify-between gap-3"
              data-testid={`acc-row-${a.id}`}
            >
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {accTypeLabel(a.accommodationType)}
                </div>
                <div className="text-xs text-slate-600">
                  {[a.addressLine, a.postalCode, a.city]
                    .filter(Boolean)
                    .join(", ") || "—"}
                  {a.startDate && ` • Du ${a.startDate}`}
                  {a.endDate && ` au ${a.endDate}`}
                  {a.documentId && (
                    <span className="ml-2 inline-flex items-center gap-1 text-green-700">
                      <Paperclip size={11} /> doc #{a.documentId}
                    </span>
                  )}
                </div>
                {(a.hostFirstName || a.hostLastName) && (
                  <div className="text-xs text-slate-600">
                    Hôte : {a.hostFirstName} {a.hostLastName}{" "}
                    {a.hostRelation && `(${a.hostRelation})`}
                  </div>
                )}
              </div>
              {isStaff ? (
                <select
                  className="border rounded px-2 py-1 text-xs"
                  value={a.status}
                  onChange={async (e) => {
                    await updateAcc.mutateAsync({
                      studentId,
                      recordId: a.id,
                      data: {
                        status: e.target
                          .value as (typeof STATUS_OPTIONS)[number]["value"],
                      },
                    });
                    reload();
                  }}
                  data-testid={`acc-status-${a.id}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-slate-500">
                  Statut : {a.status}
                </span>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  await deleteAcc.mutateAsync({
                    studentId,
                    recordId: a.id,
                  });
                  reload();
                }}
                data-testid={`acc-delete-${a.id}`}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}

          <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={accForm.accommodationType}
                onChange={(e) =>
                  setAccForm((f) => ({
                    ...f,
                    accommodationType: e.target
                      .value as CreateAccommodationRecordBodyAccommodationType,
                  }))
                }
                data-testid="acc-form-type"
              >
                {accommodationTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Ville</Label>
              <Input
                value={accForm.city ?? ""}
                onChange={(e) =>
                  setAccForm((f) => ({
                    ...f,
                    city: e.target.value || null,
                  }))
                }
                data-testid="acc-form-city"
              />
            </div>
            <div>
              <Label className="text-xs">Adresse</Label>
              <Input
                value={accForm.addressLine ?? ""}
                onChange={(e) =>
                  setAccForm((f) => ({
                    ...f,
                    addressLine: e.target.value || null,
                  }))
                }
                data-testid="acc-form-address"
              />
            </div>
            {accForm.accommodationType ===
              CreateAccommodationRecordBodyAccommodationType.host_attestation && (
              <>
                <div>
                  <Label className="text-xs">Prénom de l'hôte</Label>
                  <Input
                    value={accForm.hostFirstName ?? ""}
                    onChange={(e) =>
                      setAccForm((f) => ({
                        ...f,
                        hostFirstName: e.target.value || null,
                      }))
                    }
                    data-testid="acc-form-host-first"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nom de l'hôte</Label>
                  <Input
                    value={accForm.hostLastName ?? ""}
                    onChange={(e) =>
                      setAccForm((f) => ({
                        ...f,
                        hostLastName: e.target.value || null,
                      }))
                    }
                    data-testid="acc-form-host-last"
                  />
                </div>
                <div>
                  <Label className="text-xs">Lien de parenté</Label>
                  <Input
                    value={accForm.hostRelation ?? ""}
                    onChange={(e) =>
                      setAccForm((f) => ({
                        ...f,
                        hostRelation: e.target.value || null,
                      }))
                    }
                    data-testid="acc-form-host-relation"
                  />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Début</Label>
              <Input
                type="date"
                value={accForm.startDate ?? ""}
                onChange={(e) =>
                  setAccForm((f) => ({
                    ...f,
                    startDate: e.target.value || null,
                  }))
                }
                data-testid="acc-form-start"
              />
            </div>
            <div>
              <Label className="text-xs">Fin</Label>
              <Input
                type="date"
                value={accForm.endDate ?? ""}
                onChange={(e) =>
                  setAccForm((f) => ({
                    ...f,
                    endDate: e.target.value || null,
                  }))
                }
                data-testid="acc-form-end"
              />
            </div>
            <div>
              <DocumentAttachField
                studentId={studentId}
                category="logement"
                documentId={accForm.documentId}
                onChange={(id) =>
                  setAccForm((f) => ({ ...f, documentId: id }))
                }
              />
            </div>
            <div className="md:col-span-3">
              <Button
                size="sm"
                onClick={async () => {
                  await createAcc.mutateAsync({
                    studentId,
                    data: accForm,
                  });
                  setAccForm({
                    accommodationType:
                      CreateAccommodationRecordBodyAccommodationType.crous,
                    countryCode: "FR",
                  });
                  reload();
                }}
                data-testid="acc-form-submit"
              >
                <Plus size={14} className="mr-1" />
                Ajouter l'hébergement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CVEC ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            CVEC{ref && ` (tarif officiel ${ref.cvecAmountEur}€)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(cvecList ?? []).length === 0 && (
            <div className="text-sm text-slate-500">
              Aucun paiement CVEC enregistré.
            </div>
          )}
          {(cvecList ?? []).map((c) => (
            <div
              key={c.id}
              className="border rounded p-3 flex items-center justify-between gap-3"
              data-testid={`cvec-row-${c.id}`}
            >
              <div className="flex-1">
                <div className="font-medium text-sm">
                  Année {c.academicYear} — {formatEur(c.amountEur)}
                </div>
                <div className="text-xs text-slate-600">
                  {c.paidAt && `Payé le ${c.paidAt}`}
                  {c.receiptNumber && ` • Reçu n° ${c.receiptNumber}`}
                  {c.attestationDocumentId && (
                    <span className="ml-2 inline-flex items-center gap-1 text-green-700">
                      <Paperclip size={11} /> doc #{c.attestationDocumentId}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={
                  "text-xs px-2 py-0.5 rounded " +
                  (c.status === CvecPaymentStatus.paid ||
                  c.status === CvecPaymentStatus.exempted
                    ? "bg-green-100 text-green-800"
                    : c.status === CvecPaymentStatus.rejected
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-700")
                }
              >
                {c.status}
              </span>
            </div>
          ))}

          <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Année académique</Label>
              <Input
                placeholder={ref?.currentAcademicYear ?? "2025-2026"}
                value={cvecForm.academicYear ?? ""}
                onChange={(e) =>
                  setCvecForm((f) => ({
                    ...f,
                    academicYear: e.target.value || null,
                  }))
                }
                data-testid="cvec-form-year"
              />
            </div>
            <div>
              <Label className="text-xs">Montant (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={cvecForm.amountEur}
                placeholder={ref?.cvecAmountEur?.toString() ?? "103"}
                onChange={(e) =>
                  setCvecForm((f) => ({ ...f, amountEur: e.target.value }))
                }
                data-testid="cvec-form-amount"
              />
            </div>
            <div>
              <Label className="text-xs">Date de paiement</Label>
              <Input
                type="date"
                value={cvecForm.paidAt ?? ""}
                onChange={(e) =>
                  setCvecForm((f) => ({
                    ...f,
                    paidAt: e.target.value || null,
                  }))
                }
                data-testid="cvec-form-paid-at"
              />
            </div>
            {isStaff ? (
              <div>
                <Label className="text-xs">Statut</Label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={cvecForm.status}
                  onChange={(e) =>
                    setCvecForm((f) => ({
                      ...f,
                      status: e.target.value as CvecPaymentStatus,
                    }))
                  }
                  data-testid="cvec-form-status"
                >
                  {CVEC_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs text-slate-500 self-end pb-2">
                Le statut sera vérifié par votre conseiller.
              </div>
            )}
            <div className="md:col-span-2">
              <Label className="text-xs">N° de reçu</Label>
              <Input
                value={cvecForm.receiptNumber ?? ""}
                onChange={(e) =>
                  setCvecForm((f) => ({
                    ...f,
                    receiptNumber: e.target.value || null,
                  }))
                }
                data-testid="cvec-form-receipt"
              />
            </div>
            <div className="md:col-span-2">
              <DocumentAttachField
                studentId={studentId}
                category="cvec"
                documentId={cvecForm.attestationDocumentId}
                onChange={(id) =>
                  setCvecForm((f) => ({ ...f, attestationDocumentId: id }))
                }
                label="Attestation CVEC"
              />
            </div>
            <div className="md:col-span-4">
              <Button
                size="sm"
                onClick={async () => {
                  await upsertCvec.mutateAsync({
                    studentId,
                    data: cvecForm,
                  });
                  reload();
                }}
                data-testid="cvec-form-submit"
              >
                Enregistrer le paiement CVEC
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
