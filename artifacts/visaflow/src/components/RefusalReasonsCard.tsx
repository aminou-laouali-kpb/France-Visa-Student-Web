import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ShieldAlert } from "lucide-react";

const MOTIF_CODES = ["1", "2", "3", "4", "5", "6", "7"] as const;

export function RefusalReasonsCard() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card data-testid="card-refusal-reasons">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              {t("refusal.mapTitle")}
            </CardTitle>
            <ChevronDown
              className={`w-5 h-5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-slate-600">{t("refusal.mapIntro")}</p>
            {MOTIF_CODES.map((code) => (
              <div
                key={code}
                className="rounded-lg border border-slate-200 p-3 space-y-1"
                data-testid={`refusal-motif-${code}`}
              >
                <div className="font-medium text-slate-900">
                  {t(`refusal.motifs.${code}.label`)}
                </div>
                <p className="text-sm text-slate-600">
                  {t(`refusal.motifs.${code}.explanation`)}
                </p>
                <p className="text-sm text-emerald-800 bg-emerald-50 rounded px-2 py-1">
                  {t("refusal.prevention")}: {t(`refusal.motifs.${code}.prevention`)}
                </p>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
