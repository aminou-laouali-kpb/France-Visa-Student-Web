import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useTranslation } from "react-i18next";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PlaybookStep {
  order: number;
  title: string;
  detail: string;
}

export interface Playbook {
  id: string;
  title: string;
  when: string;
  steps: PlaybookStep[];
}

async function fetchPlaybooks(
  studentId: number,
  getToken: () => Promise<string | null>,
): Promise<Playbook[]> {
  const token = await getToken();
  const res = await fetch(`/api/students/${studentId}/playbooks`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("playbooks");
  const data = (await res.json()) as Playbook[] | { playbooks: Playbook[] };
  return Array.isArray(data) ? data : data.playbooks;
}

export function PlaybookPanel({ studentId }: { studentId: number }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPlaybooks(studentId, getToken);
        if (!cancelled) {
          setPlaybooks(data);
          if (data[0]) setOpenId(data[0].id);
        }
      } catch {
        if (!cancelled) setPlaybooks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, getToken]);

  if (loading) {
    return (
      <Card data-testid="playbook-panel">
        <CardContent className="p-4 text-sm text-slate-500">
          {t("dash.loading")}
        </CardContent>
      </Card>
    );
  }

  if (playbooks.length === 0) return null;

  return (
    <Card data-testid="playbook-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          {t("playbook.title")}
        </CardTitle>
        <p className="text-xs text-slate-500">{t("playbook.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {playbooks.map((pb) => {
          const isOpen = openId === pb.id;
          return (
            <div
              key={pb.id}
              className="border border-slate-200 rounded-lg overflow-hidden"
              data-testid={`playbook-${pb.id}`}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 p-3 text-left bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-900"
                onClick={() => setOpenId(isOpen ? null : pb.id)}
              >
                <span>{pb.title}</span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="p-3 space-y-3 bg-white">
                  <p className="text-xs text-slate-500">{pb.when}</p>
                  <ol className="space-y-2">
                    {pb.steps.map((step) => (
                      <li key={step.order} className="text-sm">
                        <span className="font-medium text-slate-800">
                          {step.order}. {step.title}
                        </span>
                        <p className="text-slate-600 mt-0.5">{step.detail}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
