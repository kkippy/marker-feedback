import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/lib/locale';

export function CreateProjectDialog(props: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; file: File }) => void | Promise<void>;
}) {
  const { messages } = useLocale();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!props.open) {
      setName('');
      setFile(null);
      setSubmitting(false);
    }
  }, [props.open]);

  const canSubmit = useMemo(
    () => !submitting && name.trim().length > 0 && Boolean(file),
    [file, name, submitting],
  );

  if (!props.open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">{messages.editor.createProjectTitle}</h2>
          <p className="text-sm leading-6 text-slate-500">{messages.editor.createProjectDescription}</p>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">{messages.editor.projectNameLabel}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">{messages.editor.screenshotLabel}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border border-dashed border-[#cfe1ff] bg-[#f7fbff] px-4 py-3 text-sm text-slate-600 transition file:mr-3 file:rounded-xl file:border-0 file:bg-[#348bff] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white file:shadow-[0_10px_24px_rgba(52,139,255,0.28)] file:transition file:hover:bg-[#2f7de8] hover:border-[#b7d3ff]"
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={props.onClose}
          >
            {messages.editor.createProjectCancel}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={async () => {
              if (!file || !name.trim()) {
                return;
              }

              setSubmitting(true);
              try {
                await props.onCreate({
                  name: name.trim(),
                  file,
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {messages.editor.createProjectSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
