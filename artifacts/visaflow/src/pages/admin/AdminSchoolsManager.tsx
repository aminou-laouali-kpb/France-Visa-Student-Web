import { useState } from "react";
import {
  useListSchools,
  useCreateSchool,
  useGetSchool,
  useCreateProgram,
} from "@workspace/api-client-react";
import type {
  CreateSchoolBody,
  CreateProgramBody,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, GraduationCap, Plus, ExternalLink } from "lucide-react";

export function AdminSchoolsManager() {
  const { data: schools = [], refetch } = useListSchools();
  const create = useCreateSchool();
  const [form, setForm] = useState<CreateSchoolBody>({
    name: "",
    city: "",
    website: "",
  });
  const [openSchoolId, setOpenSchoolId] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!form.name || !form.city) return;
    await create.mutateAsync({ data: form });
    setForm({ name: "", city: "", website: "" });
    refetch();
  };

  return (
    <div className="space-y-6" data-testid="admin-schools-manager">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Écoles & filières</h1>
        <p className="text-slate-600 mt-1">
          Gérer les établissements partenaires et leurs programmes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter une école</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <Input
              placeholder="Nom"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="input-school-name"
            />
            <Input
              placeholder="Ville"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              data-testid="input-school-city"
            />
            <Input
              placeholder="Site web"
              value={form.website ?? ""}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              data-testid="input-school-website"
            />
          </div>
          <Button onClick={handleCreate} data-testid="button-create-school">
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schools.map((s) => (
          <Card
            key={s.id}
            className="hover:shadow-md transition-shadow"
            data-testid={`school-card-${s.id}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {s.name}
                  </div>
                  <div className="text-sm text-slate-500">{s.city}</div>
                </div>
              </div>
              {s.website && (
                <a
                  href={s.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mb-3"
                >
                  <ExternalLink className="w-3 h-3" />
                  Site web
                </a>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setOpenSchoolId(s.id)}
                data-testid={`button-manage-programs-${s.id}`}
              >
                <GraduationCap className="w-4 h-4 mr-1" />
                Gérer les filières
              </Button>
            </CardContent>
          </Card>
        ))}
        {schools.length === 0 && (
          <div className="md:col-span-3 text-center text-slate-500 py-12">
            Aucune école enregistrée pour le moment.
          </div>
        )}
      </div>

      {openSchoolId && (
        <ProgramsDialog
          schoolId={openSchoolId}
          onClose={() => setOpenSchoolId(null)}
        />
      )}
    </div>
  );
}

function ProgramsDialog({
  schoolId,
  onClose,
}: {
  schoolId: number;
  onClose: () => void;
}) {
  const { data: school, refetch } = useGetSchool(schoolId);
  const create = useCreateProgram();
  const programs = school?.programs ?? [];

  const [form, setForm] = useState<{
    name: string;
    level: string;
    durationMonths: string;
  }>({ name: "", level: "Licence", durationMonths: "36" });

  const handleCreate = async () => {
    if (!form.name) return;
    const body: CreateProgramBody = {
      name: form.name,
      level: form.level,
      duration: form.durationMonths ? `${form.durationMonths} mois` : undefined,
    };
    await create.mutateAsync({ schoolId, data: body });
    setForm({ name: "", level: form.level, durationMonths: form.durationMonths });
    refetch();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Filières — {school?.name ?? "…"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg divide-y" data-testid="programs-list">
            {programs.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {p.level && <span>{p.level}</span>}
                    {p.duration && <span className="ml-2">{p.duration}</span>}
                  </div>
                </div>
                <Badge variant="outline">#{p.id}</Badge>
              </div>
            ))}
            {programs.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                Aucune filière.
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="text-sm font-medium">Nouvelle filière</div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Nom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-program-name"
              />
              <Input
                placeholder="Niveau"
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                data-testid="input-program-level"
              />
              <Input
                type="number"
                placeholder="Durée (mois)"
                value={form.durationMonths}
                onChange={(e) =>
                  setForm({ ...form, durationMonths: e.target.value })
                }
                data-testid="input-program-duration"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={handleCreate} data-testid="button-create-program">
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
