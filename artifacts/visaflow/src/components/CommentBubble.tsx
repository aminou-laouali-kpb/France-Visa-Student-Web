import { useState } from "react";
import { Languages } from "lucide-react";
import type { Comment } from "@/types";

const LANG_LABELS: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
  wo: "Wolof",
  ln: "Lingala",
  ar: "Arabe",
};

/**
 * Renders the body of a chat bubble with optional translation toggle.
 * - If a translation exists in the viewer's preferred language, that is
 *   shown by default and the original is one click away.
 * - Otherwise the original is shown without any toggle.
 */
export function CommentBody({
  comment,
  viewerLanguage,
}: {
  comment: Comment;
  viewerLanguage: string | null | undefined;
}) {
  const myLang = viewerLanguage || "fr";
  const hasTranslation =
    !!comment.translatedContent &&
    !!comment.translatedToLanguage &&
    comment.translatedToLanguage === myLang &&
    comment.originalLanguage !== myLang;
  // Default to the translated copy when it matches the viewer's preference.
  const [showOriginal, setShowOriginal] = useState(!hasTranslation);
  const body = !hasTranslation || showOriginal
    ? comment.content
    : (comment.translatedContent as string);
  const otherLang = showOriginal
    ? comment.translatedToLanguage
    : comment.originalLanguage;
  const showingTranslation = hasTranslation && !showOriginal;
  return (
    <>
      <div>{body}</div>
      {showingTranslation && (
        <div
          className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-purple-600/80"
          data-testid={`comment-ai-translation-${comment.id}`}
        >
          <Languages className="w-3 h-3" />
          Traduit par IA
        </div>
      )}
      {hasTranslation && (
        <button
          type="button"
          className="mt-1 inline-flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100 underline-offset-2 hover:underline"
          onClick={() => setShowOriginal((v) => !v)}
          data-testid={`comment-toggle-translation-${comment.id}`}
        >
          <Languages className="w-3 h-3" />
          {showOriginal
            ? `Voir la traduction (${LANG_LABELS[otherLang ?? ""] ?? otherLang})`
            : `Voir l'original (${LANG_LABELS[otherLang ?? ""] ?? otherLang})`}
        </button>
      )}
    </>
  );
}
