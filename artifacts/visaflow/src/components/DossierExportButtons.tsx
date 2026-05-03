import { useTranslation } from "react-i18next";
import { useListAppointments } from "@workspace/api-client-react";

interface Props {
  studentId: number;
}

function fmtGoogle(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildGoogleUrl(appt: { title: string; scheduledAt: string; notes?: string | null; location?: string | null }) {
  const start = new Date(appt.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: appt.title,
    dates: `${fmtGoogle(start)}/${fmtGoogle(end)}`,
  });
  if (appt.notes) params.set("details", appt.notes);
  if (appt.location) params.set("location", appt.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookUrl(appt: { title: string; scheduledAt: string; notes?: string | null; location?: string | null }) {
  const start = new Date(appt.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: appt.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (appt.notes) params.set("body", appt.notes);
  if (appt.location) params.set("location", appt.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function DossierExportButtons({ studentId }: Props) {
  const { t } = useTranslation();
  const { data: apts = [] } = useListAppointments(studentId);
  const upcoming = (apts as Array<{ title: string; scheduledAt: string; notes?: string | null; location?: string | null }>)
    .filter((a) => new Date(a.scheduledAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

  const baseLink = "inline-flex items-center text-xs px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <a
        href={`/api/students/${studentId}/dossier.pdf`}
        target="_blank"
        rel="noreferrer"
        className={baseLink}
        data-testid="link-download-pdf"
      >
        📄 {t("dossier.downloadPdf")}
      </a>
      <a
        href={`/api/students/${studentId}/calendar.ics`}
        className={baseLink}
        data-testid="link-download-ics"
      >
        📅 {t("dossier.downloadIcs")}
      </a>
      {upcoming && (
        <>
          <a
            href={buildGoogleUrl(upcoming)}
            target="_blank"
            rel="noreferrer"
            className={baseLink}
            data-testid="link-add-google"
          >
            🅖 {t("dossier.addToGoogle")}
          </a>
          <a
            href={buildOutlookUrl(upcoming)}
            target="_blank"
            rel="noreferrer"
            className={baseLink}
            data-testid="link-add-outlook"
          >
            📨 {t("dossier.addToOutlook")}
          </a>
        </>
      )}
    </div>
  );
}
