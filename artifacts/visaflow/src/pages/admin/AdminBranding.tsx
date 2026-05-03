import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tenantApi, type TenantSettings } from "@/lib/billing";
import { useTranslation } from "react-i18next";

export function AdminBranding() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tenant", "settings"],
    queryFn: () => tenantApi.settings(),
  });
  const [form, setForm] = useState<Partial<TenantSettings>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "",
        subdomain: data.subdomain ?? "",
        logoUrl: data.logoUrl ?? "",
        primaryColor: data.primaryColor ?? "",
        emailFromName: data.emailFromName ?? "",
        emailFromAddress: data.emailFromAddress ?? "",
        ipAllowlist: data.ipAllowlist ?? "",
        twoFactorRequired: !!data.twoFactorRequired,
      });
    }
  }, [data]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await tenantApi.update(form);
      await qc.invalidateQueries({ queryKey: ["tenant"] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="text-sm text-slate-500">{t("branding.loading")}</div>;

  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {t("branding.title")}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("branding.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("branding.agencyId")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("branding.tradeName")}</Label>
            <Input
              value={(form.name as string) ?? ""}
              onChange={(e) => set("name", e.target.value)}
              data-testid="input-tenant-name"
            />
          </div>
          <div>
            <Label>{t("branding.subdomain")}</Label>
            <Input
              value={(form.subdomain as string) ?? ""}
              placeholder="agency-a"
              onChange={(e) => set("subdomain", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("branding.logoUrl")}</Label>
            <Input
              value={(form.logoUrl as string) ?? ""}
              placeholder="https://…/logo.png"
              onChange={(e) => set("logoUrl", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("branding.primaryColor")}</Label>
            <div className="flex gap-2 items-center">
              <Input
                value={(form.primaryColor as string) ?? ""}
                placeholder="#1d4ed8"
                onChange={(e) => set("primaryColor", e.target.value)}
                className="flex-1"
              />
              <div
                className="w-10 h-10 rounded border border-slate-200"
                style={{ background: (form.primaryColor as string) || "#1d4ed8" }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("branding.emailSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>{t("branding.emailFromName")}</Label>
              <Input
                value={(form.emailFromName as string) ?? ""}
                onChange={(e) => set("emailFromName", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("branding.emailFromAddress")}</Label>
              <Input
                value={(form.emailFromAddress as string) ?? ""}
                placeholder="contact@agence.fr"
                onChange={(e) => set("emailFromAddress", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("branding.securitySection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("branding.ipAllowlist")}</Label>
            <Textarea
              value={(form.ipAllowlist as string) ?? ""}
              placeholder="203.0.113.0/24, 198.51.100.42/32"
              rows={3}
              onChange={(e) => set("ipAllowlist", e.target.value)}
              data-testid="input-ip-allowlist"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.twoFactorRequired}
              onChange={(e) => set("twoFactorRequired", e.target.checked)}
              data-testid="toggle-2fa-required"
            />
            <span>{t("branding.require2fa")}</span>
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving} data-testid="btn-save-branding">
          {saving ? t("branding.saving") : t("branding.save")}
        </Button>
        {success ? (
          <span className="text-sm text-emerald-600">{t("branding.saveSuccess")} ✓</span>
        ) : null}
        {error ? <span className="text-sm text-rose-600">{error}</span> : null}
      </div>
    </div>
  );
}
