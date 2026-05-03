import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "visaflow.installDismissed";

export function PWAInstallPrompt() {
  const { t } = useTranslation();
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!evt || hidden) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm"
      data-testid="pwa-install-prompt"
    >
      <Download className="w-5 h-5 text-blue-600 shrink-0" />
      <span className="text-sm flex-1">{t("pwa.installable")}</span>
      <Button
        size="sm"
        onClick={async () => {
          await evt.prompt();
          await evt.userChoice;
          setEvt(null);
        }}
        data-testid="button-pwa-install"
      >
        {t("pwa.install")}
      </Button>
      <button
        className="text-slate-400 hover:text-slate-700"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setHidden(true);
        }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
