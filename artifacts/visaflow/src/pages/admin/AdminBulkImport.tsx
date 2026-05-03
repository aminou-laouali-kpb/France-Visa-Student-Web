import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Format = "csv" | "xlsx";

interface PreviewRow {
  rowIndex: number;
  raw: Record<string, string>;
  parsed: Record<string, string | undefined>;
  errors: string[];
  warnings: string[];
  resolved: { duplicate?: boolean };
}
interface PreviewResp {
  headers: string[];
  rows: PreviewRow[];
  totals: { total: number; valid: number; withErrors: number; duplicates: number };
}

function fileToPayload(
  file: File,
): Promise<{ format: Format; content: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isXlsx =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls");
    if (isXlsx) {
      reader.onload = () => {
        const result = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(result);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        resolve({ format: "xlsx", content: btoa(binary) });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => resolve({ format: "csv", content: String(reader.result) });
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    }
  });
}

export function AdminBulkImport() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: Array<{ rowIndex: number; reason: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doPreview = async () => {
    if (!file) {
      setError(t("import.noFile"));
      return;
    }
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const payload = await fileToPayload(file);
      const r = await fetch("/api/admin/import/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPreview((await r.json()) as PreviewResp);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doCommit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await fileToPayload(file);
      const r = await fetch("/api/admin/import/commit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, skipDuplicates }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setResult(await r.json());
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t("import.title")}</h1>
        <p className="text-sm text-slate-600 mt-1">{t("import.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("import.fileLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
            }}
            data-testid="input-import-file"
          />
          <p className="text-xs text-slate-500">
            En-têtes attendus: firstName, lastName, email, phone, nationality,
            country, school, program, intake. Synonymes français acceptés
            (prenom, nom, telephone, ecole, programme, rentree…).
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              data-testid="checkbox-skip-duplicates"
            />
            {t("import.skipDuplicates")}
          </label>
          <div className="flex gap-2">
            <Button onClick={doPreview} disabled={busy} data-testid="button-import-preview">
              {t("import.previewBtn")}
            </Button>
            {preview && (
              <Button
                onClick={doCommit}
                disabled={busy}
                variant="default"
                data-testid="button-import-commit"
              >
                {t("import.commitBtn")}
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-emerald-700">
              {t("import.createdN", { n: result.created })} · {t("import.skippedN", { n: result.skipped })}
            </CardTitle>
          </CardHeader>
          {result.errors.length > 0 && (
            <CardContent>
              <ul className="text-sm space-y-1">
                {result.errors.slice(0, 50).map((e, i) => (
                  <li key={i} className="text-rose-600">
                    {t("import.rowIndex")} {e.rowIndex}: {e.reason}
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {preview && (
        <>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline">
              {t("import.totals.total")}: {preview.totals.total}
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {t("import.totals.valid")}: {preview.totals.valid}
            </Badge>
            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
              {t("import.totals.errors")}: {preview.totals.withErrors}
            </Badge>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              {t("import.totals.duplicates")}: {preview.totals.duplicates}
            </Badge>
          </div>
          <Card>
            <CardContent className="overflow-auto p-0">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">firstName</th>
                    <th className="px-2 py-1 text-left">lastName</th>
                    <th className="px-2 py-1 text-left">email</th>
                    <th className="px-2 py-1 text-left">country</th>
                    <th className="px-2 py-1 text-left">school</th>
                    <th className="px-2 py-1 text-left">status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr
                      key={r.rowIndex}
                      className={
                        r.errors.length
                          ? "bg-rose-50"
                          : r.resolved.duplicate
                            ? "bg-amber-50"
                            : ""
                      }
                    >
                      <td className="px-2 py-1 text-slate-500">{r.rowIndex}</td>
                      <td className="px-2 py-1">{r.parsed.firstName ?? ""}</td>
                      <td className="px-2 py-1">{r.parsed.lastName ?? ""}</td>
                      <td className="px-2 py-1">{r.parsed.email ?? ""}</td>
                      <td className="px-2 py-1">{r.parsed.countryName ?? ""}</td>
                      <td className="px-2 py-1">{r.parsed.schoolName ?? ""}</td>
                      <td className="px-2 py-1">
                        {r.errors.length > 0 ? (
                          <span className="text-rose-700">{r.errors.join("; ")}</span>
                        ) : r.resolved.duplicate ? (
                          <span className="text-amber-700">duplicate</span>
                        ) : r.warnings.length > 0 ? (
                          <span className="text-amber-700">{r.warnings.join("; ")}</span>
                        ) : (
                          <span className="text-emerald-700">ok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
