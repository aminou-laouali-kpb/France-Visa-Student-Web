import { useState } from "react";
import {
  useListUsers,
  useUpdateUser,
  useListAuditLogs,
  useListSchools,
  useCreateSchool,
  useListCountries,
  useCreateCountry,
  useUpdateCountry,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, formatDateTime } from "@/lib/utils";
import type { UserRow, AuditLog, School, Country } from "@/types";

type UpdateUserBody = { role?: string; isActive?: boolean };
type CreateSchoolBody = { name: string; city: string; website: string };
type CreateCountryBody = {
  name: string;
  code: string;
  requiresCampusFrance: boolean;
  visaCenter: string;
};
type UpdateCountryPatchBody = { requiresCampusFrance?: boolean };

export function AdminUsers() {
  const { data: users = [], refetch } = useListUsers({});
  const update = useUpdateUser();

  const setRole = async (userId: number, role: string) => {
    await update.mutateAsync({ userId, data: { role } as unknown as UpdateUserBody });
    refetch();
  };

  const toggleActive = async (userId: number, isActive: boolean) => {
    await update.mutateAsync({ userId, data: { isActive } as unknown as UpdateUserBody });
    refetch();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Utilisateurs</h1>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                <th className="text-left px-4 py-3 font-medium">Rôle</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Inscrit</th>
              </tr>
            </thead>
            <tbody>
              {(users as unknown as UserRow[]).map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {u.firstName} {u.lastName}
                    </div>
                    <div className="text-sm text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => setRole(u.id, e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                      data-testid={`select-role-${u.id}`}
                    >
                      {["student", "advisor", "reviewer", "admin", "superadmin"].map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant={u.isActive ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleActive(u.id, !u.isActive)}
                      data-testid={`button-toggle-active-${u.id}`}
                    >
                      {u.isActive ? "Actif" : "Désactivé"}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatDateTime(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminAudit() {
  const { data: logs = [] } = useListAuditLogs({});
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Journal d'audit</h1>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Entité</th>
                <th className="text-left px-4 py-3 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody>
              {(logs as unknown as AuditLog[]).map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {formatDateTime(l.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{l.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {l.entityType} #{l.entityId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-md truncate">
                    {l.details ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminSchools() {
  const { data: schools = [], refetch } = useListSchools();
  const create = useCreateSchool();
  const [form, setForm] = useState({ name: "", city: "", website: "" });

  const handleCreate = async () => {
    if (!form.name || !form.city) return;
    await create.mutateAsync({ data: form as unknown as CreateSchoolBody });
    setForm({ name: "", city: "", website: "" });
    refetch();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Écoles</h1>
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
            />
            <Input
              placeholder="Ville"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <Input
              placeholder="Site web"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <Button onClick={handleCreate} data-testid="button-create-school">
            Ajouter
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {(schools as unknown as School[]).map((s) => (
              <div key={s.id} className="p-4">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-slate-500">{s.city}</div>
                {s.website && (
                  <a
                    href={s.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {s.website}
                  </a>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminCountries() {
  const { data: countries = [], refetch } = useListCountries();
  const create = useCreateCountry();
  const update = useUpdateCountry();
  const [form, setForm] = useState({
    name: "",
    code: "",
    requiresCampusFrance: false,
    visaCenter: "",
  });

  const handleCreate = async () => {
    if (!form.name || !form.code) return;
    await create.mutateAsync({ data: form as unknown as CreateCountryBody });
    setForm({ name: "", code: "", requiresCampusFrance: false, visaCenter: "" });
    refetch();
  };

  const toggleCampusFrance = async (countryId: number, current: boolean) => {
    await update.mutateAsync({
      countryId,
      data: { requiresCampusFrance: !current } as unknown as UpdateCountryPatchBody,
    });
    refetch();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Pays</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter un pays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <Input
              placeholder="Nom"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Code (ex: SN)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              placeholder="Centre visa"
              value={form.visaCenter}
              onChange={(e) => setForm({ ...form, visaCenter: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.requiresCampusFrance}
                onChange={(e) =>
                  setForm({ ...form, requiresCampusFrance: e.target.checked })
                }
              />
              Campus France requis
            </label>
          </div>
          <Button onClick={handleCreate} data-testid="button-create-country">
            Ajouter
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Pays</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Centre visa</th>
                <th className="text-left px-4 py-3">Campus France</th>
              </tr>
            </thead>
            <tbody>
              {(countries as unknown as Country[]).map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-sm">{c.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.visaCenter ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant={c.requiresCampusFrance ? "default" : "outline"}
                      onClick={() => toggleCampusFrance(c.id, c.requiresCampusFrance)}
                    >
                      {c.requiresCampusFrance ? "Requis" : "Non requis"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
