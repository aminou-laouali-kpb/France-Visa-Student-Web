import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Mic,
  Square,
  Send,
  RotateCcw,
  Star,
  Loader2,
  ListChecks,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { StudentGate, useMyStudent } from "./student/StudentLayout";
import type { InterviewUI, InterviewTurnUI } from "@/types";

/**
 * Campus France interview simulator.
 * - Student-facing: wraps in <StudentGate> and routes the user's own dossier.
 * - Staff-facing: usable from /app/students/:id/interview when needed (the
 *   route below is /student/interview; staff shadow can be added later).
 */
export function StudentInterview() {
  return (
    <StudentGate>
      <Inner />
    </StudentGate>
  );
}

function Inner() {
  const { student } = useMyStudent();
  return <InterviewWorkbench studentId={student!.id} />;
}

export function InterviewWorkbench({ studentId }: { studentId: number }) {
  const { getToken } = useAuth();
  const { data: me } = useGetMe();
  const [history, setHistory] = useState<InterviewUI[]>([]);
  const [current, setCurrent] = useState<InterviewUI | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("audio/webm");
  const scrollRef = useRef<HTMLDivElement>(null);

  async function authHeaders(json = false): Promise<Record<string, string>> {
    const t = await getToken?.();
    const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  async function api<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method,
      headers: await authHeaders(!!body),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let msg = "";
      try {
        msg = (await res.json())?.error ?? "";
      } catch {
        /* ignore */
      }
      throw new Error(msg || `Erreur ${res.status}`);
    }
    return res.json();
  }

  async function reload() {
    try {
      const list = await api<InterviewUI[]>("GET", `/students/${studentId}/interviews`);
      setHistory(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [current?.turns?.length]);

  async function start(mode: "text" | "voice") {
    setBusy(true);
    setError(null);
    try {
      const created = await api<InterviewUI>("POST", `/students/${studentId}/interviews`, { mode });
      setCurrent(created);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function open(id: number) {
    setBusy(true);
    setError(null);
    try {
      const i = await api<InterviewUI>("GET", `/interviews/${id}`);
      setCurrent(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitText() {
    if (!current || !text.trim()) return;
    setBusy(true);
    setError(null);
    const answer = text.trim();
    setText("");
    try {
      const updated = await api<InterviewUI>("POST", `/interviews/${current.id}/turn`, { answer });
      setCurrent(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      mimeRef.current = mime || "audio/webm";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        await sendAudio(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e) {
      setError("Microphone non accessible");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      setRecording(false);
    }
  }

  async function sendAudio(blob: Blob) {
    if (!current) return;
    setTranscribing(true);
    setError(null);
    try {
      const buf = await blob.arrayBuffer();
      const b64 = btoa(
        new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), ""),
      );
      const updated = await api<InterviewUI>(
        "POST",
        `/interviews/${current.id}/transcribe`,
        { audioBase64: b64, mimeType: mimeRef.current },
      );
      setCurrent(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur transcription");
    } finally {
      setTranscribing(false);
    }
  }

  async function finish() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const done = await api<InterviewUI>("POST", `/interviews/${current.id}/finish`);
      setCurrent(done);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (!current) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Simulateur d'entretien Campus France</h1>
          <p className="text-slate-600 mt-1">
            Entraînez-vous à l'entretien préalable au visa. L'IA joue l'examinateur, vous évalue et vous donne un retour détaillé.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mode texte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>Lisez la question, répondez par écrit. Idéal pour structurer vos idées.</p>
              <Button
                onClick={() => start("text")}
                disabled={busy}
                data-testid="button-start-interview-text"
              >
                Commencer en texte
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mode voix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>Répondez à voix haute, comme en situation. Vos réponses sont transcrites et évaluées.</p>
              <Button
                onClick={() => start("voice")}
                disabled={busy}
                data-testid="button-start-interview-voice"
              >
                Commencer à l'oral
              </Button>
            </CardContent>
          </Card>
        </div>
        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="w-4 h-4" /> Mes entretiens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {history.map((h) => (
                <button
                  key={h.id}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-slate-50 text-left"
                  onClick={() => open(h.id)}
                  data-testid={`interview-row-${h.id}`}
                >
                  <div>
                    <div className="text-sm font-medium">
                      Entretien du {formatDateTime(h.createdAt)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Mode : {h.mode === "voice" ? "voix" : "texte"} · Statut :{" "}
                      {h.status === "completed"
                        ? "terminé"
                        : h.status === "in_progress"
                          ? "en cours"
                          : "abandonné"}
                    </div>
                  </div>
                  {h.score?.overall !== undefined && (
                    <div className="text-right">
                      <div className="text-lg font-bold">{h.score.overall}/10</div>
                    </div>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        )}
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </div>
    );
  }

  const turns = current.turns ?? [];
  const studentTurnCount = turns.filter((t) => t.role === "student").length;
  const inProgress = current.status === "in_progress";
  const lastTurn = turns[turns.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCurrent(null)} data-testid="button-back-to-list">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour
        </Button>
        <div className="text-sm text-slate-500">
          {studentTurnCount} / 6 réponses · {current.mode === "voice" ? "voix" : "texte"}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <Progress value={(studentTurnCount / 6) * 100} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div ref={scrollRef} className="space-y-3 max-h-[420px] overflow-y-auto">
            {turns.map((t) => (
              <Turn key={t.id} turn={t} />
            ))}
          </div>
        </CardContent>
      </Card>

      {inProgress && lastTurn?.role === "interviewer" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {current.mode === "text" ? (
              <>
                <Textarea
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Votre réponse…"
                  data-testid="textarea-answer"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={submitText}
                    disabled={busy || !text.trim()}
                    data-testid="button-submit-answer"
                  >
                    {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                    Envoyer
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                {!recording ? (
                  <Button
                    onClick={startRecording}
                    disabled={busy || transcribing}
                    data-testid="button-start-recording"
                  >
                    <Mic className="w-4 h-4 mr-1" /> Enregistrer ma réponse
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={stopRecording}
                    data-testid="button-stop-recording"
                  >
                    <Square className="w-4 h-4 mr-1" /> Arrêter
                  </Button>
                )}
                {transcribing && (
                  <span className="text-sm text-slate-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Transcription…
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {inProgress && studentTurnCount >= 6 && (
        <div className="flex justify-end">
          <Button onClick={finish} disabled={busy} data-testid="button-finish-interview">
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Star className="w-4 h-4 mr-1" />}
            Terminer et obtenir le bilan
          </Button>
        </div>
      )}
      {inProgress && studentTurnCount > 0 && studentTurnCount < 6 && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={finish} disabled={busy} data-testid="button-finish-early">
            Terminer plus tôt
          </Button>
        </div>
      )}

      {current.status === "completed" && <ReportPanel interview={current} onRestart={() => setCurrent(null)} />}

      {error && <div className="text-sm text-rose-600">{error}</div>}
    </div>
  );
}

function Turn({ turn }: { turn: InterviewTurnUI }) {
  const isInterviewer = turn.role === "interviewer";
  return (
    <div className={`flex ${isInterviewer ? "justify-start" : "justify-end"}`} data-testid={`turn-${turn.id}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm whitespace-pre-wrap ${
          isInterviewer
            ? "bg-white border border-slate-200 text-slate-800"
            : "bg-blue-600 text-white"
        }`}
      >
        <div className="text-[11px] uppercase tracking-wide font-semibold opacity-70 mb-0.5">
          {isInterviewer ? "Examinateur" : "Vous"}
        </div>
        {turn.content}
      </div>
    </div>
  );
}

function ReportPanel({
  interview,
  onRestart,
}: {
  interview: InterviewUI;
  onRestart: () => void;
}) {
  const score = interview.score ?? {};
  const axes: { key: keyof typeof score; label: string }[] = [
    { key: "motivation", label: "Motivation" },
    { key: "coherence", label: "Cohérence" },
    { key: "french", label: "Français" },
    { key: "knowledge", label: "Connaissance du programme" },
    { key: "returnPlan", label: "Plan de retour" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Bilan de l'entretien
          </span>
          <Button size="sm" variant="outline" onClick={onRestart} data-testid="button-restart-interview">
            <RotateCcw className="w-4 h-4 mr-1" /> Nouvel entretien
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          {axes.map((a) => (
            <div key={a.key as string} className="flex items-center justify-between rounded border p-2 text-sm">
              <span className="text-slate-700">{a.label}</span>
              <span className="font-semibold">
                {typeof score[a.key] === "number" ? `${score[a.key]}/10` : "—"}
              </span>
            </div>
          ))}
        </div>
        {typeof score.overall === "number" && (
          <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 flex items-center justify-between">
            <span className="font-semibold text-indigo-900">Note globale</span>
            <span className="text-2xl font-bold text-indigo-900">{score.overall}/10</span>
          </div>
        )}
        {interview.feedback && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">
              Retour de l'examinateur
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap" data-testid="text-interview-feedback">
              {interview.feedback}
            </p>
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-3">
          {interview.strengths && interview.strengths.length > 0 && (
            <ListBlock title="Points forts" tone="emerald" items={interview.strengths} />
          )}
          {interview.weaknesses && interview.weaknesses.length > 0 && (
            <ListBlock title="Axes de progrès" tone="rose" items={interview.weaknesses} />
          )}
          {interview.suggestions && interview.suggestions.length > 0 && (
            <ListBlock title="Suggestions" tone="blue" items={interview.suggestions} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ListBlock({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "emerald" | "rose" | "blue";
  items: string[];
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50",
    rose: "border-rose-200 bg-rose-50",
    blue: "border-blue-200 bg-blue-50",
  };
  return (
    <div className={`rounded-lg border ${tones[tone]} p-3`}>
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
