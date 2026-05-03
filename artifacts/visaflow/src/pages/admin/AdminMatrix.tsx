import { useMemo, useState } from "react";
import {
  useListDocumentMatrixEntries,
  useGetDocumentMatrixReference,
  useCreateDocumentMatrixEntry,
  useUpdateDocumentMatrixEntry,
  useDeleteDocumentMatrixEntry,
  useListCountries,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GitCompare } from "lucide-react";

type Reference = {
  documentCategories: { value: string; label: string }[];
  programLevels: { value: string; label: string }[];
  visaCenters: { value: string; label: string }[];
};

type MatrixEntry = {
  id: number;
  nationalityCode: string;
  programLevel: string;
  documentCategories: string[];
  visaCenter: string | null;
  campusFranceRequired: boolean;
  notes: string | null;
  version: number;
  updatedAt: string;
};

interface FormState {
  id?: number;
  nationalityCode: string;
  programLevel: string;
  documentCategories: string[];
  visaCenter: string;
  campusFranceRequired: boolean;
  notes: string;
}

const EMPTY_FORM: FormState = {
  nationalityCode: "",
  programLevel: "",
  documentCategories: [],
  visaCenter: "",
  campusFranceRequired: true,
  notes: "",
};

export function AdminMatrix() {
  const { toast } = useToast();
  const { data: refRaw } = useGetDocumentMatrixReference();
  const reference = (refRaw ?? {
    documentCategories: [],
    programLevels: [],
    visaCenters: [],
  }) as Reference;
  const { data: countriesRaw = [] } = useListCountries();
  const countries = countriesRaw as { code: string; name: string }[];

  const { data: rowsRaw = [], refetch, isLoading } = useListDocumentMatrixEntries({});
  const rows = rowsRaw as MatrixEntry[];

  const create = useCreateDocumentMatrixEntry();
  const update = useUpdateDocumentMatrixEntry();
  const remove = useDeleteDocumentMatrixEntry();

  const [editing, setEditing] = useState<FormState | null>(null);
  const [filterNat, setFilterNat] = useState<string>("");
  const [filterLvl, setFilterLvl] = useState<string>("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!filterNat || r.nationalityCode === filterNat) &&
          (!filterLvl || r.programLevel === filterLvl),
      ),
    [rows, filterNat, filterLvl],
  );

  const editingPrev = editing?.id
    ? rows.find((r) => r.id === editing.id)
    : null;
  const diff = useMemo(() => {
    if (!editing) return null;
    const before = new Set(editingPrev?.documentCategories ?? []);
    const after = new Set(editing.documentCategories);
    return {
      added: [...after].filter((c) => !before.has(c)),
      removed: [...before].filter((c) => !after.has(c)),
      visaCenterChanged:
        (editingPrev?.visaCenter ?? "") !== (editing.visaCenter || ""),
      cfChanged:
        (editingPrev?.campusFranceRequired ?? true) !==
        editing.campusFranceRequired,
    };
  }, [editing, editingPrev]);

  function openCreate() {
    setEditing({ ...EMPTY_FORM });
  }
  function openEdit(row: MatrixEntry) {
    setEditing({
      id: row.id,
      nationalityCode: row.nationalityCode,
      programLevel: row.programLevel,
      documentCategories: [...row.documentCategories],
      visaCenter: row.visaCenter ?? "",
      campusFranceRequired: row.campusFranceRequired,
      notes: row.notes ?? "",
    });
  }
  async function save() {
    if (!editing) return;
    const data = {
      nationalityCode: editing.nationalityCode,
      programLevel: editing.programLevel,
      documentCategories: editing.documentCategories,
      visaCenter: editing.visaCenter || null,
      campusFranceRequired: editing.campusFranceRequired,
      notes: editing.notes || null,
    };
    try {
      if (editing.id) {
        await update.mutateAsync({ entryId: editing.id, data });
        toast({ title: "Matrice mise à jour" });
      } else {
        await create.mutateAsync({ data });
        toast({ title: "Entrée créée" });
      }
      setEditing(null);
      void refetch();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Erreur";
      toast({ title: "Échec de l'enregistrement", description: msg, variant: "destructive" });
    }
  }
  async function onDelete(row: MatrixEntry) {
    if (!confirm(`Supprimer la matrice ${row.nationalityCode} / ${row.programLevel} ?`)) return;
    await remove.mutateAsync({ entryId: row.id });
    toast({ title: "Entrée supprimée" });
    void refetch();
  }

  const catLabel = (v: string) =>
    reference.documentCategories.find((c) => c.value === v)?.label ?? v;

  return (
    <div className="space-y-6" data-testid="admin-matrix">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Matrice nationalité × niveau</h1>
          <p className="text-slate-600 mt-1">
            Définit les pièces exigées par nationalité et niveau d'études.
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-matrix-entry">
          <Plus className="w-4 h-4 mr-2" /> Nouvelle entrée
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex items-end gap-3 flex-wrap">
          <div>
            <Label>Nationalité</Label>
            <Select value={filterNat || "all"} onValueChange={(v) => setFilterNat(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48" data-testid="filter-nationality">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Niveau</Label>
            <Select value={filterLvl || "all"} onValueChange={(v) => setFilterLvl(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48" data-testid="filter-level">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {reference.programLevels.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} entrée(s){isLoading ? " · chargement…" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-3">Nationalité</th>
                <th className="p-3">Niveau</th>
                <th className="p-3">Documents</th>
                <th className="p-3">Centre visa</th>
                <th className="p-3">CF</th>
                <th className="p-3">Version</th>
                <th className="p-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t" data-testid={`row-matrix-${row.id}`}>
                  <td className="p-3 font-medium">{row.nationalityCode}</td>
                  <td className="p-3">{row.programLevel}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {row.documentCategories.slice(0, 5).map((c) => (
                        <Badge key={c} variant="outline">{catLabel(c)}</Badge>
                      ))}
                      {row.documentCategories.length > 5 && (
                        <Badge variant="outline">+{row.documentCategories.length - 5}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">{row.visaCenter ?? "—"}</td>
                  <td className="p-3">{row.campusFranceRequired ? "Oui" : "Non"}</td>
                  <td className="p-3 text-slate-500">v{row.version}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(row)}
                      data-testid={`button-edit-${row.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(row)}
                      data-testid={`button-delete-${row.id}`}>
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aucune entrée.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Modifier la matrice" : "Nouvelle entrée matrice"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nationalité</Label>
                  <Select
                    value={editing.nationalityCode}
                    onValueChange={(v) => setEditing({ ...editing, nationalityCode: v })}
                  >
                    <SelectTrigger data-testid="input-nationality">
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Niveau</Label>
                  <Select
                    value={editing.programLevel}
                    onValueChange={(v) => setEditing({ ...editing, programLevel: v })}
                  >
                    <SelectTrigger data-testid="input-level">
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {reference.programLevels.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                      <SelectItem value="*">Tous (joker)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Documents requis</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-72 overflow-y-auto p-3 border rounded-md">
                  {reference.documentCategories.map((c) => {
                    const checked = editing.documentCategories.includes(c.value);
                    return (
                      <label key={c.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v
                              ? [...editing.documentCategories, c.value]
                              : editing.documentCategories.filter((x) => x !== c.value);
                            setEditing({ ...editing, documentCategories: next });
                          }}
                          data-testid={`cat-${c.value}`}
                        />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Centre visa</Label>
                  <Select
                    value={editing.visaCenter || "none"}
                    onValueChange={(v) => setEditing({ ...editing, visaCenter: v === "none" ? "" : v })}
                  >
                    <SelectTrigger data-testid="input-visa-center">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {reference.visaCenters.map((v) => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Checkbox
                    checked={editing.campusFranceRequired}
                    onCheckedChange={(v) =>
                      setEditing({ ...editing, campusFranceRequired: v === true })
                    }
                    id="cf-required"
                    data-testid="input-cf-required"
                  />
                  <Label htmlFor="cf-required">Campus France requis</Label>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={2}
                  data-testid="input-notes"
                />
              </div>

              {editingPrev && diff && (
                <div className="border rounded-md p-3 bg-slate-50">
                  <div className="text-sm font-medium flex items-center gap-2 mb-2">
                    <GitCompare className="w-4 h-4" /> Aperçu des changements (v{editingPrev.version} → v{editingPrev.version + 1})
                  </div>
                  <div className="space-y-1 text-sm">
                    {diff.added.length > 0 && (
                      <div>
                        <span className="text-emerald-700 font-medium">+ Ajouté : </span>
                        {diff.added.map(catLabel).join(", ")}
                      </div>
                    )}
                    {diff.removed.length > 0 && (
                      <div>
                        <span className="text-rose-700 font-medium">− Retiré : </span>
                        {diff.removed.map(catLabel).join(", ")}
                      </div>
                    )}
                    {diff.visaCenterChanged && (
                      <div>
                        <span className="text-slate-700 font-medium">Centre visa : </span>
                        {editingPrev.visaCenter ?? "—"} → {editing.visaCenter || "—"}
                      </div>
                    )}
                    {diff.cfChanged && (
                      <div>
                        <span className="text-slate-700 font-medium">Campus France : </span>
                        {editingPrev.campusFranceRequired ? "Oui" : "Non"} → {editing.campusFranceRequired ? "Oui" : "Non"}
                      </div>
                    )}
                    {diff.added.length === 0 && diff.removed.length === 0 && !diff.visaCenterChanged && !diff.cfChanged && (
                      <div className="text-slate-500">Aucun changement.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button
              onClick={save}
              disabled={!editing?.nationalityCode || !editing?.programLevel}
              data-testid="button-save-matrix"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
