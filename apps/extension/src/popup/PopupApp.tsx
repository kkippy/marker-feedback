import { useMemo, useRef, useState } from 'react';
import { popupMessages, resolvePopupLocale } from './locale';

const WEB_URL = import.meta.env.VITE_WEB_APP_URL ?? 'http://127.0.0.1:3100';

const openEditor = (searchParams: URLSearchParams, hashParams?: URLSearchParams) => {
  const url = new URL('/editor', WEB_URL);
  url.search = searchParams.toString();

  if (hashParams && Array.from(hashParams.keys()).length > 0) {
    url.hash = hashParams.toString();
  }

  return chrome.tabs.create({ url: url.toString() });
};

export function PopupApp() {
  const locale = useMemo(() => resolvePopupLocale(navigator.language), []);
  const messages = popupMessages[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(messages.status.ready);

  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#2563eb',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          Marker Feedback
        </div>
        <h1 style={{ margin: '8px 0 4px', fontSize: 20 }}>{messages.title}</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{messages.description}</p>
      </div>

      <button
        style={{
          borderRadius: 12,
          padding: '12px 14px',
          border: 'none',
          background: '#0f172a',
          color: 'white',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={() => inputRef.current?.click()}
      >
        {messages.actions.upload}
      </button>
      <button
        style={{
          borderRadius: 12,
          padding: '12px 14px',
          border: '1px solid #cbd5e1',
          background: 'white',
          color: '#0f172a',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={() => {
          setStatus(messages.status.capturing);
          chrome.runtime.sendMessage({ type: 'capture-current-tab' }, (response) => {
            if (!response?.ok || !response.dataUrl) {
              setStatus(response?.error ?? messages.status.captureFailed);
              return;
            }

            openEditor(
              new URLSearchParams({ sourceType: 'capture' }),
              new URLSearchParams({ imageDataUrl: response.dataUrl }),
            );
            setStatus(messages.status.openedCapture);
          });
        }}
      >
        {messages.actions.capture}
      </button>
      <button
        style={{
          borderRadius: 12,
          padding: '12px 14px',
          border: '1px solid #cbd5e1',
          background: '#eff6ff',
          color: '#1d4ed8',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={() => openEditor(new URLSearchParams({ sourceType: 'draft', draftId: 'latest' }))}
      >
        {messages.actions.latestDraft}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={async (event) => {
          const file = event.target.files?.[0];

          if (!file) {
            return;
          }

          const imageDataUrl = await readFile(file);
          openEditor(
            new URLSearchParams({ sourceType: 'upload' }),
            new URLSearchParams({ imageDataUrl }),
          );
          setStatus(messages.status.openedFile(file.name));
        }}
      />

      <div style={{ borderRadius: 12, background: '#e2e8f0', padding: 12, fontSize: 12, color: '#334155' }}>
        {status}
      </div>
    </div>
  );
}
