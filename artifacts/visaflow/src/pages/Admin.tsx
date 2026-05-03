import { useState, useMemo } from "react";
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
import { CountryFlag } from "@/components/CountryFlag";
import { UserPlus, Search } from "lucide-react";
import type { UserRow, AuditLog, School, Country } from "@/types";
import { useTranslation } from "react-i18next";

type UpdateUserBody = { role?: string; isActive?: boolean };
type CreateSchoolBody = { name: string; city: string; website: string };
type CreateCountryBody = {
  name: string;
  code: string;
  requiresCampusFrance: boolean;
  visaCenter: string;
};

const CLERK_INVITE_URL =
  "https://dashboard.clerk.com/last-active?path=organizations";

export function AdminUsers() {
  const { t } = useTranslation();
  const { data: users = [], refetch } = useListUsers({});
  const update = useUpdateUser();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const setRole = async (userId: number, role: string) => {
    await update.mutateAsync({ userId, data: { role } as unknown as UpdateUserBody });
    refetch();
  };

  const toggleActive = async (userId: number, isActive: boolean) => {
    await update.mutateAsync({ userId, data: { isActive } as unknown as UpdateUserBody });
    refetch();
  };

  const filtered = useMemo(() => {
    const arr = users as unknown as UserRow[];
    return arr.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (q) {
        const t = q.toLowerCase();
        const hay = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [users, q, roleFilter]);

  return (
    <div className="space-y-6" data-testid="admin-users">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">{t("admin.usersTitle")}</h1>
        <a href={CLERK_INVITE_URL} target="_blank" rel="noreferrer">
          <Button data-testid="button-invite-user">
            <UserPlus className="w-4 h-4 mr-2" />
            {t("admin.inviteUser")}
          </Button>
        </a>
      </div>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t("admin.searchUsers")}
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="input-search-users"
            />
          </div>
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            data-testid="select-role-filter"
          >
            <option value="">{t("admin.allRoles")}</option>
            {["student", "advisor", "reviewer", "admin", "superadmin"].map(
              (r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ),
            )}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colUser")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colRole")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colStatus")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colRegistered")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
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
                      {u.isActive ? t("admin.userActive") : t("admin.userDisabled")}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatDateTime(u.createdAt)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500">
                    {t("admin.noUsersMatch")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminAudit() {
  const { t } = useTranslation();
  const { data: logs = [] } = useListAuditLogs({});
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">{t("audit.title")}</h1>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t("table.date")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("table.action")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("table.entity")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("table.details")}</th>
              </tr>
            </thead>
            <tbody>
              {(logs as unknown as AuditLog[]).map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                    {formatDateTime(l.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline">{l.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {l.entityType} #{l.entityId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
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
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");

  const submit = async () => {
    if (!name || !city) return;
    await create.mutateAsync({
      data: { name, city, website } as unknown as CreateSchoolBody,
    });
    setName("");
    setCity("");
    setWebsite("");
    refetch();
  };

  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">{t("admin.schoolsTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.addSchool")}</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div>
            <Label>{t("admin.colName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t("admin.colCity")}</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label>{t("admin.colSite")}</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={submit} data-testid="button-create-school">
              {t("admin.create")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colSchool")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colCity")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colSite")}</th>
              </tr>
            </thead>
            <tbody>
              {(schools as unknown as School[]).map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.city}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">
                    {s.website ?? "—"}
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

export function AdminCountries() {
  const { data: countries = [], refetch } = useListCountries();
  const create = useCreateCountry();
  const update = useUpdateCountry();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [visaCenter, setVisaCenter] = useState("");
  const [requiresCampusFrance, setRequiresCampusFrance] = useState(false);

  const submit = async () => {
    if (!name || !code) return;
    await create.mutateAsync({
      data: {
        name,
        code,
        requiresCampusFrance,
        visaCenter,
      } as unknown as CreateCountryBody,
    });
    setName("");
    setCode("");
    setVisaCenter("");
    setRequiresCampusFrance(false);
    refetch();
  };

  const toggleCampusFrance = async (countryId: number, current: boolean) => {
    await update.mutateAsync({
      countryId,
      data: { requiresCampusFrance: !current } as unknown as Parameters<
        typeof update.mutateAsync
      >[0]["data"],
    });
    refetch();
  };

  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">{t("admin.countriesTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.addCountry")}</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-3">
          <div>
            <Label>{t("admin.colName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t("admin.colCode")}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={2}
            />
          </div>
          <div>
            <Label>{t("admin.colVisaCenter")}</Label>
            <Input
              value={visaCenter}
              onChange={(e) => setVisaCenter(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="cf"
              type="checkbox"
              checked={requiresCampusFrance}
              onChange={(e) => setRequiresCampusFrance(e.target.checked)}
            />
            <Label htmlFor="cf">{t("admin.colCampusFrance")}</Label>
          </div>
          <div className="flex items-end">
            <Button onClick={submit} data-testid="button-create-country">
              {t("admin.create")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t("table.country")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colCode")}</th>
                <th className="text-left px-4 py-3 font-medium">
                  {t("admin.colCampusFrance")}
                </th>
                <th className="text-left px-4 py-3 font-medium">{t("admin.colVisaCenter")}</th>
              </tr>
            </thead>
            <tbody>
              {(countries as unknown as Country[]).map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-4 py-3 font-medium">
                    <CountryFlag code={c.code} name={c.name} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.code}</td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant={c.requiresCampusFrance ? "default" : "outline"}
                      onClick={() =>
                        toggleCampusFrance(c.id, c.requiresCampusFrance)
                      }
                      data-testid={`button-toggle-cf-${c.id}`}
                    >
                      {c.requiresCampusFrance ? "Requis" : "Non requis"}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.visaCenter ?? "—"}
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
