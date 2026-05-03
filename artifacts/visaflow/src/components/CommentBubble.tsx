import { useState } from "react";
import { Languages } from "lucide-react";
import type { Comment } from "@/types";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
          {t("comment.translatedByAI")}
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
            ? t("comment.viewTranslation", { lang: t(`language.${otherLang ?? ""}`, { defaultValue: otherLang ?? "" }) })
            : t("comment.viewOriginal", { lang: t(`language.${otherLang ?? ""}`, { defaultValue: otherLang ?? "" }) })}
        </button>
      )}
    </>
  );
}
