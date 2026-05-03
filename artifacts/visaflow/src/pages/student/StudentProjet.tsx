import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProjetEtudes,
  useUpsertProjetEtudes,
  useListProjetEtudesVersions,
  useImproveProjetEtudesParagraph,
  useListEefWishes,
  useGetMotivationLetter,
  useUpsertMotivationLetter,
  useListMotivationLetterVersions,
  useImproveMotivationLetterParagraph,
  getGetProjetEtudesQueryKey,
  getListProjetEtudesVersionsQueryKey,
  getGetMotivationLetterQueryKey,
  getListMotivationLetterVersionsQueryKey,
} from "@workspace/api-client-react";
import type {
  ProjetEtudes,
  ProjetEtudesVersion,
  MotivationLetter,
  MotivationLetterVersion,
  CritiqueResult,
  ImproveParagraphResult,
  RubricScore,
  EefWish,
} from "@workspace/api-client-react";
import { streamCritique } from "@/lib/streamCritique";
import { useMyStudent } from "./StudentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Save,
  History,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Loader2,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const PROJET_PROMPTS = [
  "Pourquoi la France et pas un autre pays ?",
  "Quel est le lien entre vos études passées et le master visé ?",
  "Quels cours / spécialisations / professeurs vous attirent particulièrement ?",
  "Quel projet professionnel concret après le diplôme ?",
  "Comment ce diplôme se valorise-t-il dans votre pays au retour ?",
];

const LETTER_PROMPTS = [
  "Pourquoi cette école / ce programme spécifiquement ?",
  "Quels cours ou intervenants vous intéressent ?",
  "Quel est votre projet professionnel après ce master ?",
  "Quel lien avec votre pays d'origine ?",
];

