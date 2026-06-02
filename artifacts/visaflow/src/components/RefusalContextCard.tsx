import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileWarning } from "lucide-react";

type Props = {
  refusalReasonCode?: string | null;
  refusalNotes?: string | null;
};

export function RefusalContextCard({ refusalReasonCode, refusalNotes }: Props) {
  const { t } = useTranslation();
  const code = refusalReasonCode?.trim();
  const motifKey = code && /^[1-7]$/.test(code) ? code : null;

  return (
    <Card className="border-amber-200 bg-amber-50/40" data-testid="card-refusal-context">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-amber-900">
          <FileWarning className="w-5 h-5" />
          {t("refusal.advisorAlertTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-slate-700">{t("refusal.advisorAlertBody")}</p>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">
            {t("refusal.recordedMotif")}
          </div>
          <div className="font-semibold text-slate-900 mt-1">
            {motifKey ? t(`refusal.motifs.${motifKey}.label`) : t("refusal.motifNotSet")}
          </div>
          {refusalNotes?.trim() && (
            <p className="mt-2 text-slate-600 italic">&ldquo;{refusalNotes.trim()}&rdquo;</p>
          )}
        </div>
        <div>
          <div className="font-medium text-slate-900 mb-2">{t("refusal.playbookTitle")}</div>
          <ol className="list-decimal list-inside space-y-2 text-slate-700">
            <li>{t("refusal.playbook.gracious")}</li>
            <li>{t("refusal.playbook.commission")}</li>
            <li>{t("refusal.playbook.contentious")}</li>
          </ol>
          <p className="mt-3 text-slate-600">{t("refusal.playbook.generic")}</p>
          {motifKey && (
            <p className="mt-2 flex gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {t(`refusal.playbook.byMotif.${motifKey}`)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
