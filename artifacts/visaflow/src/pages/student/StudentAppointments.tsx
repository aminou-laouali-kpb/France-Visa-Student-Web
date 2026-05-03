import { useListAppointments } from "@workspace/api-client-react";
import type { Appointment } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import { Building2, Stamp, Calendar, MapPin, Clock } from "lucide-react";
import { StudentGate, useMyStudent } from "./StudentLayout";

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
      return Stamp;
    default:
      return Calendar;
  }
}

function typeLabel(type: string) {
  switch (type) {
    case "campus_france":
      return "Campus France";
    case "tls_vfs":
      return "TLS / VFS";
    default:
      return "Autre";
  }
}

function Inner() {
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
        <h1 className="text-3xl font-bold text-slate-900">Mes rendez-vous</h1>
        <p className="text-slate-600 mt-1">
          Vos entretiens Campus France et dépôts consulaires.
        </p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            À venir ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past">
            Passés ({past.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">
          <AppointmentList items={upcoming} empty="Aucun rendez-vous à venir" />
        </TabsContent>
        <TabsContent value="past" className="mt-4">
          <AppointmentList items={past} empty="Aucun rendez-vous passé" past />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentList({
  items,
  empty,
  past = false,
}: {
  items: Appointment[];
  empty: string;
  past?: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-slate-500">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          {empty}
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
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  a.type === "campus_france"
                    ? "bg-purple-100 text-purple-700"
                    : a.type === "tls_vfs"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900">{a.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {typeLabel(a.type)}
                  </span>
                </div>
                <div className="text-sm text-slate-600 mt-1 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {formatDateTime(a.scheduledAt)}
                  </span>
                  {a.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {a.location}
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
