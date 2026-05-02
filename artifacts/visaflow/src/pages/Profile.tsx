import { useState, useEffect } from "react";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Profile() {
  const { data: me, refetch } = useGetMe();
  const update = useUpdateMe();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });

  useEffect(() => {
    if (me) {
      setForm({
        firstName: me.firstName ?? "",
        lastName: me.lastName ?? "",
        phone: me.phone ?? "",
      });
    }
  }, [me]);

  const save = async () => {
    await update.mutateAsync({ data: form as any });
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
          <Button onClick={save} data-testid="button-save-profile">
            Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
