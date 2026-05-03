import { useState, useEffect } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";

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

  if (!me) return <div>Chargement…</div>;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Mon profil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Informations</span>
            <Badge variant="outline">{ROLE_LABELS[me.role]}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input value={me.email} disabled />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Prénom</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                data-testid="input-first-name"
              />
            </div>
            <div>
              <Label>Nom</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              data-testid="input-phone"
            />
          </div>
          <div>
            <Label>Langue préférée pour la messagerie</Label>
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
              Vos messages seront automatiquement traduits dans cette langue.
            </p>
          </div>
          <Button onClick={save} data-testid="button-save-profile">
            Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
