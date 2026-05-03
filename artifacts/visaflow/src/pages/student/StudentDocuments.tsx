import { useState, useRef, useEffect } from "react";
import { useListDocuments } from "@workspace/api-client-react";
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

const DOCUMENT_CATEGORIES: { value: string; label: string }[] = [
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

export function StudentDocuments() {
  return (
    <StudentGate>
      <Inner />
    </StudentGate>
  );
}

function Inner() {
  const { student } = useMyStudent();
  const studentId = student!.id;
  const { data: docs = [], refetch } = useListDocuments(studentId);
  const list = docs as unknown as Document[];

  const grouped = DOCUMENT_CATEGORIES.map((c) => ({
    ...c,
    docs: list.filter((d) => d.category === c.value),
  })).filter((g) => g.docs.length > 0 || g.value !== "autre");

  const rejected = list.filter((d) => d.status === "rejected");

  const [prefillCategory, setPrefillCategory] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mes documents</h1>
        <p className="text-slate-600 mt-1">
          Téléversez et suivez vos pièces justificatives.
        </p>
      </div>

      {rejected.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-900">
              <AlertCircle className="w-5 h-5" />
              Documents à corriger ({rejected.length})
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
                      Motif : {d.rejectionReason}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPrefillCategory(d.category)}
                  data-testid={`button-reupload-${d.id}`}
                >
                  <RefreshCw className="w-4 h-4 mr-1" /> Re-téléverser
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <UploadDropzone
        studentId={studentId}
        onUploaded={refetch}
        prefillCategory={prefillCategory}
      />

      <div className="space-y-4">
        {grouped.map((g) => (
          <Card key={g.value} data-testid={`group-${g.value}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{g.label}</span>
                <span className="text-xs font-normal text-slate-500">
                  {g.docs.length} document{g.docs.length > 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {g.docs.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400 italic">
                    Aucun document téléversé
                  </div>
                ) : (
                  g.docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 p-4"
                      data-testid={`doc-${d.id}`}
                    >
                      <FileText className="w-6 h-6 text-blue-600 shrink-0" />
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

function UploadDropzone({
  studentId,
  onUploaded,
  prefillCategory,
}: {
  studentId: number;
  onUploaded: () => void;
  prefillCategory: string | null;
}) {
  const { getToken } = useAuth();
  const [category, setCategory] = useState("passeport");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      if (!putRes.ok) throw new Error("Échec du téléversement");

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
        }),
      });
      if (!docRes.ok) throw new Error("Échec de l'enregistrement");

      setFile(null);
      setName("");
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Téléverser un document</CardTitle>
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
          aria-label="Glissez-déposez un fichier ici ou cliquez pour parcourir"
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
                Glissez-déposez un fichier ici
              </div>
              <div className="text-sm text-slate-500 mt-1">
                ou cliquez pour parcourir (PDF, JPG, PNG)
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
        {error && (
          <div className="text-sm text-rose-600">⚠️ {error}</div>
        )}
        <Button
          onClick={handleUpload}
          disabled={!file || !name || uploading}
          data-testid="button-upload"
        >
          {uploading ? "Téléversement…" : "Téléverser"}
        </Button>
      </CardContent>
    </Card>
  );
}
