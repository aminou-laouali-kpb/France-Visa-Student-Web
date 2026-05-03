import { useState } from "react";
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
  useSetSubmissionGateOverride,
} from "@workspace/api-client-react";
import type {
  CreateFinancialProofBody,
  CreateAccommodationRecordBody,
  UpsertCvecPaymentBody,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Trash2, Plus, CheckCircle2, Shield } from "lucide-react";

const PROOF_TYPES = [
  { value: "bank_attestation", label: "Attestation bancaire (validité 3 mois)" },
  { value: "scholarship_letter", label: "Lettre de bourse" },
  { value: "guarantor_declaration", label: "Déclaration de garant" },
  { value: "avi_certificate", label: "Certificat AVI" },
  { value: "other", label: "Autre" },
];

const ACCOMMODATION_TYPES = [
  { value: "crous", label: "CROUS" },
  { value: "private_lease", label: "Bail privé" },
  { value: "host_attestation", label: "Attestation d'hébergement (hôte)" },
  { value: "student_residence", label: "Résidence étudiante" },
  { value: "hotel_temporary", label: "Hôtel temporaire" },
  { value: "other", label: "Autre" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "valid", label: "Validé" },
  { value: "expired", label: "Expiré" },
  { value: "rejected", label: "Rejeté" },
];

const CVEC_STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "paid", label: "Payé" },
  { value: "exempted", label: "Exempté" },
  { value: "rejected", label: "Rejeté" },
];

function formatEur(n: number | string | null | undefined) {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(v)) return "—";
  return `${v.toLocaleString("fr-FR")} €`;
}

export function FinancialReadinessTab({
  studentId,
  isAdmin,
}: {
  studentId: number;
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

  // ── Proof form state
  const [proofForm, setProofForm] = useState<CreateFinancialProofBody>({
    proofType: "bank_attestation",
    amountEur: "",
    currency: "EUR",
  });

  // ── Accommodation form state
  const [accForm, setAccForm] = useState<CreateAccommodationRecordBody>({
    accommodationType: "crous",
    countryCode: "FR",
  });

  // ── CVEC form state
  const [cvecForm, setCvecForm] = useState<UpsertCvecPaymentBody>({
    amountEur: "103.00",
    status: "pending",
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
                    {readiness.cvecReady ? "Validé" : "Non validé"}
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
            const derived = (p as any).derivedStatus ?? p.status;
            return (
              <div
                key={p.id}
                className="border rounded p-3 flex items-center justify-between gap-3"
                data-testid={`proof-row-${p.id}`}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {PROOF_TYPES.find((t) => t.value === p.proofType)?.label ??
                      p.proofType}{" "}
                    — {formatEur(p.amountEur)}
                  </div>
                  <div className="text-xs text-slate-600">
                    {p.providerName ?? p.guarantorName ?? "—"}
                    {p.issueDate && ` • Émis : ${p.issueDate}`}
                    {p.expiryDate && ` • Expire : ${p.expiryDate}`}
                  </div>
                </div>
                <select
                  className="border rounded px-2 py-1 text-xs"
                  value={p.status}
                  onChange={async (e) => {
                    await updateProof.mutateAsync({
                      studentId,
                      proofId: p.id,
                      data: { status: e.target.value as any },
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
                    proofType: e.target.value as any,
                  }))
                }
                data-testid="proof-form-type"
              >
                {PROOF_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {proofForm.proofType === "scholarship_letter" && (
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
                    proofType: "bank_attestation",
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
              {proofForm.proofType === "bank_attestation" && (
                <span className="ml-3 text-xs text-slate-500">
                  La date d'expiration sera calculée automatiquement (3 mois
                  après l'émission).
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
                  {ACCOMMODATION_TYPES.find(
                    (t) => t.value === a.accommodationType,
                  )?.label ?? a.accommodationType}
                </div>
                <div className="text-xs text-slate-600">
                  {[a.addressLine, a.postalCode, a.city]
                    .filter(Boolean)
                    .join(", ") || "—"}
                  {a.startDate && ` • Du ${a.startDate}`}
                  {a.endDate && ` au ${a.endDate}`}
                </div>
                {(a.hostFirstName || a.hostLastName) && (
                  <div className="text-xs text-slate-600">
                    Hôte : {a.hostFirstName} {a.hostLastName}{" "}
                    {a.hostRelation && `(${a.hostRelation})`}
                  </div>
                )}
              </div>
              <select
                className="border rounded px-2 py-1 text-xs"
                value={a.status}
                onChange={async (e) => {
                  await updateAcc.mutateAsync({
                    studentId,
                    recordId: a.id,
                    data: { status: e.target.value as any },
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
                    accommodationType: e.target.value as any,
                  }))
                }
                data-testid="acc-form-type"
              >
                {ACCOMMODATION_TYPES.map((t) => (
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
            {accForm.accommodationType === "host_attestation" && (
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
            <div className="md:col-span-3">
              <Button
                size="sm"
                onClick={async () => {
                  await createAcc.mutateAsync({
                    studentId,
                    data: accForm,
                  });
                  setAccForm({
                    accommodationType: "crous",
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
          <CardTitle className="text-lg">CVEC</CardTitle>
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
                </div>
              </div>
              <span
                className={
                  "text-xs px-2 py-0.5 rounded " +
                  (c.status === "paid" || c.status === "exempted"
                    ? "bg-green-100 text-green-800"
                    : c.status === "rejected"
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
                placeholder="2025-2026"
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
            <div>
              <Label className="text-xs">Statut</Label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={cvecForm.status}
                onChange={(e) =>
                  setCvecForm((f) => ({
                    ...f,
                    status: e.target.value as any,
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
