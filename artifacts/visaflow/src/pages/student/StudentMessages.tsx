import { useState } from "react";
import {
  useListComments,
  useCreateComment,
  useGetMe,
} from "@workspace/api-client-react";
import type { Comment } from "@/types";
import type { CreateCommentBody } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import { MessageSquare, AlertCircle } from "lucide-react";
import { StudentGate, useMyStudent } from "./StudentLayout";

export function StudentMessages() {
  return (
    <StudentGate>
      <Inner />
    </StudentGate>
  );
}

function Inner() {
  const { student } = useMyStudent();
  const studentId = student!.id;
  const { data: me } = useGetMe();
  const { data: comments = [], refetch } = useListComments(studentId);
  const create = useCreateComment();
  const [content, setContent] = useState("");

  const list = (comments as unknown as Comment[]).filter((c) => !c.isInternal);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await create.mutateAsync({
      studentId,
      data: { content, isInternal: false, isCorrectionRequest: false } as unknown as CreateCommentBody,
    });
    setContent("");
    refetch();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mes messages</h1>
        <p className="text-slate-600 mt-1">
          Échangez avec votre conseiller.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            placeholder="Écrire un message…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            data-testid="textarea-comment"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!content.trim()}
              data-testid="button-send-comment"
            >
              Envoyer
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {list.map((c) => {
          const mine = c.authorId === (me?.id ?? -1);
          return (
            <div
              key={c.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
              data-testid={`comment-${c.id}`}
            >
              <div className="max-w-[75%]">
                <div
                  className={`text-xs text-slate-500 mb-1 flex items-center gap-2 ${
                    mine ? "justify-end" : ""
                  }`}
                >
                  {!mine && (
                    <span className="font-medium text-slate-700">
                      {c.authorName}
                    </span>
                  )}
                  <span>{formatDateTime(c.createdAt)}</span>
                  {mine && (
                    <span className="font-medium text-slate-700">Moi</span>
                  )}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-sm whitespace-pre-wrap ${
                    c.isCorrectionRequest
                      ? "bg-rose-50 border border-rose-200 text-rose-900"
                      : mine
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-800"
                  }`}
                >
                  {c.isCorrectionRequest && (
                    <div className="flex items-center gap-1 text-xs font-semibold mb-1 uppercase tracking-wide">
                      <AlertCircle className="w-3 h-3" />
                      Correction demandée
                    </div>
                  )}
                  {c.content}
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              Aucun message pour l'instant
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
