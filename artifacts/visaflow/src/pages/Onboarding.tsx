import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import {
  useCreateStudent,
  useListCountries,
  useListSchools,
  useUpsertStudentCivilStatus,
  useCreatePriorSchoolingEntry,
  useCreateLanguageTest,
  useListPrograms,
} from "@workspace/api-client-react";
import type { Country, School } from "@/types";
import type {
  CreateStudentBody,
  UpsertStudentCivilStatusBody,
  CreatePriorSchoolingEntryBody,
  CreateLanguageTestBody,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Trash2 } from "lucide-react";

const TEST_TYPES = [
  "TCF",
  "TCF_DAP",
  "TCF_QUEBEC",
  "TEF",
  "DELF",
  "DALF",
  "IELTS",
  "TOEFL",
  "OTHER",
];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
type DraftState = {
  step: number;
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    whatsapp: string;
    dateOfBirth: string;
    countryId: string;
    schoolId: string;
    financingType: string;
    hasVisaRefusalHistory: boolean;
  };
  civil: {
    maritalStatus: string;
    birthCity: string;
    birthCountryCode: string;
    fatherFirstName: string;
    fatherLastName: string;
    fatherProfession: string;
    motherFirstName: string;
    motherLastName: string;
    motherProfession: string;
    numberOfSiblings: string;
  };
  schooling: Array<{
    institutionName: string;
    startYear: string;
    endYear: string;
    diplomaOrLevel: string;
    city: string;
    countryCode: string;
    finalGrade: string;
  }>;
  languageTests: Array<{
    testType: string;
    level: string;
    overallScore: string;
    testDate: string;
    expiryDate: string;
  }>;
  admission: {
    programId: string;
    intakeDate: string;
    programNameFreeText: string;
  };
};

const DRAFT_KEY_PREFIX = "visaflow.onboardingDraft.v1.";

function getDraftKey(userId: string | null | undefined): string {
  return `${DRAFT_KEY_PREFIX}${userId ?? "anon"}`;
}

