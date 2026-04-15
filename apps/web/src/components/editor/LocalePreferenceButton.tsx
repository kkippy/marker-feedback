import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { localePreferences, useLocale } from '@/lib/locale';

function useDismissibleLayer<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, onClose]);

  return ref;
}

export function LocalePreferenceButton({ variant = 'default' }: { variant?: 'default' | 'homepage' }) {
  const { messages, preference, setPreference } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useDismissibleLayer<HTMLDivElement>(isOpen, () => setIsOpen(false));
  const isHomepage = variant === 'homepage';
  const listboxId = `locale-preference-listbox-${variant}`;

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
          setIsOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={messages.language.selectAriaLabel}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`inline-flex items-center gap-2 rounded-full border transition ${
          isHomepage
            ? `h-11 px-4 text-[13px] font-semibold ${
                isOpen
                  ? 'border-blue-200 bg-white text-slate-700 shadow-[0_12px_28px_rgba(37,99,235,0.08)]'
                  : 'border-blue-100 bg-white/88 text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.04)] hover:border-blue-200 hover:bg-white'
              }`
            : `px-3 py-1.5 text-sm font-medium ${
                isOpen
                  ? 'border-slate-300 bg-white text-slate-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
              }`
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={isHomepage ? 'text-slate-500' : 'text-slate-500'}>
          {messages.language.label}
        </span>
        <span className={isHomepage ? 'text-slate-700' : 'text-slate-700'}>
          {messages.language.options[preference]}
        </span>
        <ChevronDown
          className={`size-4 ${isHomepage ? 'text-slate-400' : 'text-slate-400'} transition ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          aria-label={messages.language.selectAriaLabel}
          role="listbox"
          className={`absolute top-full z-20 mt-2 min-w-52 rounded-2xl border bg-white/96 p-2 backdrop-blur ${
            isHomepage
              ? 'right-0 border-blue-100 shadow-[0_20px_48px_rgba(37,99,235,0.12)]'
              : 'left-0 border-slate-200 shadow-[0_18px_48px_rgba(15,23,42,0.14)]'
          }`}
        >
          <div className="flex flex-col gap-1">
            {localePreferences.map((option) => {
              return (
                <button
                  key={option}
                  type="button"
                  aria-label={messages.language.options[option]}
                  aria-selected={option === preference}
                  role="option"
                  className={`relative flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-150 ease-out ${
                    option === preference
                      ? isHomepage
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    setPreference(option);
                    setIsOpen(false);
                  }}
                >
                  <span className="relative z-10 text-xs">
                    {messages.language.options[option]}
                  </span>
                  {option === preference ? <span className="relative z-10 text-xs text-white/80">&bull;</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
