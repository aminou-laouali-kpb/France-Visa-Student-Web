import { useMemo } from "react";
import {
  useGetProjetEtudes,
  useListProjetEtudesVersions,
  useListEefWishes,
  useGetMotivationLetter,
  useListMotivationLetterVersions,
} from "@workspace/api-client-react";
import type {
  ProjetEtudes,
  ProjetEtudesVersion,
  MotivationLetter,
  MotivationLetterVersion,
  EefWish,
  RubricScore,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScorePanel } from "./student/StudentProjet";
import { formatDateTime } from "@/lib/utils";
import { FileText } from "lucide-react";

function diffWords(a: string, b: string): { type: "equal" | "add" | "del"; value: string }[] {
  // Lightweight word-level LCS diff
  const aw = a.split(/(\s+)/);
  const bw = b.split(/(\s+)/);
  const m = aw.length;
  const n = bw.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aw[i] === bw[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { type: "equal" | "add" | "del"; value: string }[] = [];
  let i = 0,
    j = 0;
  while (i < m && j < n) {
    if (aw[i] === bw[j]) {
      out.push({ type: "equal", value: aw[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", value: aw[i] });
      i++;
    } else {
      out.push({ type: "add", value: bw[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", value: aw[i++] });
  while (j < n) out.push({ type: "add", value: bw[j++] });
  return out;
}

function DiffView({ older, newer }: { older: string; newer: string }) {
  const tokens = useMemo(() => diffWords(older, newer), [older, newer]);
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="version-diff">
      {tokens.map((t, i) => {
        if (t.type === "equal") return <span key={i}>{t.value}</span>;
        if (t.type === "add")
          return (
            <span
              key={i}
              className="bg-emerald-100 text-emerald-900 rounded px-0.5"
            >
              {t.value}
            </span>
          );
        return (
          <span
            key={i}
            className="bg-rose-100 text-rose-900 line-through rounded px-0.5"
          >
            {t.value}
          </span>
        );
      })}
    </div>
  );
}

function ProjetReview({ studentId }: { studentId: number }) {
  const { data: projetRaw } = useGetProjetEtudes(studentId);
  const projet = projetRaw as unknown as ProjetEtudes | null;
  const { data: versionsRaw } = useListProjetEtudesVersions(studentId);
  const versions = (versionsRaw ?? []) as unknown as ProjetEtudesVersion[];

  if (!projet) {
    return (
      <div className="text-sm text-slate-500 py-4">
        L'étudiant n'a pas encore commencé son projet d'études.
      </div>
    );
  }

  const [latest, prev] = versions;
  const score: RubricScore | null = projet.latestScore ?? null;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Projet d'études — {projet.wordCount} mots
            </CardTitle>
            <div className="text-xs text-slate-500">
              Mis à jour {formatDateTime(projet.updatedAt)}
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="text-sm whitespace-pre-wrap text-slate-800"
              data-testid="advisor-projet-content"
            >
              {projet.content || "(vide)"}
            </div>
          </CardContent>
        </Card>

        {prev && latest && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Différences avec la version précédente
              </CardTitle>
              <div className="text-xs text-slate-500">
                {formatDateTime(prev.createdAt)} → {formatDateTime(latest.createdAt)}
              </div>
            </CardHeader>
            <CardContent>
              <DiffView older={prev.content} newer={latest.content} />
            </CardContent>
          </Card>
        )}
      </div>
      <div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dernier score IA</CardTitle>
            {projet.lastCritiqueAt && (
              <div className="text-xs text-slate-500">
                {formatDateTime(projet.lastCritiqueAt)}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {score ? (
              <ScorePanel score={score} />
            ) : (
              <div className="text-sm text-slate-500">
                Aucune analyse IA encore lancée.
              </div>
            )}
            {projet.lastCritique && (
              <div className="p-3 rounded bg-violet-50 border border-violet-100 text-xs text-slate-700 whitespace-pre-wrap">
                {projet.lastCritique}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LetterReview({
  studentId,
  wish,
}: {
  studentId: number;
  wish: EefWish;
}) {
  const { data: letterRaw } = useGetMotivationLetter(studentId, wish.id);
  const letter = letterRaw as unknown as MotivationLetter | null;
  const { data: versionsRaw } = useListMotivationLetterVersions(studentId, wish.id);
  const versions = (versionsRaw ?? []) as unknown as MotivationLetterVersion[];

  const w = wish as EefWish & { schoolName?: string | null; programName?: string | null };
  const wishLabel =
    [w.schoolName ?? w.schoolNameFreeText, w.programName ?? w.programNameFreeText]
      .filter(Boolean)
      .join(" · ") || `Voeu ${wish.wishOrder}`;

  if (!letter) {
    return (
      <Card data-testid={`advisor-letter-${wish.id}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Voeu {wish.wishOrder} — {wishLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-500">Pas encore de lettre rédigée.</div>
        </CardContent>
      </Card>
    );
  }

  const [latest, prev] = versions;
  const score: RubricScore | null = letter.latestScore ?? null;

  return (
    <Card data-testid={`advisor-letter-${wish.id}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Voeu {wish.wishOrder} — {wishLabel} ({letter.wordCount} mots)
        </CardTitle>
        <div className="text-xs text-slate-500">
          Mis à jour {formatDateTime(letter.updatedAt)}
          {typeof score?.overall === "number" && (
            <span className="ml-2 font-medium text-slate-700">
              · Note {score.overall.toFixed(1)} / 10
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="text-sm whitespace-pre-wrap text-slate-800">
              {letter.content || "(vide)"}
            </div>
          </div>
          <div>
            {score ? (
              <ScorePanel score={score} />
            ) : (
              <div className="text-sm text-slate-500">Aucune analyse IA.</div>
            )}
          </div>
        </div>
        {prev && latest && (
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">
              Différences avec la version précédente
            </div>
            <DiffView older={prev.content} newer={latest.content} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjetReviewTab({ studentId }: { studentId: number }) {
  const { data: wishesRaw } = useListEefWishes(studentId);
  const wishes = (wishesRaw ?? []) as unknown as EefWish[];

  return (
    <div className="space-y-6" data-testid="projet-review-tab">
      <div>
        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-blue-600" />
          Projet d'études
        </div>
        <ProjetReview studentId={studentId} />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-blue-600" />
          Lettres de motivation
        </div>
        {wishes.length === 0 ? (
          <div className="text-sm text-slate-500">Aucun voeu enregistré.</div>
        ) : (
          <div className="space-y-3">
            {wishes.map((w) => (
              <LetterReview key={w.id} studentId={studentId} wish={w} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
