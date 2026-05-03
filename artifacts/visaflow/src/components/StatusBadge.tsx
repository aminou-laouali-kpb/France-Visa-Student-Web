import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_COLORS[status])}>
      {t(`status.${status}`, { defaultValue: status })}
    </Badge>
  );
}
