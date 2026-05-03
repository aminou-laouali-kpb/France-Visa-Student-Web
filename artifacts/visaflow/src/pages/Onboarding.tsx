import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import {
  useCreateStudent,
  useListCountries,
  useListSchools,
} from "@workspace/api-client-react";
import type { Country, School } from "@/types";
import type { CreateStudentBody } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Onboarding() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const create = useCreateStudent();
  const { data: countries = [] } = useListCountries();
  const { data: schools = [] } = useListSchools();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.primaryEmailAddress?.emailAddress ?? "",
    phone: "",
    whatsapp: "",
    dateOfBirth: "",
    countryId: "",
    schoolId: "",
    financingType: "self",
    hasVisaRefusalHistory: false,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const data = {
        ...form,
        countryId: form.countryId ? Number(form.countryId) : undefined,
        schoolId: form.schoolId ? Number(form.schoolId) : undefined,
      };
      await create.mutateAsync({ data: data as unknown as CreateStudentBody });
      setLocation("/app");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Créer mon dossier</CardTitle>
          <p className="text-sm text-slate-600">
            Quelques informations pour démarrer votre parcours.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Prénom *</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                data-testid="input-first-name"
              />
            </div>
            <div>
              <Label>Nom *</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              data-testid="input-email"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Téléphone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Date de naissance</Label>
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </div>
          <div>
            <Label>Pays d'origine *</Label>
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
              value={form.countryId}
              onChange={(e) => setForm({ ...form, countryId: e.target.value })}
              data-testid="select-country"
            >
              <option value="">Sélectionnez votre pays</option>
              {(countries as unknown as Country[]).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>École cible (si connue)</Label>
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
              value={form.schoolId}
              onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
            >
              <option value="">Sélectionnez une école</option>
              {(schools as unknown as School[]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Type de financement</Label>
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
              value={form.financingType}
              onChange={(e) => setForm({ ...form, financingType: e.target.value })}
            >
              <option value="self">Auto-financé</option>
              <option value="bourse">Boursier</option>
              <option value="parents">Parents</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hasVisaRefusalHistory}
              onChange={(e) => setForm({ ...form, hasVisaRefusalHistory: e.target.checked })}
              className="mt-1"
            />
            <span>J'ai déjà eu un refus de visa par le passé</span>
          </label>
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!form.firstName || !form.lastName || !form.email || !form.countryId || submitting}
            data-testid="button-submit-onboarding"
          >
            {submitting ? "Création…" : "Créer mon dossier"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
