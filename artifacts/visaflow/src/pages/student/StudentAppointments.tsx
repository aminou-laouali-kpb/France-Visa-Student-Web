import { useListAppointments } from "@workspace/api-client-react";
import type { Appointment } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import {
  Building2,
  Stamp,
  Calendar,
  MapPin,
  Clock,
  Fingerprint,
  Landmark,
  HeartPulse,
  Hash,
  Euro,
} from "lucide-react";
import { StudentGate, useMyStudent } from "./StudentLayout";
import { useTranslation } from "react-i18next";

export function StudentAppointments() {
  return (
    <StudentGate>
      <Inner />
    </StudentGate>
  );
}

function typeIcon(type: string) {
  switch (type) {
    case "campus_france":
      return Building2;
    case "tls_vfs":
    case "capago":
      return Stamp;
    case "biometrics":
      return Fingerprint;
    case "prefecture":
      return Landmark;
    case "ofii":
      return HeartPulse;
    default:
      return Calendar;
  }
}

const APT_TYPE_KEY: Record<string, string> = {
  campus_france: "apt.typeCampusFrance",
  tls_vfs: "apt.typeTlsVfs",
  capago: "apt.typeCapago",
  prefecture: "apt.typePrefecture",
  ofii: "apt.typeOfii",
  biometrics: "apt.typeBiometrics",
};

function typeChipColor(type: string) {
  switch (type) {
    case "campus_france":
      return "bg-purple-100 text-purple-700";
    case "tls_vfs":
    case "capago":
      return "bg-blue-100 text-blue-700";
    case "biometrics":
      return "bg-amber-100 text-amber-700";
    case "prefecture":
      return "bg-emerald-100 text-emerald-700";
    case "ofii":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function Inner() {
  const { t } = useTranslation();
  const { student } = useMyStudent();
  const studentId = student!.id;
  const { data: apts = [] } = useListAppointments(studentId);
  const list = apts as unknown as Appointment[];
  const now = Date.now();

  const upcoming = list
    .filter((a) => new Date(a.scheduledAt).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  const past = list
    .filter((a) => new Date(a.scheduledAt).getTime() < now)
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t("appointments.title")}</h1>
        <p className="text-slate-600 mt-1">
          {t("appointments.subtitle")}
        </p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            {t("appointments.upcoming", { n: upcoming.length })}
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past">
            {t("appointments.past", { n: past.length })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">
          <AppointmentList items={upcoming} emptyKey="appointments.noUpcoming" />
        </TabsContent>
        <TabsContent value="past" className="mt-4">
          <AppointmentList items={past} emptyKey="appointments.noPast" past />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentList({
  items,
  emptyKey,
  past = false,
}: {
  items: Appointment[];
  emptyKey: string;
  past?: boolean;
}) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-slate-500">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          {t(emptyKey)}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((a) => {
        const Icon = typeIcon(a.type);
        return (
          <Card key={a.id} data-testid={`apt-${a.id}`}>
            <CardContent className={`p-4 flex items-start gap-4 ${past ? "opacity-75" : ""}`}>
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeChipColor(a.type)}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900">{a.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${typeChipColor(a.type)}`}>
                    {t(APT_TYPE_KEY[a.type] ?? "apt.typeOther")}
                  </span>
                  {a.provider && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {a.provider}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-600 mt-1 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {formatDateTime(a.scheduledAt)}
                  </span>
                  {(a.centre || a.location) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {a.centre || a.location}
                    </span>
                  )}
                  {a.feeEur != null && a.feeEur !== "" && (
                    <span className="flex items-center gap-1" data-testid={`apt-fee-${a.id}`}>
                      <Euro className="w-3.5 h-3.5" /> {String(a.feeEur)} €
                    </span>
                  )}
                  {a.confirmationNumber && (
                    <span
                      className="flex items-center gap-1 font-mono"
                      data-testid={`apt-conf-${a.id}`}
                    >
                      <Hash className="w-3.5 h-3.5" /> {a.confirmationNumber}
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge status={a.status ?? (past ? "completed" : "upcoming")} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
