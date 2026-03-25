import { useMemo, useState } from 'react';
import { CheckCheck, CircleDot, MessageSquarePlus, Reply } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/locale';
import { Textarea } from '@/components/ui/textarea';
import { useEditorStore } from '@/lib/useEditorStore';

export function CommentSidebar({ className }: { className?: string }) {
  const { formatDateTime, messages } = useLocale();
  const [body, setBody] = useState('');
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const threads = useEditorStore((state) => state.draft.threads);
  const selectedAnnotationId = useEditorStore((state) => state.selectedAnnotationId);
  const createThreadComment = useEditorStore((state) => state.createThreadComment);
  const replyToThread = useEditorStore((state) => state.replyToThread);
  const updateThreadStatus = useEditorStore((state) => state.updateThreadStatus);
  const setSelectedAnnotation = useEditorStore((state) => state.setSelectedAnnotation);
  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [threads],
  );

  const resolveAuthorLabel = (authorLabel: string) =>
    authorLabel === 'You' || authorLabel === '你' ? messages.common.you : authorLabel;

  const resolveThreadTitle = (annotationId: string | null, title: string) => {
    if (
      title === 'Annotation feedback' ||
      title === '标注反馈' ||
      title === 'General feedback' ||
      title === '通用反馈'
    ) {
      return annotationId
        ? messages.comments.annotationFeedbackTitle
        : messages.comments.generalFeedbackTitle;
    }

    return title;
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-4 overflow-hidden', className)}>
      <div>
        <h2 className="text-balance text-lg font-semibold text-slate-900">{messages.comments.title}</h2>
        <p className="mt-1 text-pretty text-sm text-slate-500">{messages.comments.description}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-500">
          {selectedAnnotationId
            ? messages.comments.selectedAnnotation(selectedAnnotationId)
            : messages.comments.noAnnotationSelected}
        </p>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={messages.comments.composerPlaceholder}
        />
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            onClick={() => {
              if (!body.trim()) {
                return;
              }

              createThreadComment(body.trim(), selectedAnnotationId);
              setBody('');
            }}
          >
            <MessageSquarePlus className="size-4" />
            {messages.comments.addComment}
          </Button>
        </div>
      </div>

      <div className="canvas-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
        {sortedThreads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            {messages.comments.noComments}
          </div>
        ) : (
          sortedThreads.map((thread) => (
            <Card key={thread.id} className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <button
                    type="button"
                    className="text-left text-sm font-semibold text-slate-900 hover:text-blue-600"
                    onClick={() => setSelectedAnnotation(thread.annotationId)}
                  >
                    {resolveThreadTitle(thread.annotationId, thread.title)}
                  </button>
                  <p className="text-xs text-slate-500">
                    {thread.annotationId
                      ? messages.comments.linkedTo(thread.annotationId)
                      : messages.comments.generalFeedbackLabel}
                  </p>
                </div>
                <Button
                  type="button"
                  className={
                    thread.status === 'open'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }
                  onClick={() =>
                    updateThreadStatus(thread.id, thread.status === 'open' ? 'resolved' : 'open')
                  }
                >
                  {thread.status === 'open' ? (
                    <CircleDot className="size-4" />
                  ) : (
                    <CheckCheck className="size-4" />
                  )}
                  {thread.status === 'open'
                    ? messages.comments.statusOpen
                    : messages.comments.statusResolved}
                </Button>
              </div>

              <div className="space-y-3">
                {thread.comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{resolveAuthorLabel(comment.authorLabel)}</span>
                      <span>{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-pretty text-sm text-slate-700">{comment.body}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Textarea
                  value={replyBodies[thread.id] ?? ''}
                  onChange={(event) =>
                    setReplyBodies((current) => ({ ...current, [thread.id]: event.target.value }))
                  }
                  placeholder={messages.comments.replyPlaceholder}
                  className="min-h-16"
                />
                <div className="flex justify-between">
                  <Badge
                    className={
                      thread.status === 'open'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }
                  >
                    {thread.status === 'open'
                      ? messages.comments.statusOpen
                      : messages.comments.statusResolved}
                  </Badge>
                  <Button
                    type="button"
                    className="bg-slate-800 hover:bg-slate-700"
                    onClick={() => {
                      const reply = replyBodies[thread.id]?.trim();

                      if (!reply) {
                        return;
                      }

                      replyToThread(thread.id, reply);
                      setReplyBodies((current) => ({ ...current, [thread.id]: '' }));
                    }}
                  >
                    <Reply className="size-4" />
                    {messages.comments.reply}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
