import { useState } from "react";
import { Sparkles, Copy, ThumbsUp, ThumbsDown, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/react";

interface CopilotSummary {
  missing: string[];
  risky: string[];
  changed: string[];
  draftReply: string;
  correctionRequest: string;
  promptHash: string;
}

/**
 * Advisor copilot side panel: summarises what's missing/risky/changed in a
 * dossier and drafts a student-facing reply + a precise correction request.
 * The advisor can copy any field and rate the suggestion.
 */
export function AdvisorCopilotPanel({ studentId }: { studentId: number }) {
  const { getToken } = useAuth();
  const [data, setData] = useState<CopilotSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  async function authHeaders(json = false): Promise<Record<string, string>> {
    const t = await getToken?.();
    const h: Record<string, string> = {};
    if (json) h["Content-Type"] = "application/json";
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/students/${studentId}/copilot/summary`, {
        method: "POST",
        headers: await authHeaders(true),
      });
      if (!res.ok) {
        let body = "";
        try {
          body = (await res.json())?.error ?? "";
        } catch {
          /* ignore */
        }
        throw new Error(body || `${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function vote(v: "up" | "down") {
    setFeedback(v);
    try {
      await fetch("/api/copilot/feedback", {
        method: "POST",
        headers: await authHeaders(true),
        body: JSON.stringify({
          studentId,
          feature: "copilot_summary",
          vote: v,
          promptHash: data?.promptHash,
        }),
      });
    } catch {
      /* best-effort */
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Copilote conseiller
          </span>
          <Button
            size="sm"
            onClick={generate}
            disabled={loading}
            data-testid="button-copilot-generate"
          >
            {loading ? "Analyse…" : data ? "Regénérer" : "Analyser le dossier"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data && !loading && !error && (
          <p className="text-sm text-slate-500">
            Synthèse instantanée : pièces manquantes, points à risque, ce qui a changé depuis la dernière revue, et brouillons de message à l'étudiant.
          </p>
        )}
        {error && (
          <div className="text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </div>
        )}
        {data && (
          <>
            {data.missing.length > 0 && (
              <Section title="À compléter" tone="amber" items={data.missing} testid="copilot-missing" />
            )}
            {data.risky.length > 0 && (
              <Section title="Points de vigilance" tone="rose" items={data.risky} testid="copilot-risky" />
            )}
            {data.changed.length > 0 && (
              <Section title="Changé depuis la dernière revue" tone="blue" items={data.changed} testid="copilot-changed" />
            )}
            <DraftField
              label="Brouillon de réponse"
              value={data.draftReply}
              testid="copilot-draft-reply"
            />
            <DraftField
              label="Demande de correction"
              value={data.correctionRequest}
              testid="copilot-correction-request"
            />
            <div className="flex items-center justify-end gap-1 pt-1 border-t">
              <span className="text-xs text-slate-500 mr-2">Cette synthèse est utile ?</span>
              <Button
                size="sm"
                variant={feedback === "up" ? "default" : "ghost"}
                className="h-7 px-2"
                onClick={() => vote("up")}
                data-testid="button-copilot-thumbs-up"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant={feedback === "down" ? "default" : "ghost"}
                className="h-7 px-2"
                onClick={() => vote("down")}
                data-testid="button-copilot-thumbs-down"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  tone,
  items,
  testid,
}: {
  title: string;
  tone: "amber" | "rose" | "blue";
  items: string[];
  testid: string;
}) {
  const tones: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    blue: "border-blue-200 bg-blue-50",
  };
  return (
    <div className={`rounded-lg border ${tones[tone]} p-3`} data-testid={testid}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">
        {title}
      </div>
      <ul className="text-sm text-slate-800 space-y-0.5 list-disc list-inside">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function DraftField({
  label,
  value,
  testid,
}: {
  label: string;
  value: string;
  testid: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          data-testid={`${testid}-copy`}
        >
          <Copy className="w-3 h-3 mr-1" />
          {copied ? "Copié !" : "Copier"}
        </Button>
      </div>
      <div className="text-sm text-slate-800 whitespace-pre-wrap rounded border bg-white p-2">
        {value}
      </div>
    </div>
  );
}
