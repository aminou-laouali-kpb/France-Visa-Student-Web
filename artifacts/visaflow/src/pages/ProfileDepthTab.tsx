import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetStudentProfileDepth,
  useUpsertStudentCivilStatus,
  useListPriorSchooling,
  useCreatePriorSchoolingEntry,
  useDeletePriorSchoolingEntry,
  useListLanguageTests,
  useCreateLanguageTest,
  useDeleteLanguageTest,
  useListDiplomaEquivalences,
  useCreateDiplomaEquivalence,
  useDeleteDiplomaEquivalence,
  useListEefWishes,
  useCreateEefWish,
  useDeleteEefWish,
  useListSchools,
} from "@workspace/api-client-react";
import type {
  UpsertStudentCivilStatusBody,
  CreatePriorSchoolingEntryBody,
  CreateLanguageTestBody,
  CreateDiplomaEquivalenceBody,
  CreateEefWishBody,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Trash2, Plus } from "lucide-react";

const TEST_TYPES = [
  "TCF",
  "TCF_DAP",
  "TCF_TP",
  "TCF_QUEBEC",
  "TEF",
  "TEFAQ",
  "DELF",
  "DALF",
  "DILF",
  "IELTS",
  "TOEFL",
  "OTHER",
];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const EEF_STATUSES = [
  "draft",
  "submitted",
  "accepted",
  "refused",
  "waitlist",
  "withdrawn",
];
const EQUIV_STATUSES = ["not_requested", "requested", "received", "not_required"];
const MAX_WISHES = 7;