function clearStaleDrafts(currentKey: string) {
  // Remove any other onboarding drafts (e.g. previous user on shared browser)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DRAFT_KEY_PREFIX) && k !== currentKey) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

const TOTAL_STEPS = 5;

function emptyDraft(prefill?: Partial<DraftState["identity"]>): DraftState {
  return {
    step: 1,
    identity: {
      firstName: prefill?.firstName ?? "",
      lastName: prefill?.lastName ?? "",
      email: prefill?.email ?? "",
      phone: "",
      whatsapp: "",
      dateOfBirth: "",
      countryId: "",
      schoolId: "",
      financingType: "self",
      hasVisaRefusalHistory: false,
    },
    civil: {
      maritalStatus: "",
      birthCity: "",
      birthCountryCode: "",
      fatherFirstName: "",
      fatherLastName: "",
      fatherProfession: "",
      motherFirstName: "",
      motherLastName: "",
      motherProfession: "",
      numberOfSiblings: "",
    },
    schooling: [],
    languageTests: [],
    admission: {
      programId: "",
      intakeDate: "",
      programNameFreeText: "",
    },
  };
}

export function Onboarding() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const create = useCreateStudent();
  const upsertCivil = useUpsertStudentCivilStatus();
  const createSchooling = useCreatePriorSchoolingEntry();
  const createTest = useCreateLanguageTest();
  const { data: programs = [] } = useListPrograms();
  const { data: countries = [] } = useListCountries();
  const { data: schools = [] } = useListSchools();

  const draftKey = getDraftKey(user?.id);
  const [draft, setDraft] = useState<DraftState>(() => {
    clearStaleDrafts(draftKey);
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) return { ...emptyDraft(), ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return emptyDraft({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.primaryEmailAddress?.emailAddress ?? "",
    });
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // persist draft (per-user)
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, draftKey]);

  const setStep = (n: number) => setDraft({ ...draft, step: n });

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // 1. Create student
      const id = draft.identity;
      const studentBody: any = {
        ...id,
        countryId: id.countryId ? Number(id.countryId) : undefined,
        schoolId: id.schoolId ? Number(id.schoolId) : undefined,
        programId: draft.admission.programId
          ? Number(draft.admission.programId)
          : undefined,
        intakeDate: draft.admission.intakeDate || undefined,
      };
      Object.keys(studentBody).forEach(
        (k) => studentBody[k] === "" && delete studentBody[k],
      );
      const created = (await create.mutateAsync({
        data: studentBody as unknown as CreateStudentBody,
      })) as any;
      const studentId: number = created.id;

      // 2. Civil status
      const civilBody: any = { ...draft.civil };
      civilBody.numberOfSiblings = civilBody.numberOfSiblings
        ? Number(civilBody.numberOfSiblings)
        : undefined;
      Object.keys(civilBody).forEach(
        (k) =>
          (civilBody[k] === "" || civilBody[k] === undefined) &&
          delete civilBody[k],
      );
      if (Object.keys(civilBody).length > 0) {
        await upsertCivil.mutateAsync({
          studentId,
          data: civilBody as unknown as UpsertStudentCivilStatusBody,
        });
      }

      // 3. Prior schooling
      for (const e of draft.schooling) {
        const body: any = { ...e };
        body.startYear = body.startYear ? Number(body.startYear) : undefined;
        body.endYear = body.endYear ? Number(body.endYear) : undefined;
        Object.keys(body).forEach(
          (k) =>
            (body[k] === "" || body[k] === undefined) && delete body[k],
        );
        if (!body.institutionName) continue;
        await createSchooling.mutateAsync({
          studentId,
          data: body as unknown as CreatePriorSchoolingEntryBody,
        });
      }

      // 4. Language tests
      for (const t of draft.languageTests) {
        const body: any = { ...t };
        Object.keys(body).forEach((k) => body[k] === "" && delete body[k]);
        if (!body.testType) continue;
        await createTest.mutateAsync({
          studentId,
          data: body as unknown as CreateLanguageTestBody,
        });
      }


      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setLocation("/app");
    } catch (e: any) {
      setError(e?.message ?? "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmitIdentity =
    draft.identity.firstName &&
    draft.identity.lastName &&
    draft.identity.email &&
    draft.identity.countryId &&
    draft.identity.schoolId;

  const canSubmitAdmission =
    draft.admission.intakeDate &&
    (draft.admission.programId || draft.admission.programNameFreeText.trim());

  const stepLabels = [
    "Identité",
    "État civil",
    "Parcours scolaire",
    "Tests de langue",
    "Admission reçue",
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Créer mon dossier</CardTitle>
          <p className="text-sm text-slate-600">
            Étape {draft.step} sur {TOTAL_STEPS} — vos informations sont
            enregistrées automatiquement, vous pouvez reprendre plus tard.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {stepLabels.map((lbl, i) => {
              const n = i + 1;
              const done = n < draft.step;
              const active = n === draft.step;
              return (
                <button
                  key={n}
                  type="button"
                  className={`text-xs px-3 py-1 rounded-full border ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : done
                        ? "bg-green-50 text-green-700 border-green-300"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                  onClick={() => setStep(n)}
                  data-testid={`stepper-${n}`}
                >
                  {done && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                  {n}. {lbl}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.step === 1 && (
            <IdentityStep draft={draft} setDraft={setDraft} countries={countries} schools={schools} />
          )}
          {draft.step === 2 && <CivilStep draft={draft} setDraft={setDraft} />}
          {draft.step === 3 && <SchoolingStep draft={draft} setDraft={setDraft} />}
          {draft.step === 4 && <TestsStep draft={draft} setDraft={setDraft} />}
          {draft.step === 5 && <AdmissionStep draft={draft} setDraft={setDraft} programs={programs} />}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              disabled={draft.step <= 1}
              onClick={() => setStep(draft.step - 1)}
              data-testid="button-prev-step"
            >
              Précédent
            </Button>
            {draft.step < TOTAL_STEPS ? (
              <Button
                onClick={() => setStep(draft.step + 1)}
                disabled={draft.step === 1 && !canSubmitIdentity}
                data-testid="button-next-step"
              >
                Suivant
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={!canSubmitIdentity || !canSubmitAdmission || submitting}
                data-testid="button-submit-onboarding"
              >
                {submitting ? "Création…" : "Créer mon dossier"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IdentityStep({
  draft,
  setDraft,
  countries,
  schools,
}: {
  draft: DraftState;
  setDraft: (d: DraftState) => void;
  countries: any;
  schools: any;
}) {
  const f = draft.identity;
  const set = (k: keyof DraftState["identity"], v: any) =>
    setDraft({ ...draft, identity: { ...f, [k]: v } });
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} data-testid="input-first-name" />
        </div>
        <div>
          <Label>Nom *</Label>
          <Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} data-testid="input-last-name" />
        </div>
      </div>
      <div>
        <Label>Email *</Label>
        <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} data-testid="input-email" />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Téléphone</Label>
          <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Date de naissance</Label>
        <Input type="date" value={f.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
      </div>
      <div>
        <Label>Pays d'origine *</Label>
        <select
          className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
          value={f.countryId}
          onChange={(e) => set("countryId", e.target.value)}
          data-testid="select-country"
        >
          <option value="">Sélectionnez votre pays</option>
          {(countries as Country[]).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>École privée d'admission *</Label>
        <select
          className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
          value={f.schoolId}
          onChange={(e) => set("schoolId", e.target.value)}
        >
          <option value="">Sélectionnez votre école</option>
          {(schools as School[]).map((s) => (
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
          value={f.financingType}
          onChange={(e) => set("financingType", e.target.value)}
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
          checked={f.hasVisaRefusalHistory}
          onChange={(e) => set("hasVisaRefusalHistory", e.target.checked)}
          className="mt-1"
        />
        <span>J'ai déjà eu un refus de visa par le passé</span>
      </label>
    </div>
  );
}

function CivilStep({ draft, setDraft }: { draft: DraftState; setDraft: (d: DraftState) => void }) {
  const c = draft.civil;
  const set = (k: keyof DraftState["civil"], v: any) =>
    setDraft({ ...draft, civil: { ...c, [k]: v } });
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>État civil</Label>
          <select
            className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
            value={c.maritalStatus}
            onChange={(e) => set("maritalStatus", e.target.value)}
          >
            <option value="">—</option>
            <option value="single">Célibataire</option>
            <option value="married">Marié(e)</option>
            <option value="divorced">Divorcé(e)</option>
            <option value="widowed">Veuf(ve)</option>
            <option value="other">Autre</option>
          </select>
        </div>
        <div>
          <Label>Frères et sœurs</Label>
          <Input
            type="number"
            min={0}
            value={c.numberOfSiblings}
            onChange={(e) => set("numberOfSiblings", e.target.value)}
          />
        </div>
        <div>
          <Label>Ville de naissance</Label>
          <Input value={c.birthCity} onChange={(e) => set("birthCity", e.target.value)} />
        </div>
        <div>
          <Label>Pays de naissance (code ISO)</Label>
          <Input value={c.birthCountryCode} onChange={(e) => set("birthCountryCode", e.target.value)} />
        </div>
      </div>
      <div className="border-t pt-3">
        <div className="font-medium text-sm text-slate-700 mb-2">Père</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Prénom" value={c.fatherFirstName} onChange={(e) => set("fatherFirstName", e.target.value)} />
          <Input placeholder="Nom" value={c.fatherLastName} onChange={(e) => set("fatherLastName", e.target.value)} />
          <Input placeholder="Profession" value={c.fatherProfession} onChange={(e) => set("fatherProfession", e.target.value)} />
        </div>
      </div>
      <div>
        <div className="font-medium text-sm text-slate-700 mb-2">Mère</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Prénom" value={c.motherFirstName} onChange={(e) => set("motherFirstName", e.target.value)} />
          <Input placeholder="Nom" value={c.motherLastName} onChange={(e) => set("motherLastName", e.target.value)} />
          <Input placeholder="Profession" value={c.motherProfession} onChange={(e) => set("motherProfession", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function SchoolingStep({ draft, setDraft }: { draft: DraftState; setDraft: (d: DraftState) => void }) {
  const items = draft.schooling;
  const add = () =>
    setDraft({
      ...draft,
      schooling: [
        ...items,
        {
          institutionName: "",
          startYear: "",
          endYear: "",
          diplomaOrLevel: "",
          city: "",
          countryCode: "",
          finalGrade: "",
        },
      ],
    });
  const remove = (i: number) =>
    setDraft({ ...draft, schooling: items.filter((_, idx) => idx !== i) });
  const update = (i: number, patch: Partial<DraftState["schooling"][number]>) =>
    setDraft({
      ...draft,
      schooling: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    });
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Indiquez vos 5 dernières années de scolarité (les plus récentes en premier).
      </p>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 bg-slate-50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-600">Entrée #{i + 1}</span>
            <Button size="icon" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
          <Input placeholder="Établissement *" value={it.institutionName} onChange={(e) => update(i, { institutionName: e.target.value })} data-testid={`input-schooling-name-${i}`} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Année début" value={it.startYear} onChange={(e) => update(i, { startYear: e.target.value })} />
            <Input type="number" placeholder="Année fin" value={it.endYear} onChange={(e) => update(i, { endYear: e.target.value })} />
          </div>
          <Input placeholder="Diplôme / Niveau" value={it.diplomaOrLevel} onChange={(e) => update(i, { diplomaOrLevel: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Ville" value={it.city} onChange={(e) => update(i, { city: e.target.value })} />
            <Input placeholder="Pays (code ISO)" value={it.countryCode} onChange={(e) => update(i, { countryCode: e.target.value })} />
          </div>
          <Input placeholder="Mention / Note" value={it.finalGrade} onChange={(e) => update(i, { finalGrade: e.target.value })} />
        </div>
      ))}
      <Button variant="outline" onClick={add} data-testid="button-add-schooling-row">
        + Ajouter une entrée
      </Button>
    </div>
  );
}

function TestsStep({ draft, setDraft }: { draft: DraftState; setDraft: (d: DraftState) => void }) {
  const items = draft.languageTests;
  const add = () =>
    setDraft({
      ...draft,
      languageTests: [
        ...items,
        {
          testType: "TCF",
          level: "",
          overallScore: "",
          testDate: "",
          expiryDate: "",
        },
      ],
    });
  const remove = (i: number) =>
    setDraft({ ...draft, languageTests: items.filter((_, idx) => idx !== i) });
  const update = (
    i: number,
    patch: Partial<DraftState["languageTests"][number]>,
  ) =>
    setDraft({
      ...draft,
      languageTests: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    });
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Ajoutez vos résultats TCF / TEF / DELF / DALF (vous pourrez les compléter plus tard).
      </p>
      {items.map((it, i) => (
        <div key={i} className="border rounded-lg p-3 bg-slate-50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-600">Test #{i + 1}</span>
            <Button size="icon" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="border rounded-lg px-3 py-2 bg-white"
              value={it.testType}
              onChange={(e) => update(i, { testType: e.target.value })}
              data-testid={`select-test-type-${i}`}
            >
              {TEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="border rounded-lg px-3 py-2 bg-white"
              value={it.level}
              onChange={(e) => update(i, { level: e.target.value })}
            >
              <option value="">Niveau</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <Input placeholder="Score" value={it.overallScore} onChange={(e) => update(i, { overallScore: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-slate-500">Date du test</Label>
              <Input type="date" value={it.testDate} onChange={(e) => update(i, { testDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Date d'expiration</Label>
              <Input type="date" value={it.expiryDate} onChange={(e) => update(i, { expiryDate: e.target.value })} />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={add} data-testid="button-add-test-row">
        + Ajouter un test
      </Button>
    </div>
  );
}

function AdmissionStep({
  draft,
  setDraft,
  programs,
}: {
  draft: DraftState;
  setDraft: (d: DraftState) => void;
  programs: { id: number; schoolId: number; name: string }[];
}) {
  const a = draft.admission;
  const schoolId = draft.identity.schoolId ? Number(draft.identity.schoolId) : null;
  const schoolPrograms = programs.filter((p) => p.schoolId === schoolId);
  const set = (k: keyof DraftState["admission"], v: string) =>
    setDraft({ ...draft, admission: { ...a, [k]: v } });

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Vous avez reçu votre admission dans une école privée — confirmez le programme
        et la date de rentrée pour démarrer votre procédure visa.
      </p>
      <div>
        <Label>Programme *</Label>
        {schoolPrograms.length > 0 ? (
          <select
            className="w-full mt-1 border rounded-lg px-3 py-2 bg-white"
            value={a.programId}
            onChange={(e) => set("programId", e.target.value)}
            data-testid="select-program"
          >
            <option value="">Sélectionnez le programme</option>
            {schoolPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <Input
            placeholder="Nom du programme (texte libre) *"
            value={a.programNameFreeText}
            onChange={(e) => set("programNameFreeText", e.target.value)}
            data-testid="input-program-free-text"
          />
        )}
      </div>
      {schoolPrograms.length > 0 && (
        <Input
          placeholder="Programme (texte libre, si absent du catalogue)"
          value={a.programNameFreeText}
          onChange={(e) => set("programNameFreeText", e.target.value)}
        />
      )}
      <div>
        <Label>Date de rentrée prévue *</Label>
        <Input
          type="date"
          value={a.intakeDate}
          onChange={(e) => set("intakeDate", e.target.value)}
          data-testid="input-intake-date"
        />
      </div>
      <p className="text-xs text-slate-500">
        Vous pourrez téléverser votre lettre d'admission dès la création du dossier,
        dans l'onglet Documents.
      </p>
    </div>
  );
}