function ScoreBar({ label, value }: { label: string; value?: number | null }) {
  const v = typeof value === "number" ? value : null;
  const pct = v === null ? 0 : Math.max(0, Math.min(10, v)) * 10;
  const color =
    v === null
      ? "bg-slate-200"
      : v >= 7
        ? "bg-emerald-500"
        : v >= 4
          ? "bg-amber-500"
          : "bg-rose-500";
  return (
    <div data-testid={`score-${label}`}>
      <div className="flex justify-between text-xs text-slate-600 mb-1">
        <span>{label}</span>
        <span className="font-medium text-slate-900">{v === null ? "—" : v.toFixed(1)} / 10</span>
      </div>
      <div className="h-2 bg-slate-100 rounded">
        <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScorePanel({ score }: { score?: RubricScore | null }) {
  const s = score ?? {};
  return (
    <div className="space-y-3">
      <ScoreBar label="Cohérence" value={s.coherence} />
      <ScoreBar label="Français" value={s.french} />
      <ScoreBar label="Spécificité" value={s.specificity} />
      <ScoreBar label="Plan de retour" value={s.returnPlan} />
      <div className="pt-2 border-t">
        <ScoreBar label="Note globale" value={s.overall} />
      </div>
    </div>
  );
}

export function CoachPanel({
  isCritiquing,
  hasContent,
  score,
  critique,
  streamingCritique,
  autoCoach,
  onToggleAutoCoach,
  onRunCritique,
  testIdPrefix,
}: {
  isCritiquing: boolean;
  hasContent: boolean;
  score?: RubricScore | null;
  critique?: string | null;
  streamingCritique?: string;
  autoCoach?: boolean;
  onToggleAutoCoach?: (next: boolean) => void;
  onRunCritique: () => void;
  testIdPrefix: string;
}) {
  const showStream = isCritiquing && streamingCritique && streamingCritique.length > 0;
  return (
    <Card className="sticky top-4" data-testid={`${testIdPrefix}-coach`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          Coach IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          className="w-full"
          onClick={onRunCritique}
          disabled={!hasContent || isCritiquing}
          data-testid={`${testIdPrefix}-button-run-critique`}
        >
          {isCritiquing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyse en cours…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Lancer l'analyse
            </>
          )}
        </Button>
        {onToggleAutoCoach && (
          <label
            className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none"
            data-testid={`${testIdPrefix}-auto-coach-toggle`}
          >
            <input
              type="checkbox"
              className="accent-violet-600"
              checked={!!autoCoach}
              onChange={(e) => onToggleAutoCoach(e.target.checked)}
            />
            <span>
              Coach automatique pendant la rédaction
              {autoCoach && (
                <span className="ml-1 text-violet-600">· se déclenche après une pause</span>
              )}
            </span>
          </label>
        )}
        <ScorePanel score={score} />
        {showStream && (
          <div
            className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm text-slate-700 whitespace-pre-wrap font-mono"
            data-testid={`${testIdPrefix}-critique-stream`}
          >
            {streamingCritique}
            <span className="inline-block w-2 h-4 bg-amber-400 ml-1 animate-pulse align-text-bottom" />
          </div>
        )}
        {!showStream && critique && (
          <div
            className="p-3 rounded-lg bg-violet-50 border border-violet-100 text-sm text-slate-700 whitespace-pre-wrap"
            data-testid={`${testIdPrefix}-critique-text`}
          >
            {critique}
          </div>
        )}
        {!critique && !isCritiquing && (
          <div className="text-xs text-slate-500">
            Cliquez sur « Lancer l'analyse » pour obtenir une critique structurée :
            cohérence, français, spécificité au programme, et plan de retour.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VersionsList<
  T extends { id: number; createdAt: string; wordCount: number; score?: RubricScore | null },
>({ versions, testIdPrefix }: { versions: T[]; testIdPrefix: string }) {
  if (versions.length === 0) {
    return (
      <div className="text-sm text-slate-500 py-4">Aucune version pour le moment.</div>
    );
  }
  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between p-3 rounded-lg border bg-white text-sm"
          data-testid={`${testIdPrefix}-version-${v.id}`}
        >
          <div>
            <div className="font-medium text-slate-900">
              {formatDateTime(v.createdAt)}
            </div>
            <div className="text-xs text-slate-500">{v.wordCount} mots</div>
          </div>
          <div className="text-xs text-slate-700">
            {typeof v.score?.overall === "number"
              ? `Note ${v.score.overall.toFixed(1)} / 10`
              : "Sans note"}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjetEditor({ studentId }: { studentId: number }) {
  const queryClient = useQueryClient();
  const { data: projetRaw, refetch } = useGetProjetEtudes(studentId);
  const projet = projetRaw as unknown as ProjetEtudes | null;
  const { data: versionsRaw } = useListProjetEtudesVersions(studentId);
  const versions = (versionsRaw ?? []) as unknown as ProjetEtudesVersion[];
  const upsert = useUpsertProjetEtudes();
  const improve = useImproveProjetEtudesParagraph();

  const [content, setContent] = useState("");
  const [latestScore, setLatestScore] = useState<RubricScore | null>(null);
  const [latestCritique, setLatestCritique] = useState<string | null>(null);
  const [streamingCritique, setStreamingCritique] = useState<string>("");
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [autoCoach, setAutoCoach] = useState(true);
  const [lastCritiquedContent, setLastCritiquedContent] = useState<string>("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [improvePara, setImprovePara] = useState("");
  const [improveResult, setImproveResult] = useState<string | null>(null);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    if (projet) {
      setContent(projet.content ?? "");
      setLatestScore(projet.latestScore ?? null);
      setLatestCritique(projet.lastCritique ?? null);
      setLastCritiquedContent(projet.content ?? "");
      initRef.current = true;
    } else if (projet === null) {
      // First-time draft: server returned no row. Still mark initialized so
      // autosave fires once the student starts typing.
      initRef.current = true;
    }
  }, [projet]);

  const wordCount = useMemo(
    () => (content.trim() ? content.trim().split(/\s+/).length : 0),
    [content],
  );

  // Autosave debounced 1.5s after last keystroke
  useEffect(() => {
    if (!initRef.current) return;
    const baseline = projet?.content ?? "";
    if (content === baseline) return;
    const handle = setTimeout(async () => {
      const saved = await upsert.mutateAsync({
        studentId,
        data: { content },
      });
      setSavedAt(new Date());
      queryClient.setQueryData(getGetProjetEtudesQueryKey(studentId), saved);
    }, 1500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const runCritique = async (opts?: { silent?: boolean }) => {
    if (isCritiquing) return;
    const snapshot = content;
    setIsCritiquing(true);
    setStreamingCritique("");
    setLatestCritique(null);
    try {
      await streamCritique(
        `/api/students/${studentId}/projet-etudes/critique/stream`,
        {
          onDelta: (d) => setStreamingCritique((acc) => acc + d),
          onResult: (r) => {
            setLatestScore(r.score);
            setLatestCritique(r.critique);
          },
          onError: (msg) => {
            if (!opts?.silent) alert(msg);
          },
        },
      );
      setLastCritiquedContent(snapshot);
      await refetch();
      queryClient.invalidateQueries({
        queryKey: getListProjetEtudesVersionsQueryKey(studentId),
      });
    } catch (err) {
      if (!opts?.silent) {
        const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse.";
        alert(msg);
      }
    } finally {
      setIsCritiquing(false);
    }
  };

  // Auto-coach: after the student stops typing, debounce-trigger a streaming
  // critique if content is meaningfully different from the last critiqued
  // version and long enough to be worth analyzing.
  useEffect(() => {
    if (!autoCoach) return;
    if (!initRef.current) return;
    if (isCritiquing) return;
    if (content.trim().length < 200) return;
    if (content === lastCritiquedContent) return;
    const handle = setTimeout(() => {
      void runCritique({ silent: true });
    }, 8000);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, autoCoach, isCritiquing, lastCritiquedContent]);

  const runImprove = async () => {
    if (improvePara.trim().length < 20) return;
    try {
      const r = (await improve.mutateAsync({
        studentId,
        data: { paragraph: improvePara },
      })) as unknown as ImproveParagraphResult;
      setImproveResult(r.improved ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      alert(msg);
    }
  };

  const acceptImprove = () => {
    if (!improveResult) return;
    setContent((c) => c.replace(improvePara, improveResult));
    setImprovePara("");
    setImproveResult(null);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mon projet d'études</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900 mb-2">Pensez à aborder :</div>
              <ul className="list-disc pl-5 space-y-1">
                {PROJET_PROMPTS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Rédigez ici votre projet d'études…"
              rows={20}
              className="font-serif text-base leading-relaxed"
              data-testid="textarea-projet"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span data-testid="projet-word-count">{wordCount} mots</span>
              <span>
                {upsert.isPending ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Enregistrement…
                  </span>
                ) : savedAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Enregistré à{" "}
                    {savedAt.toLocaleTimeString()}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Save className="w-3 h-3" /> Auto-enregistrement actif
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-violet-600" />
              Améliorer un paragraphe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={improvePara}
              onChange={(e) => setImprovePara(e.target.value)}
              placeholder="Collez ici un paragraphe à améliorer (au moins 20 caractères)…"
              rows={4}
              data-testid="textarea-improve-projet"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={runImprove}
                disabled={improvePara.trim().length < 20 || improve.isPending}
                data-testid="button-improve-projet"
              >
                {improve.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                Suggérer une réécriture
              </Button>
            </div>
            {improveResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="text-xs text-emerald-700 mb-1 font-medium">
                  Suggestion
                </div>
                <div
                  className="text-sm text-slate-800 whitespace-pre-wrap"
                  data-testid="improve-result-projet"
                >
                  {improveResult}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={acceptImprove}
                    data-testid="button-accept-improve-projet"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Appliquer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setImproveResult(null)}
                    data-testid="button-reject-improve-projet"
                  >
                    Rejeter
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Historique des versions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VersionsList versions={versions} testIdPrefix="projet" />
          </CardContent>
        </Card>
      </div>

      <div>
        <CoachPanel
          isCritiquing={isCritiquing}
          hasContent={content.trim().length >= 50}
          score={latestScore}
          critique={latestCritique}
          streamingCritique={streamingCritique}
          autoCoach={autoCoach}
          onToggleAutoCoach={setAutoCoach}
          onRunCritique={() => void runCritique()}
          testIdPrefix="projet"
        />
      </div>
    </div>
  );
}

function MotivationLetterEditor({
  studentId,
  wish,
}: {
  studentId: number;
  wish: EefWish;
}) {
  const queryClient = useQueryClient();
  const { data: letterRaw, refetch } = useGetMotivationLetter(studentId, wish.id);
  const letter = letterRaw as unknown as MotivationLetter | null;
  const { data: versionsRaw } = useListMotivationLetterVersions(studentId, wish.id);
  const versions = (versionsRaw ?? []) as unknown as MotivationLetterVersion[];
  const upsert = useUpsertMotivationLetter();
  const improve = useImproveMotivationLetterParagraph();

  const [content, setContent] = useState("");
  const [latestScore, setLatestScore] = useState<RubricScore | null>(null);
  const [latestCritique, setLatestCritique] = useState<string | null>(null);
  const [streamingCritique, setStreamingCritique] = useState<string>("");
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [autoCoach, setAutoCoach] = useState(true);
  const [lastCritiquedContent, setLastCritiquedContent] = useState<string>("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [improvePara, setImprovePara] = useState("");
  const [improveResult, setImproveResult] = useState<string | null>(null);

  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current && letter) {
      setContent(letter.content ?? "");
      setLatestScore(letter.latestScore ?? null);
      setLatestCritique(letter.lastCritique ?? null);
      setLastCritiquedContent(letter.content ?? "");
      initRef.current = true;
    } else if (!initRef.current && letter === null) {
      // server returned null — mark as initialized so empty state autosaves later
      initRef.current = true;
    }
  }, [letter]);

  const wordCount = useMemo(
    () => (content.trim() ? content.trim().split(/\s+/).length : 0),
    [content],
  );

  useEffect(() => {
    if (!initRef.current) return;
    const baseline = letter?.content ?? "";
    if (content === baseline) return;
    const handle = setTimeout(async () => {
      const saved = await upsert.mutateAsync({
        studentId,
        wishId: wish.id,
        data: { content },
      });
      setSavedAt(new Date());
      queryClient.setQueryData(
        getGetMotivationLetterQueryKey(studentId, wish.id),
        saved,
      );
    }, 1500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const runCritique = async (opts?: { silent?: boolean }) => {
    if (isCritiquing) return;
    const snapshot = content;
    setIsCritiquing(true);
    setStreamingCritique("");
    setLatestCritique(null);
    try {
      await streamCritique(
        `/api/students/${studentId}/eef-wishes/${wish.id}/motivation-letter/critique/stream`,
        {
          onDelta: (d) => setStreamingCritique((acc) => acc + d),
          onResult: (r) => {
            setLatestScore(r.score);
            setLatestCritique(r.critique);
          },
          onError: (msg) => {
            if (!opts?.silent) alert(msg);
          },
        },
      );
      setLastCritiquedContent(snapshot);
      await refetch();
      queryClient.invalidateQueries({
        queryKey: getListMotivationLetterVersionsQueryKey(studentId, wish.id),
      });
    } catch (err) {
      if (!opts?.silent) {
        const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse.";
        alert(msg);
      }
    } finally {
      setIsCritiquing(false);
    }
  };

  // Auto-coach: streaming critique after a typing pause once the letter has
  // grown enough and content has changed since the last analyzed version.
  useEffect(() => {
    if (!autoCoach) return;
    if (!initRef.current) return;
    if (isCritiquing) return;
    if (content.trim().length < 200) return;
    if (content === lastCritiquedContent) return;
    const handle = setTimeout(() => {
      void runCritique({ silent: true });
    }, 8000);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, autoCoach, isCritiquing, lastCritiquedContent]);

  const runImprove = async () => {
    if (improvePara.trim().length < 20) return;
    try {
      const r = (await improve.mutateAsync({
        studentId,
        wishId: wish.id,
        data: { paragraph: improvePara },
      })) as unknown as ImproveParagraphResult;
      setImproveResult(r.improved ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      alert(msg);
    }
  };

  const acceptImprove = () => {
    if (!improveResult) return;
    setContent((c) => c.replace(improvePara, improveResult));
    setImprovePara("");
    setImproveResult(null);
  };

  const w = wish as EefWish & { schoolName?: string | null; programName?: string | null };
  const wishLabel =
    [w.schoolName ?? w.schoolNameFreeText, w.programName ?? w.programNameFreeText]
      .filter(Boolean)
      .join(" · ") || `Voeu ${wish.wishOrder}`;

  return (
    <div className="grid lg:grid-cols-3 gap-6" data-testid={`letter-editor-${wish.id}`}>
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Lettre de motivation — Voeu {wish.wishOrder}
            </CardTitle>
            <div className="text-sm text-slate-600">{wishLabel}</div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900 mb-2">À aborder :</div>
              <ul className="list-disc pl-5 space-y-1">
                {LETTER_PROMPTS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Rédigez ici votre lettre de motivation pour ce voeu…"
              rows={18}
              className="font-serif text-base leading-relaxed"
              data-testid={`textarea-letter-${wish.id}`}
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span data-testid={`letter-word-count-${wish.id}`}>
                {wordCount} mots
              </span>
              <span>
                {upsert.isPending ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Enregistrement…
                  </span>
                ) : savedAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Enregistré à{" "}
                    {savedAt.toLocaleTimeString()}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Save className="w-3 h-3" /> Auto-enregistrement actif
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-violet-600" />
              Améliorer un paragraphe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={improvePara}
              onChange={(e) => setImprovePara(e.target.value)}
              placeholder="Paragraphe à améliorer…"
              rows={4}
              data-testid={`textarea-improve-letter-${wish.id}`}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={runImprove}
                disabled={improvePara.trim().length < 20 || improve.isPending}
                data-testid={`button-improve-letter-${wish.id}`}
              >
                {improve.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                Suggérer une réécriture
              </Button>
            </div>
            {improveResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <div
                  className="text-sm text-slate-800 whitespace-pre-wrap"
                  data-testid={`improve-result-letter-${wish.id}`}
                >
                  {improveResult}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={acceptImprove}
                    data-testid={`button-accept-improve-letter-${wish.id}`}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Appliquer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setImproveResult(null)}
                  >
                    Rejeter
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Historique des versions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VersionsList versions={versions} testIdPrefix={`letter-${wish.id}`} />
          </CardContent>
        </Card>
      </div>

      <div>
        <CoachPanel
          isCritiquing={isCritiquing}
          hasContent={content.trim().length >= 50}
          score={latestScore}
          critique={latestCritique}
          streamingCritique={streamingCritique}
          autoCoach={autoCoach}
          onToggleAutoCoach={setAutoCoach}
          onRunCritique={() => void runCritique()}
          testIdPrefix={`letter-${wish.id}`}
        />
      </div>
    </div>
  );
}

export function StudentProjet() {
  const { student, isLoading } = useMyStudent();
  const { data: wishesRaw } = useListEefWishes(student?.id ?? 0, {
    query: { enabled: !!student?.id, queryKey: ["eef-wishes", student?.id ?? 0] },
  });
  const wishes = (wishesRaw ?? []) as unknown as EefWish[];
  const [activeWishId, setActiveWishId] = useState<number | "projet">("projet");

  if (isLoading) return <div className="p-8">Chargement…</div>;
  if (!student) return null;

  return (
    <div className="space-y-6" data-testid="page-student-projet">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Projet d'études & motivation</h1>
        <p className="text-slate-600 mt-1">
          Rédigez votre projet d'études et vos lettres de motivation, avec un coach IA pour
          vous guider sur la cohérence, le français, la spécificité et le plan de retour.
        </p>
      </div>

      <Tabs
        value={String(activeWishId)}
        onValueChange={(v) =>
          setActiveWishId(v === "projet" ? "projet" : Number(v))
        }
      >
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="projet" data-testid="tab-projet-etudes">
            Projet d'études
          </TabsTrigger>
          {wishes.map((w) => (
            <TabsTrigger
              key={w.id}
              value={String(w.id)}
              data-testid={`tab-letter-${w.id}`}
            >
              Voeu {w.wishOrder}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="projet" className="mt-4">
          <ProjetEditor studentId={student.id} />
        </TabsContent>
        {wishes.map((w) => (
          <TabsContent key={w.id} value={String(w.id)} className="mt-4">
            <MotivationLetterEditor studentId={student.id} wish={w} />
          </TabsContent>
        ))}
      </Tabs>

      {wishes.length === 0 && (
        <Card>
          <CardContent className="p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="text-sm text-slate-700">
              Vous n'avez pas encore enregistré de voeux Études en France. Ajoutez-en
              dans votre dossier pour rédiger une lettre de motivation par voeu.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
