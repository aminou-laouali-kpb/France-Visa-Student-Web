import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/react";
import { formatDateTime } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface NarrativePayload {
  narrative: string | null;
  signalsHash?: string | null;
  updatedAt?: string | null;
  level?: string | null;
}

/**
 * AI risk narrative card. Loads the cached narrative on mount and offers a
 * "Generate / Regenerate" button. Reuses the cache automatically when the
 * underlying signals haven't changed (the server returns the cached copy).
 */
export function RiskNarrativeCard({ studentId }: { studentId: number }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [data, setData] = useState<NarrativePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  async function fetchJson(method: "GET" | "POST", path: string) {
    const token = await getToken?.();
    const res = await fetch(`/api${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    return res.json();
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson("GET", `/students/${studentId}/risk/narrative`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ narrative: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function regenerate() {
    setGenerating(true);
    setError(null);
    try {
      const d = await fetchJson("POST", `/students/${studentId}/risk/narrative`);
      setData(d);
      // Invalidate the portfolio list so the row tooltip refreshes.
      qc.invalidateQueries({ queryKey: ["/students"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setGenerating(false);
    }
  }

  async function vote(v: "up" | "down") {
    setFeedback(v);
    try {
      const t = await getToken?.();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (t) headers.Authorization = `Bearer ${t}`;
      await fetch("/api/copilot/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify({
          studentId,
          feature: "risk_narrative",
          vote: v,
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
            {t("narrative.title")}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={regenerate}
            disabled={generating}
            data-testid="button-generate-narrative"
          >
            {data?.narrative ? t("narrative.regenerate") : t("narrative.generate")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="text-sm text-slate-500">{t("common.loading")}</div>}
        {!loading && !data?.narrative && !generating && (
          <div className="text-sm text-slate-500">
            {t("narrative.empty")}
          </div>
        )}
        {generating && (
          <div className="text-sm text-slate-500">{t("narrative.analysing")}</div>
        )}
        {data?.narrative && !generating && (
          <>
            <p
              className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed"
              data-testid="text-risk-narrative"
            >
              {data.narrative}
            </p>
            <div className="flex items-center justify-between">
              {data.updatedAt && (
                <div className="text-xs text-slate-400">
                  {t("narrative.updatedAt")} {formatDateTime(data.updatedAt)}
                </div>
              )}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={feedback === "up" ? "default" : "ghost"}
                  className="h-7 px-2"
                  onClick={() => vote("up")}
                  data-testid="button-narrative-thumbs-up"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={feedback === "down" ? "default" : "ghost"}
                  className="h-7 px-2"
                  onClick={() => vote("down")}
                  data-testid="button-narrative-thumbs-down"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
        {error && (
          <div className="text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