export function ProfileDepthTab({ studentId }: { studentId: number }) {
  const { t } = useTranslation();
  const { data: depth, refetch } = useGetStudentProfileDepth(studentId);

  if (!depth) return <div className="p-4 text-slate-500">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">
              Complétude du profil approfondi
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {depth.profileCompletenessScore}%
            </div>
            <Progress
              value={depth.profileCompletenessScore}
              className="w-48 h-2 mt-1"
            />
          </div>
          {depth.expiringLanguageTests.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-md">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-amber-900">
                  Test(s) de langue à renouveler
                </div>
                {depth.expiringLanguageTests.map((t) => (
                  <div key={t.id} className="text-amber-800">
                    {t.testType} expire dans {t.daysUntilExpiry} jours
                    {t.expiryDate ? ` (${t.expiryDate})` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CivilStatusCard studentId={studentId} initial={depth.civilStatus} onChange={refetch} />
      <PriorSchoolingCard studentId={studentId} onChange={refetch} />
      <LanguageTestsCard studentId={studentId} onChange={refetch} />
      <DiplomaEquivalencesCard studentId={studentId} onChange={refetch} />
      <EefWishesCard studentId={studentId} onChange={refetch} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CivilStatusCard({
  studentId,
  initial,
  onChange,
}: {
  studentId: number;
  initial: any;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const upsert = useUpsertStudentCivilStatus();
  const [form, setForm] = useState<Record<string, any>>(initial ?? {});
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const save = async () => {
    const body: any = { ...form };
    delete body.id;
    delete body.studentId;
    delete body.createdAt;
    delete body.updatedAt;
    // empty strings -> undefined
    Object.keys(body).forEach((k) => {
      if (body[k] === "" || body[k] === null) delete body[k];
    });
    await upsert.mutateAsync({
      studentId,
      data: body as unknown as UpsertStudentCivilStatusBody,
    });
    onChange();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("depth.civilTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <Field label={t("depth.maritalStatus")}>
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={form.maritalStatus ?? ""}
              onChange={(e) => set("maritalStatus", e.target.value || undefined)}
            >
              <option value="">—</option>
              <option value="single">{t("depth.maritalSingle")}</option>
              <option value="married">{t("depth.maritalMarried")}</option>
              <option value="divorced">{t("depth.maritalDivorced")}</option>
              <option value="widowed">{t("depth.maritalWidowed")}</option>
              <option value="other">{t("depth.maritalOther")}</option>
            </select>
          </Field>
          <Field label={t("depth.birthCity")}>
            <Input
              value={form.birthCity ?? ""}
              onChange={(e) => set("birthCity", e.target.value)}
            />
          </Field>
          <Field label={t("depth.birthCountry")}>
            <Input
              value={form.birthCountryCode ?? ""}
              onChange={(e) => set("birthCountryCode", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label={t("depth.address")}>
            <Input
              value={form.addressLine ?? ""}
              onChange={(e) => set("addressLine", e.target.value)}
            />
          </Field>
          <Field label={t("depth.city")}>
            <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label={t("depth.postalCode")}>
            <Input
              value={form.postalCode ?? ""}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label={t("depth.fatherFirstName")}>
            <Input
              value={form.fatherFirstName ?? ""}
              onChange={(e) => set("fatherFirstName", e.target.value)}
            />
          </Field>
          <Field label={t("depth.fatherLastName")}>
            <Input
              value={form.fatherLastName ?? ""}
              onChange={(e) => set("fatherLastName", e.target.value)}
            />
          </Field>
          <Field label={t("depth.fatherProfession")}>
            <Input
              value={form.fatherProfession ?? ""}
              onChange={(e) => set("fatherProfession", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label={t("depth.motherFirstName")}>
            <Input
              value={form.motherFirstName ?? ""}
              onChange={(e) => set("motherFirstName", e.target.value)}
            />
          </Field>
          <Field label={t("depth.motherLastName")}>
            <Input
              value={form.motherLastName ?? ""}
              onChange={(e) => set("motherLastName", e.target.value)}
            />
          </Field>
          <Field label={t("depth.motherProfession")}>
            <Input
              value={form.motherProfession ?? ""}
              onChange={(e) => set("motherProfession", e.target.value)}
            />
          </Field>
        </div>
        <Field label={t("depth.siblings")}>
          <Input
            type="number"
            min={0}
            value={form.numberOfSiblings ?? ""}
            onChange={(e) =>
              set(
                "numberOfSiblings",
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
            className="w-32"
          />
        </Field>
        <Button onClick={save} data-testid="button-save-civil-status">
          {t("common.save")}
        </Button>
      </CardContent>
    </Card>
  );
}

function PriorSchoolingCard({
  studentId,
  onChange,
}: {
  studentId: number;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const { data: entries = [], refetch } = useListPriorSchooling(studentId);
  const create = useCreatePriorSchoolingEntry();
  const del = useDeletePriorSchoolingEntry();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    institutionName: "",
    startYear: "",
    endYear: "",
    diplomaOrLevel: "",
    countryCode: "",
    city: "",
    finalGrade: "",
    mainSubjects: "",
  });
  const handleAdd = async () => {
    if (!form.institutionName.trim()) return;
    const data: any = { ...form };
    if (data.startYear) data.startYear = Number(data.startYear);
    else delete data.startYear;
    if (data.endYear) data.endYear = Number(data.endYear);
    else delete data.endYear;
    Object.keys(data).forEach((k) => data[k] === "" && delete data[k]);
    await create.mutateAsync({
      studentId,
      data: data as unknown as CreatePriorSchoolingEntryBody,
    });
    setForm({
      institutionName: "",
      startYear: "",
      endYear: "",
      diplomaOrLevel: "",
      countryCode: "",
      city: "",
      finalGrade: "",
      mainSubjects: "",
    });
    setShow(false);
    refetch();
    onChange();
  };
  const handleDelete = async (id: number) => {
    await del.mutateAsync({ studentId, entryId: id });
    refetch();
    onChange();
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("depth.schoolingTitle")}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShow(!show)}>
          <Plus className="w-4 h-4 mr-1" /> {t("depth.addEntry")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {show && (
          <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("depth.institution")}>
                <Input
                  value={form.institutionName}
                  onChange={(e) =>
                    setForm({ ...form, institutionName: e.target.value })
                  }
                  data-testid="input-school-name"
                />
              </Field>
              <Field label={t("depth.diploma")}>
                <Input
                  value={form.diplomaOrLevel}
                  onChange={(e) =>
                    setForm({ ...form, diplomaOrLevel: e.target.value })
                  }
                />
              </Field>
              <Field label={t("depth.startYear")}>
                <Input
                  type="number"
                  value={form.startYear}
                  onChange={(e) => setForm({ ...form, startYear: e.target.value })}
                />
              </Field>
              <Field label={t("depth.endYear")}>
                <Input
                  type="number"
                  value={form.endYear}
                  onChange={(e) => setForm({ ...form, endYear: e.target.value })}
                />
              </Field>
              <Field label={t("depth.schoolCity")}>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
              <Field label={t("depth.schoolCountry")}>
                <Input
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                />
              </Field>
              <Field label={t("depth.schoolGrade")}>
                <Input
                  value={form.finalGrade}
                  onChange={(e) => setForm({ ...form, finalGrade: e.target.value })}
                />
              </Field>
              <Field label={t("depth.schoolMajors")}>
                <Input
                  value={form.mainSubjects}
                  onChange={(e) =>
                    setForm({ ...form, mainSubjects: e.target.value })
                  }
                />
              </Field>
            </div>
            <Button
              onClick={handleAdd}
              disabled={!form.institutionName.trim()}
              data-testid="button-add-schooling"
            >
              Ajouter
            </Button>
          </div>
        )}
        {entries.length === 0 ? (
          <div className="text-sm text-slate-500">{t("depth.noEntries")}</div>
        ) : (
          <div className="divide-y">
            {(entries as any[]).map((e) => (
              <div key={e.id} className="py-3 flex items-start justify-between">
                <div>
                  <div className="font-medium">{e.institutionName}</div>
                  <div className="text-sm text-slate-600">
                    {e.diplomaOrLevel}
                    {e.startYear || e.endYear
                      ? ` · ${e.startYear ?? "?"} – ${e.endYear ?? "?"}`
                      : ""}
                    {e.city ? ` · ${e.city}` : ""}
                    {e.countryCode ? ` (${e.countryCode})` : ""}
                  </div>
                  {e.finalGrade && (
                    <div className="text-xs text-slate-500">
                      Mention : {e.finalGrade}
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(e.id)}
                  data-testid={`button-delete-schooling-${e.id}`}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LanguageTestsCard({
  studentId,
  onChange,
}: {
  studentId: number;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const { data: tests = [], refetch } = useListLanguageTests(studentId);
  const create = useCreateLanguageTest();
  const del = useDeleteLanguageTest();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    testType: "TCF",
    language: "french",
    overallScore: "",
    level: "",
    testDate: "",
    expiryDate: "",
  });
  const handleAdd = async () => {
    const data: any = { ...form };
    Object.keys(data).forEach((k) => data[k] === "" && delete data[k]);
    await create.mutateAsync({
      studentId,
      data: data as unknown as CreateLanguageTestBody,
    });
    setForm({
      testType: "TCF",
      language: "french",
      overallScore: "",
      level: "",
      testDate: "",
      expiryDate: "",
    });
    setShow(false);
    refetch();
    onChange();
  };
  const handleDelete = async (id: number) => {
    await del.mutateAsync({ studentId, testId: id });
    refetch();
    onChange();
  };
  const today = new Date();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("depth.langTestsTitle")}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShow(!show)}>
          <Plus className="w-4 h-4 mr-1" /> {t("depth.addEntry")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {show && (
          <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={t("depth.langType")}>
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={form.testType}
                  onChange={(e) => setForm({ ...form, testType: e.target.value })}
                  data-testid="select-test-type"
                >
                  {TEST_TYPES.map((tp) => (
                    <option key={tp} value={tp}>
                      {tp}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("depth.langLanguage")}>
                <Input
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                />
              </Field>
              <Field label={t("depth.langLevel")}>
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                >
                  <option value="">—</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("depth.langScore")}>
                <Input
                  value={form.overallScore}
                  onChange={(e) =>
                    setForm({ ...form, overallScore: e.target.value })
                  }
                  data-testid="input-test-score"
                />
              </Field>
              <Field label={t("depth.langTestDate")}>
                <Input
                  type="date"
                  value={form.testDate}
                  onChange={(e) => setForm({ ...form, testDate: e.target.value })}
                />
              </Field>
              <Field label={t("depth.langExpiry")}>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  data-testid="input-test-expiry"
                />
              </Field>
            </div>
            <Button onClick={handleAdd} data-testid="button-add-test">
              {t("depth.addEntry")}
            </Button>
          </div>
        )}
        {tests.length === 0 ? (
          <div className="text-sm text-slate-500">{t("depth.noEntries")}</div>
        ) : (
          <div className="divide-y">
            {(tests as any[]).map((t) => {
              const exp = t.expiryDate ? new Date(t.expiryDate) : null;
              const days = exp
                ? Math.ceil(
                    (exp.getTime() - today.getTime()) / (86400 * 1000),
                  )
                : null;
              const expSoon = days !== null && days > 0 && days <= 90;
              const expired = days !== null && days <= 0;
              return (
                <div key={t.id} className="py-3 flex items-start justify-between">
                  <div>
                    <div className="font-medium">
                      {t.testType}{" "}
                      {t.level && (
                        <span className="text-blue-600">· {t.level}</span>
                      )}
                      {t.overallScore && (
                        <span className="text-slate-600 ml-2">
                          score {t.overallScore}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">
                      {t.testDate && `Passé le ${t.testDate}`}
                      {t.expiryDate && ` · expire le ${t.expiryDate}`}
                    </div>
                    {expSoon && (
                      <div className="text-xs text-amber-700 font-medium mt-1">
                        ⚠ Expire dans {days} jour(s) — à renouveler
                      </div>
                    )}
                    {expired && (
                      <div className="text-xs text-red-700 font-medium mt-1">
                        ⚠ Expiré
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiplomaEquivalencesCard({
  studentId,
  onChange,
}: {
  studentId: number;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const { data: entries = [], refetch } = useListDiplomaEquivalences(studentId);
  const create = useCreateDiplomaEquivalence();
  const del = useDeleteDiplomaEquivalence();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    originalDiploma: "",
    originalCountryCode: "",
    equivalentLevel: "",
    enicNaricRef: "",
    status: "not_requested",
    notes: "",
  });
  const handleAdd = async () => {
    if (!form.originalDiploma.trim()) return;
    const data: any = { ...form };
    Object.keys(data).forEach((k) => data[k] === "" && delete data[k]);
    await create.mutateAsync({
      studentId,
      data: data as unknown as CreateDiplomaEquivalenceBody,
    });
    setForm({
      originalDiploma: "",
      originalCountryCode: "",
      equivalentLevel: "",
      enicNaricRef: "",
      status: "not_requested",
      notes: "",
    });
    setShow(false);
    refetch();
    onChange();
  };
  const handleDelete = async (id: number) => {
    await del.mutateAsync({ studentId, equivId: id });
    refetch();
    onChange();
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t("depth.equivTitle")}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShow(!show)}>
          <Plus className="w-4 h-4 mr-1" /> {t("depth.addEntry")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {show && (
          <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("depth.equivDiploma")}>
                <Input
                  value={form.originalDiploma}
                  onChange={(e) =>
                    setForm({ ...form, originalDiploma: e.target.value })
                  }
                />
              </Field>
              <Field label={t("depth.equivCountry")}>
                <Input
                  value={form.originalCountryCode}
                  onChange={(e) =>
                    setForm({ ...form, originalCountryCode: e.target.value })
                  }
                />
              </Field>
              <Field label={t("depth.equivLevel")}>
                <Input
                  value={form.equivalentLevel}
                  onChange={(e) =>
                    setForm({ ...form, equivalentLevel: e.target.value })
                  }
                />
              </Field>
              <Field label={t("depth.equivRef")}>
                <Input
                  value={form.enicNaricRef}
                  onChange={(e) =>
                    setForm({ ...form, enicNaricRef: e.target.value })
                  }
                />
              </Field>
              <Field label={t("depth.equivStatus")}>
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {EQUIV_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("common.notes")}>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <Button
              onClick={handleAdd}
              disabled={!form.originalDiploma.trim()}
            >
              {t("depth.addEntry")}
            </Button>
          </div>
        )}
        {entries.length === 0 ? (
          <div className="text-sm text-slate-500">
            {t("depth.noEntries")}
          </div>
        ) : (
          <div className="divide-y">
            {(entries as any[]).map((e) => (
              <div key={e.id} className="py-3 flex items-start justify-between">
                <div>
                  <div className="font-medium">{e.originalDiploma}</div>
                  <div className="text-sm text-slate-600">
                    {e.equivalentLevel && `Équivalent : ${e.equivalentLevel}`}
                    {e.enicNaricRef && ` · Réf. ${e.enicNaricRef}`}
                    {` · Statut : ${e.status}`}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(e.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EefWishesCard({
  studentId,
  onChange,
}: {
  studentId: number;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const { data: wishes = [], refetch } = useListEefWishes(studentId);
  const { data: schools = [] } = useListSchools();
  const create = useCreateEefWish();
  const del = useDeleteEefWish();
  const [show, setShow] = useState(false);
  const usedOrders = new Set((wishes as any[]).map((w) => w.wishOrder));
  const nextOrder = (() => {
    for (let i = 1; i <= MAX_WISHES; i++) if (!usedOrders.has(i)) return i;
    return MAX_WISHES;
  })();
  const [form, setForm] = useState<{
    wishOrder: number;
    schoolId: string;
    schoolNameFreeText: string;
    programNameFreeText: string;
    motivationText: string;
    status: string;
  }>({
    wishOrder: nextOrder,
    schoolId: "",
    schoolNameFreeText: "",
    programNameFreeText: "",
    motivationText: "",
    status: "draft",
  });
  const handleAdd = async () => {
    const data: any = {
      wishOrder: form.wishOrder,
      schoolId: form.schoolId ? Number(form.schoolId) : undefined,
      schoolNameFreeText: form.schoolNameFreeText || undefined,
      programNameFreeText: form.programNameFreeText || undefined,
      motivationText: form.motivationText || undefined,
      status: form.status,
    };
    if (!data.schoolId) delete data.schoolId;
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    await create.mutateAsync({
      studentId,
      data: data as unknown as CreateEefWishBody,
    });
    setForm({
      wishOrder: nextOrder + 1,
      schoolId: "",
      schoolNameFreeText: "",
      programNameFreeText: "",
      motivationText: "",
      status: "draft",
    });
    setShow(false);
    refetch();
    onChange();
  };
  const handleDelete = async (id: number) => {
    await del.mutateAsync({ studentId, wishId: id });
    refetch();
    onChange();
  };
  const wishesArr = wishes as any[];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Vœux Études en France ({wishesArr.length}/{MAX_WISHES})
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShow(!show)}
          disabled={wishesArr.length >= MAX_WISHES}
        >
          <Plus className="w-4 h-4 mr-1" /> {t("depth.addWish")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {show && (
          <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={t("depth.wishRank")}>
                <Input
                  type="number"
                  min={1}
                  max={MAX_WISHES}
                  value={form.wishOrder}
                  onChange={(e) =>
                    setForm({ ...form, wishOrder: Number(e.target.value) })
                  }
                  data-testid="input-wish-order"
                />
              </Field>
              <Field label={t("depth.wishSchoolCatalog")}>
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={form.schoolId}
                  onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                  data-testid="select-wish-school"
                >
                  <option value="">— ou texte libre ci-dessous —</option>
                  {(schools as any[]).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("depth.wishStatus")}>
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {EEF_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("depth.wishSchoolFree")}>
              <Input
                value={form.schoolNameFreeText}
                onChange={(e) =>
                  setForm({ ...form, schoolNameFreeText: e.target.value })
                }
              />
            </Field>
            <Field label={t("depth.wishProgram")}>
              <Input
                value={form.programNameFreeText}
                onChange={(e) =>
                  setForm({ ...form, programNameFreeText: e.target.value })
                }
              />
            </Field>
            <Field label={t("depth.wishMotivation")}>
              <Textarea
                rows={3}
                value={form.motivationText}
                onChange={(e) =>
                  setForm({ ...form, motivationText: e.target.value })
                }
                data-testid="textarea-wish-motivation"
              />
            </Field>
            <Button onClick={handleAdd} data-testid="button-add-wish">
              {t("depth.addWishBtn")}
            </Button>
          </div>
        )}
        {wishesArr.length === 0 ? (
          <div className="text-sm text-slate-500">
            {t("depth.noWishes")}
          </div>
        ) : (
          <div className="divide-y">
            {wishesArr.map((w) => (
              <div key={w.id} className="py-3 flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    Vœu n°{w.wishOrder} —{" "}
                    {(w as any).schoolName ?? w.schoolNameFreeText ?? "—"}
                  </div>
                  <div className="text-sm text-slate-600">
                    {(w as any).programName ?? w.programNameFreeText ?? ""}
                    {` · statut : ${w.status}`}
                  </div>
                  {w.motivationText && (
                    <div className="text-sm text-slate-700 mt-1 line-clamp-3">
                      {w.motivationText}
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(w.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
