import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { twofaApi } from "@/lib/billing";

type UpdateMeBody = {
  firstName: string;
  lastName: string;
  phone: string;
  preferredLanguage?: string;
};

const LANGUAGES: { value: string; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "wo", label: "Wolof" },
  { value: "ln", label: "Lingala" },
  { value: "ar", label: "العربية" },
];
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";

function TwoFactorSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: status, refetch } = useQuery({
    queryKey: ["me", "2fa"],
    queryFn: () => twofaApi.status(),
  });
  const [enrolling, setEnrolling] = useState<{
    qrDataUrl: string;
    otpauthUrl: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEnroll = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await twofaApi.enroll();
      setEnrolling(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verifyEnroll = async () => {
    setError(null);
    setBusy(true);
    try {
      await twofaApi.verify(code.trim());
      setEnrolling(null);
      setCode("");
      await refetch();
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError(null);
    setBusy(true);
    try {
      await twofaApi.disable(code.trim());
      setCode("");
      await refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {status?.enabled ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          ) : (
            <ShieldOff className="w-4 h-4 text-slate-400" />
          )}
          {t("twofa.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status?.enabled ? (
          <>
            <p className="text-emerald-700">{t("twofa.enabled")}</p>
            <Label>{t("twofa.disableLabel")}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
              data-testid="input-2fa-disable-code"
            />
            <Button variant="outline" onClick={disable} disabled={busy || code.length !== 6}>
              {t("twofa.disableBtn")}
            </Button>
          </>
        ) : enrolling ? (
          <>
            <p className="text-slate-700">{t("twofa.scanHint")}</p>
            {enrolling.qrDataUrl ? (
              <img
                src={enrolling.qrDataUrl}
                alt="QR code TOTP"
                className="w-48 h-48 border border-slate-200 rounded"
              />
            ) : null}
            <details>
              <summary className="text-xs text-slate-500 cursor-pointer">
                {t("twofa.manualSecret")}
              </summary>
              <code className="text-xs block mt-1 p-2 bg-slate-100 rounded break-all">
                {enrolling.secret}
              </code>
            </details>
            <Label>{t("twofa.codeLabel")}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
              data-testid="input-2fa-verify-code"
            />
            <div className="flex gap-2">
              <Button onClick={verifyEnroll} disabled={busy || code.length !== 6}>
                {t("twofa.confirm")}
              </Button>
              <Button variant="outline" onClick={() => setEnrolling(null)}>
                {t("twofa.cancel")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-slate-600">{t("twofa.enrollHint")}</p>
            <Button onClick={startEnroll} disabled={busy} data-testid="btn-2fa-enroll">
              {t("twofa.enrollBtn")}
            </Button>
          </>
        )}
        {error ? <p className="text-rose-600 text-xs">{error}</p> : null}
        <div className="pt-3 border-t mt-3">
          <Link href="/app/privacy">
            <a className="text-sm text-blue-600 hover:underline">
              {t("twofa.privacyLink")}
            </a>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function Profile() {
  const { data: me, refetch } = useGetMe();
  const update = useUpdateMe();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    preferredLanguage: "fr",
  });

  useEffect(() => {
    if (me) {
      setForm({
        firstName: me.firstName ?? "",
        lastName: me.lastName ?? "",
        phone: me.phone ?? "",
        preferredLanguage:
          (me as { preferredLanguage?: string | null }).preferredLanguage ?? "fr",
      });
    }
  }, [me]);

  const save = async () => {
    await update.mutateAsync({ data: form as unknown as UpdateMeBody });
    refetch();
  };

  return <ProfileBody me={me} form={form} setForm={setForm} save={save} />;
}

function ProfileBody({
  me,
  form,
  setForm,
  save,
}: {
  me: { email: string; role: string } | null | undefined;
  form: { firstName: string; lastName: string; phone: string; preferredLanguage: string };
  setForm: (f: { firstName: string; lastName: string; phone: string; preferredLanguage: string }) => void;
  save: () => Promise<void>;
}) {
  const { t } = useTranslation();
  if (!me) return <div>{t("common.loading")}</div>;
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">{t("profile.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>{t("profile.info")}</span>
            <Badge variant="outline">{ROLE_LABELS[me.role]}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("profile.email")}</Label>
            <Input value={me.email} disabled />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>{t("profile.firstName")}</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                data-testid="input-first-name"
              />
            </div>
            <div>
              <Label>{t("profile.lastName")}</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div>
            <Label>{t("profile.phone")}</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              data-testid="input-phone"
            />
          </div>
          <div>
            <Label>{t("profile.preferredLanguage")}</Label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              value={form.preferredLanguage}
              onChange={(e) =>
                setForm({ ...form, preferredLanguage: e.target.value })
              }
              data-testid="select-preferred-language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {t("profile.messageTranslateHint")}
            </p>
          </div>
          <Button onClick={save} data-testid="button-save-profile">
            {t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <TwoFactorSection />
      <NotificationPrefsSection />
      <CalendarFeedSection />
    </div>
  );
}

function CalendarFeedSection() {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [webcal, setWebcal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/me/calendar/feed-token", {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) {
        const j = await r.json();
        setUrl(j.httpsUrl);
        setWebcal(j.webcalUrl);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("calendar.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">{t("calendar.subtitle")}</p>
        <Button
          variant="outline"
          onClick={generate}
          disabled={busy}
          data-testid="button-mint-calendar-feed"
        >
          {url ? t("calendar.rotate") : t("calendar.generate")}
        </Button>
        {url && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input value={url} readOnly className="font-mono text-xs" data-testid="input-calendar-feed-url" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? t("common.saved") : t("common.copy")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {webcal && (
                <a
                  href={webcal}
                  className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50"
                  data-testid="link-webcal-subscribe"
                >
                  📅 {t("calendar.subscribe")}
                </a>
              )}
              <a
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50"
              >
                🅖 {t("calendar.subscribeGoogle")}
              </a>
              <a
                href={`https://outlook.live.com/owa?path=/calendar/action/compose&rru=addsubscription&url=${encodeURIComponent(url)}&name=VisaFlow`}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50"
              >
                📨 {t("calendar.subscribeOutlook")}
              </a>
            </div>
            <p className="text-xs text-slate-500">{t("calendar.tokenWarning")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface NotifyPrefs {
  notifyEmail: boolean;
  notifySms: boolean;
  notifyWhatsapp: boolean;
  phone: string | null;
  whatsappNumber: string | null;
  preferredLanguage: string;
}

function NotificationPrefsSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: prefs, refetch } = useQuery({
    queryKey: ["me", "notify-prefs"],
    queryFn: async (): Promise<NotifyPrefs> => {
      const r = await fetch("/api/me/notification-prefs", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });
  const [form, setForm] = useState<NotifyPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (prefs && !form) setForm(prefs);
  }, [prefs, form]);

  if (!form) return null;

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/me/notification-prefs", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSavedAt(Date.now());
      await refetch();
      qc.invalidateQueries({ queryKey: ["me"] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("profile.notificationPrefs")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">{t("notifyPrefs.hint")}</p>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.notifyEmail}
            onChange={(e) => setForm({ ...form, notifyEmail: e.target.checked })}
            data-testid="checkbox-notify-email"
          />
          <span>{t("notifyPrefs.email")}</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.notifySms}
            onChange={(e) => setForm({ ...form, notifySms: e.target.checked })}
            data-testid="checkbox-notify-sms"
          />
          <span>{t("notifyPrefs.sms")}</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.notifyWhatsapp}
            onChange={(e) => setForm({ ...form, notifyWhatsapp: e.target.checked })}
            data-testid="checkbox-notify-whatsapp"
          />
          <span>{t("notifyPrefs.whatsapp")}</span>
        </label>
        <div>
          <Label>{t("notifyPrefs.phoneLabel")}</Label>
          <Input
            value={form.phone ?? ""}
            placeholder="+33612345678"
            onChange={(e) => setForm({ ...form, phone: e.target.value || null })}
            data-testid="input-notify-phone"
          />
        </div>
        <div>
          <Label>{t("notifyPrefs.whatsappLabel")}</Label>
          <Input
            value={form.whatsappNumber ?? ""}
            placeholder="+33612345678"
            onChange={(e) =>
              setForm({ ...form, whatsappNumber: e.target.value || null })
            }
            data-testid="input-notify-whatsapp"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving} data-testid="button-save-notify-prefs">
            {saving ? t("notifyPrefs.saving") : t("notifyPrefs.save")}
          </Button>
          {savedAt && (
            <span className="text-xs text-emerald-600">{t("notifyPrefs.saved")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
