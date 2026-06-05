import { useState, useRef, useEffect } from "react";
import {
  useListDocuments,
  useReExtractDocument,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import type { Document, UploadUrlResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";
import {
  FileText,
  Upload,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { StudentGate, useMyStudent } from "./StudentLayout";
import { useTranslation } from "react-i18next";
import { checkThreeMonthRule } from "@/lib/documentPrecheck";

const AVI_PROVIDERS = ["Studely","AVICENTER","Visa Etude France","Ready Study Go","Autre"] as const;

const DOCUMENT_CATEGORY_VALUES = [
  "passeport",
  "piece_identite",
  "diplome",
  "releve_notes",
  "test_langue",
  "lettre_admission",
  "attestation_campus_france",
  "justificatif_financier",
  "avi",
  "justificatif_hebergement",
  "assurance",
  "billet_avion",
  "autre",
] as const;

export function StudentDocuments() {
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
  const { data: docs = [], refetch } = useListDocuments(studentId);
  const list = docs as unknown as Document[];
  const { getToken } = useAuth();
  const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
  const [precheckWarnings, setPrecheckWarnings] = useState<
    { code: string; severity: "error" | "warning"; message: string }[]
  >([]);

  const refreshPrecheck = async () => {
    try {
      const token = (await getToken()) ?? "";
      const res = await fetch(`${apiBase}/students/${studentId}/document-precheck`, {
        method: "GET",
        credentials: "include",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setPrecheckWarnings(Array.isArray(json?.warnings) ? json.warnings : []);
    } catch {
      // Best-effort
    }
  };

  useEffect(() => {
    refreshPrecheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const DOCUMENT_CATEGORIES = DOCUMENT_CATEGORY_VALUES.map((v) => ({
    value: v,
    label: t(`docCategory.${v}`),
  }));

  const grouped = DOCUMENT_CATEGORIES.map((c) => ({
    ...c,
    docs: list.filter((d) => d.category === c.value),
  })).filter((g) => g.docs.length > 0 || g.value !== "autre");

  const rejected = list.filter((d) => d.status === "rejected");

  const [prefillCategory, setPrefillCategory] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t("documents.title")}</h1>
        <p className="text-slate-600 mt-1">{t("documents.subtitle")}</p>
      </div>

      {precheckWarnings.length > 0 && (
        <Card
          className={
            "border p-0 " +
            (precheckWarnings.some((w) => w.severity === "error")
              ? "border-rose-200 bg-rose-50/50"
              : "border-amber-200 bg-amber-50/50")
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900">
              <AlertCircle className="w-5 h-5 text-slate-900" />
              Pré-contrôle consulaire
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-800">
              {precheckWarnings.map((w) => (
                <li key={w.code}>{w.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {rejected.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-900">
              <AlertCircle className="w-5 h-5" />
              {t("documents.toCorrect", { n: rejected.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rejected.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-rose-200"
                data-testid={`rejected-${d.id}`}
              >
                <FileText className="w-5 h-5 text-rose-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.name}</div>
                  {d.rejectionReason && (
                    <div className="text-sm text-rose-700 mt-0.5">
                      {t("documents.motif")} {d.rejectionReason}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPrefillCategory(d.category)}
                  data-testid={`button-reupload-${d.id}`}
                >
                  <RefreshCw className="w-4 h-4 mr-1" /> {t("documents.reUpload")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <UploadDropzone
        studentId={studentId}
        onUploaded={async () => {
          await refetch();
          await refreshPrecheck();
        }}
        prefillCategory={prefillCategory}
        categories={DOCUMENT_CATEGORIES}
      />

      <div className="space-y-4">
        {grouped.map((g) => (
          <Card key={g.value} data-testid={`group-${g.value}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{g.label}</span>
                <span className="text-xs font-normal text-slate-500">
                  {g.docs.length}{" "}
                  {g.docs.length > 1 ? t("documents.nDocsPlural") : t("documents.nDocs")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {g.docs.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400 italic">
                    {t("documents.noUploaded")}
                  </div>
                ) : (
                  g.docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-start gap-3 p-4"
                      data-testid={`doc-${d.id}`}
                    >
                      <FileText className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{d.name}</div>
                        <div className="text-xs text-slate-500">
                          v{d.version} · {formatDate(d.uploadedAt)}
                        </div>
                        {d.rejectionReason && (
                          <div className="text-sm text-rose-600 mt-1">
                            ⚠️ {d.rejectionReason}
                          </div>
                        )}
                        <StudentDocExtraction doc={d} studentId={studentId} onRefetch={refetch} />
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StudentDocExtraction({
  doc,
  studentId,
  onRefetch,
}: {
  doc: Document;
  studentId: number;
  onRefetch: () => void;
}) {
  const { t } = useTranslation();
  const reExtract = useReExtractDocument();
  const status = doc.extractionStatus ?? "pending";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDays = doc.expiryDate
    ? Math.floor(
        (new Date(`${doc.expiryDate}T00:00:00Z`).getTime() - today.getTime()) /
          (24 * 3600 * 1000),
      )
    : null;
  const SOON_DAYS = 183;
  const expired = expDays !== null && expDays < 0;
  const expiringSoon = expDays !== null && expDays >= 0 && expDays <= SOON_DAYS;

  const banners: { tone: "red" | "amber"; text: string }[] = [];
  if (expired) banners.push({ tone: "red", text: t("documents.expired", { date: doc.expiryDate }) });
  else if (expiringSoon) banners.push({ tone: "amber", text: t("documents.expiringSoon", { n: expDays, date: doc.expiryDate }) });
  const precheckKey = checkThreeMonthRule(doc);
  if (precheckKey) banners.push({ tone: "amber", text: t(precheckKey) });
  const storedPrecheck = (doc.extractedData as { precheckWarnings?: { messageKey: string }[] } | null | undefined)?.precheckWarnings;
  if (storedPrecheck?.length) { for (const w of storedPrecheck) { banners.push({ tone: "amber", text: t(w.messageKey) }); } }

  if (status === "pending" || status === "processing") {
    return (
      <div
        className="text-xs text-blue-600 mt-1"
        data-testid={`extraction-status-${doc.id}`}
      >
        {t("documents.aiProcessing")}
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      {banners.map((b, i) => (
        <div
          key={i}
          className={
            "text-xs rounded px-2 py-1 inline-block " +
            (b.tone === "red"
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-amber-50 text-amber-800 border border-amber-200")
          }
          data-testid={`extraction-warning-${doc.id}-${i}`}
        >
          ⚠️ {b.text}
        </div>
      ))}
      {status === "failed" && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-rose-600">{t("documents.aiFailed")}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={async () => {
              await reExtract.mutateAsync({ studentId, documentId: doc.id });
              onRefetch();
            }}
            disabled={reExtract.isPending}
            data-testid={`button-reextract-${doc.id}`}
          >
            {t("documents.rerun")}
          </Button>
        </div>
      )}
    </div>
  );
}

function UploadDropzone({
  studentId,
  onUploaded,
  prefillCategory,
  categories,
}: {
  studentId: number;
  onUploaded: () => void;
  prefillCategory: string | null;
  categories: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [category, setCategory] = useState("passeport");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviProvider, setAviProvider] = useState<string>(AVI_PROVIDERS[0]);
  const [aviNumber, setAviNumber] = useState("");
  const [aviDate, setAviDate] = useState("");
  const [aviAmount, setAviAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const apiBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

  useEffect(() => {
    if (prefillCategory) setCategory(prefillCategory);
  }, [prefillCategory]);

  const handleFiles = (f: File | null) => {
    setError(null);
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!file || !name) return;
    setUploading(true);
    setError(null);
    try {
      const token = (await getToken()) ?? "";
      const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      };
      const tokenRes = (await fetch(`${apiBase}/storage/upload-url`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          name: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      }).then((r) => r.json())) as UploadUrlResponse;

      const putRes = await fetch(tokenRes.uploadURL, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(t("documents.uploadFailed"));

      const docRes = await fetch(`${apiBase}/students/${studentId}/documents`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          category,
          name,
          fileName: file.name,
          objectPath: tokenRes.objectPath,
          uploadToken: tokenRes.uploadToken,
          mimeType: file.type,
          sizeBytes: file.size,
          ...(category === "avi" ? { aviProvider, aviCertificateNumber: aviNumber || undefined, aviCertificateDate: aviDate || undefined, aviAmountEur: aviAmount ? Number(aviAmount) : undefined } : {}),
        }),
      });
      if (!docRes.ok) throw new Error(t("documents.saveFailed"));

      setFile(null);
      setName("");
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("documents.unknownError"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("documents.uploadCard")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragOver
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          data-testid="dropzone"
          role="button"
          tabIndex={0}
          aria-label={t("documents.dropzoneAria")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          {file ? (
            <div>
              <div className="font-medium text-slate-900">{file.name}</div>
              <div className="text-xs text-slate-500 mt-1">
                {(file.size / 1024).toFixed(1)} Ko
              </div>
            </div>
          ) : (
            <>
              <div className="text-slate-700 font-medium">
                {t("documents.dropzone")}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                {t("documents.dropzoneOr")}
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files?.[0] ?? null)}
            data-testid="input-doc-file"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>{t("documents.category")}</Label>
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              data-testid="select-doc-category"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("documents.docName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("documents.namePh")}
              data-testid="input-doc-name"
            />
          </div>
        </div>
        {category === "avi" && (<div className="grid md:grid-cols-2 gap-3 p-3 rounded-lg border border-blue-100 bg-blue-50/40"><div><Label>{t("documents.aviProvider")}</Label><select className="w-full mt-1 border rounded-lg px-3 py-2 bg-white" value={aviProvider} onChange={(e) => setAviProvider(e.target.value)} data-testid="select-avi-provider">{AVI_PROVIDERS.map((p) => (<option key={p} value={p}>{p}</option>))}</select></div><div><Label>{t("documents.aviNumber")}</Label><Input value={aviNumber} onChange={(e) => setAviNumber(e.target.value)} placeholder={t("documents.aviNumberPh")} data-testid="input-avi-number" /></div><div><Label>{t("documents.aviDate")}</Label><Input type="date" value={aviDate} onChange={(e) => setAviDate(e.target.value)} data-testid="input-avi-date" /></div><div><Label>{t("documents.aviAmount")}</Label><Input type="number" min={0} step="0.01" value={aviAmount} onChange={(e) => setAviAmount(e.target.value)} placeholder="7380" data-testid="input-avi-amount" /></div></div>)}
        {error && (<div className="text-sm text-rose-600">⚠️ {error}</div>)}
        <Button
          onClick={handleUpload}
          disabled={!file || !name || uploading}
          data-testid="button-upload"
        >
          {uploading ? t("documents.uploading") : t("documents.upload")}
        </Button>
      </CardContent>
    </Card>
  );
}
