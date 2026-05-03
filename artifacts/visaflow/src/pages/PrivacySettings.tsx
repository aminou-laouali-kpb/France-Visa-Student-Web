import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { gdprApi } from "@/lib/billing";
import { Download, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PrivacySettings() {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [eraseConfirm, setEraseConfirm] = useState("");

  const ERASE_KEYWORD = t("privacy.eraseKeyword");

  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await gdprApi.exportZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visaflow-export-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const onErase = async () => {
    if (eraseConfirm.trim().toUpperCase() !== ERASE_KEYWORD.toUpperCase()) return;
    if (!confirm(t("privacy.confirmDeletion"))) return;
    setErasing(true);
    try {
      await gdprApi.erase();
      window.location.href = "/";
    } catch (err) {
      alert((err as Error).message);
      setErasing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {t("privacy.title")}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("privacy.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t("privacy.exportTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            {t("privacy.exportDesc")}
          </p>
          <Button onClick={onExport} disabled={exporting} data-testid="btn-export">
            {exporting ? t("privacy.exporting") : t("privacy.exportBtn")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="text-base text-rose-700 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            {t("privacy.deleteTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">
            {t("privacy.deleteDesc")}
          </p>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {t("privacy.deleteConfirmLabel")} — <strong>{ERASE_KEYWORD}</strong>
            </label>
            <input
              type="text"
              value={eraseConfirm}
              onChange={(e) => setEraseConfirm(e.target.value)}
              className="w-full border border-rose-200 rounded px-3 py-2 text-sm"
              data-testid="input-erase-confirm"
            />
          </div>
          <Button
            variant="destructive"
            disabled={erasing || eraseConfirm.trim().toUpperCase() !== ERASE_KEYWORD.toUpperCase()}
            onClick={onErase}
            data-testid="btn-erase"
          >
            {erasing ? t("privacy.deleting") : t("privacy.deleteBtn")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
