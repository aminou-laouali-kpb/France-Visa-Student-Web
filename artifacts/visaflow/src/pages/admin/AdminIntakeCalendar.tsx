import { useState } from "react";
import {
  useListIntakeCalendarEntries,
  useCreateIntakeCalendarEntry,
  useUpdateIntakeCalendarEntry,
  useDeleteIntakeCalendarEntry,
  useListCountries,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2 } from "lucide-react";

type CalEntry = {
  id: number;
  nationalityCode: string;
  label: string;
  deadlineType: string;
  windowStart: string | null;
  windowEnd: string;
  academicYear: string | null;
  notes: string | null;
  sortOrder: number;
};

interface FormState {
  id?: number;
  nationalityCode: string;
  label: string;
  deadlineType: string;
  windowStart: string;
  windowEnd: string;
  academicYear: string;
  notes: string;
  sortOrder: number;
}

const DEADLINE_TYPE_VALUES = ["campus_france", "visa_appointment", "school_application", "other"];

const EMPTY: FormState = {
  nationalityCode: "",
  label: "",
  deadlineType: "campus_france",
  windowStart: "",
  windowEnd: "",
  academicYear: "",
  notes: "",
  sortOrder: 0,
};

export function AdminIntakeCalendar() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: countriesRaw = [] } = useListCountries();
  const countries = countriesRaw as { code: string; name: string }[];
  const { data: rowsRaw = [], refetch, isLoading } = useListIntakeCalendarEntries({});
  const rows = rowsRaw as CalEntry[];
  const create = useCreateIntakeCalendarEntry();
  const update = useUpdateIntakeCalendarEntry();
  const remove = useDeleteIntakeCalendarEntry();
  const [editing, setEditing] = useState<FormState | null>(null);

  function openCreate() { setEditing({ ...EMPTY }); }
  function openEdit(r: CalEntry) {
    setEditing({
      id: r.id,
      nationalityCode: r.nationalityCode,
      label: r.label,
      deadlineType: r.deadlineType,
      windowStart: r.windowStart ?? "",
      windowEnd: r.windowEnd,
      academicYear: r.academicYear ?? "",
      notes: r.notes ?? "",
      sortOrder: r.sortOrder,
    });
  }
  async function save() {
    if (!editing) return;
    const data = {
      nationalityCode: editing.nationalityCode,
      label: editing.label,
      deadlineType: editing.deadlineType,
      windowStart: editing.windowStart || null,
      windowEnd: editing.windowEnd,
      academicYear: editing.academicYear || null,
      notes: editing.notes || null,
      sortOrder: Number(editing.sortOrder) || 0,
    };
    try {
      if (editing.id) {
        await update.mutateAsync({ entryId: editing.id, data });
      } else {
        await create.mutateAsync({ data });
      }
      toast({ title: t("common.saved") });
      setEditing(null);
      void refetch();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : t("common.error");
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    }
  }
  async function onDelete(r: CalEntry) {
    if (!confirm(t("calendar.confirmDelete", { label: r.label }))) return;
    await remove.mutateAsync({ entryId: r.id });
    toast({ title: t("common.deleted") });
    void refetch();
  }

  return (
    <div className="space-y-6" data-testid="admin-intake-calendar">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t("calendar.adminTitle")}</h1>
          <p className="text-slate-600 mt-1">{t("calendar.adminSubtitle")}</p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-intake">
          <Plus className="w-4 h-4 mr-2" /> {t("calendar.newEntryBtn")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("calendar.entryCount", { n: rows.length })}{isLoading ? ` · ${t("common.loading")}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-3">{t("calendar.colNationality")}</th>
                <th className="p-3">{t("calendar.colLabel")}</th>
                <th className="p-3">{t("calendar.colType")}</th>
                <th className="p-3">{t("calendar.colDeadline")}</th>
                <th className="p-3">{t("calendar.colYear")}</th>
                <th className="p-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t" data-testid={`row-intake-${r.id}`}>
                  <td className="p-3 font-medium">{r.nationalityCode}</td>
                  <td className="p-3">{r.label}</td>
                  <td className="p-3">{t(`calendar.deadlineType_${r.deadlineType}`, { defaultValue: r.deadlineType })}</td>
                  <td className="p-3">
                    {r.windowStart ? `${r.windowStart} → ` : ""}{r.windowEnd}
                  </td>
                  <td className="p-3 text-slate-500">{r.academicYear ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(r)}>
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t("calendar.noEntries")}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("calendar.editEntry") : t("calendar.newEntry")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("calendar.colNationality")}</Label>
                  <Select value={editing.nationalityCode} onValueChange={(v) => setEditing({ ...editing, nationalityCode: v })}>
                    <SelectTrigger><SelectValue placeholder={t("common.choose")} /></SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("calendar.colType")}</Label>
                  <Select value={editing.deadlineType} onValueChange={(v) => setEditing({ ...editing, deadlineType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEADLINE_TYPE_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {t(`calendar.deadlineType_${v}`, { defaultValue: v })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t("calendar.colLabel")}</Label>
                <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{t("calendar.colStart")}</Label>
                  <Input type="date" value={editing.windowStart} onChange={(e) => setEditing({ ...editing, windowStart: e.target.value })} />
                </div>
                <div>
                  <Label>{t("calendar.colDeadline")}</Label>
                  <Input type="date" value={editing.windowEnd} onChange={(e) => setEditing({ ...editing, windowEnd: e.target.value })} />
                </div>
                <div>
                  <Label>{t("calendar.colYear")}</Label>
                  <Input placeholder="2026-2027" value={editing.academicYear} onChange={(e) => setEditing({ ...editing, academicYear: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>{t("common.notes")}</Label>
                <Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <div>
                <Label>{t("calendar.sortOrder")}</Label>
                <Input type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={save}
              disabled={!editing?.nationalityCode || !editing?.label || !editing?.windowEnd}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
