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

  const homepageGlobe = (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.2 2.3 3.3 5.3 3.3 9s-1.1 6.7-3.3 9M12 3c-2.2 2.3-3.3 5.3-3.3 9s1.1 6.7 3.3 9" />
    </svg>
  );

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
            ? 'mf-homepage-lang-trigger'
            : `px-3 py-1.5 text-sm font-medium ${
                isOpen
                  ? 'border-slate-300 bg-white text-slate-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
              }`
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isHomepage ? homepageGlobe : <span className="text-slate-500">{messages.language.label}</span>}
        <span className={isHomepage ? '' : 'text-slate-700'}>
          {isHomepage ? messages.language.label : messages.language.options[preference]}
        </span>
        <ChevronDown
          className={`${isHomepage ? 'mf-homepage-lang-chevron' : 'size-4 text-slate-400'} transition ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          aria-label={messages.language.selectAriaLabel}
          role="listbox"
          className={`absolute top-full z-20 mt-2 min-w-52 rounded-2xl border bg-white/96 p-2 backdrop-blur ${
            isHomepage
              ? 'mf-homepage-lang-menu'
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
