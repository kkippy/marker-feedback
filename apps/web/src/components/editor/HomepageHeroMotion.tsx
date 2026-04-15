import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const usePrefersReducedMotion = () => {
  const getPreference = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  };

  const [reduced, setReduced] = useState(getPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => {
        query.removeEventListener?.('change', handleChange);
      };
    }

    query.addListener?.(handleChange);
    return () => {
      query.removeListener?.(handleChange);
    };
  }, []);

  return reduced;
};

const StaticComposition = () => (
  <div
    data-testid="homepage-hero-motion-static"
    className="flex h-full w-full flex-col justify-between gap-6 px-7 py-8"
  >
    <div className="flex items-center gap-3">
      <div className="h-2 w-20 rounded-full bg-white/80" />
      <div className="h-2 w-12 rounded-full bg-sky-100/70" />
    </div>

    <div className="grid grid-cols-[1.1fr_0.9fr] gap-4">
      <div className="rounded-[26px] border border-sky-200/35 bg-sky-100/25" />
      <div className="rounded-[22px] bg-blue-100/30" />
    </div>

    <div className="flex flex-col gap-3">
      <div className="h-2 w-[72%] rounded-full bg-slate-300/45" />
      <div className="h-2 w-[48%] rounded-full bg-slate-300/30" />
    </div>
  </div>
);

export function HomepageHeroMotion() {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      data-motion-mode={reduced ? 'reduced' : 'full'}
      data-testid="homepage-hero-motion"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[34px]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.7),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(125,211,252,0.2),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(219,234,254,0.06)_100%)]" />

      {reduced ? (
        <StaticComposition />
      ) : (
        <svg data-testid="homepage-hero-motion-animated" viewBox="0 0 520 560" className="h-full w-full">
          <rect
            data-testid="homepage-motion-annotation-rect"
            x="42"
            y="84"
            width="198"
            height="134"
            rx="26"
            fill="rgba(186,230,253,0.14)"
            stroke="rgba(96,165,250,0.24)"
            strokeWidth="2"
          >
            <animate attributeName="opacity" values="0.42;0.62;0.42" dur="8s" repeatCount="indefinite" />
            <animate attributeName="y" values="84;78;84" dur="10s" repeatCount="indefinite" />
          </rect>

          <rect
            data-testid="homepage-motion-highlight"
            x="292"
            y="160"
            width="166"
            height="118"
            rx="18"
            fill="rgba(96,165,250,0.16)"
            stroke="rgba(96,165,250,0.16)"
            strokeWidth="2"
          >
            <animate attributeName="opacity" values="0.36;0.56;0.36" dur="7.5s" repeatCount="indefinite" />
            <animate attributeName="x" values="292;302;292" dur="9s" repeatCount="indefinite" />
          </rect>

          <path
            data-testid="homepage-motion-connector"
            d="M226 206 C270 220 284 246 326 236"
            fill="none"
            stroke="rgba(96,165,250,0.34)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="10 10"
          >
            <animate attributeName="stroke-dashoffset" values="0;20;0" dur="9s" repeatCount="indefinite" />
          </path>

          <g data-testid="homepage-motion-text-bars" fill="rgba(100,116,139,0.3)">
            <rect x="66" y="326" width="224" height="12" rx="6">
              <animate attributeName="width" values="212;238;212" dur="8.5s" repeatCount="indefinite" />
            </rect>
            <rect x="66" y="354" width="156" height="12" rx="6">
              <animate attributeName="width" values="148;170;148" dur="7s" repeatCount="indefinite" />
            </rect>
            <rect x="66" y="382" width="108" height="12" rx="6">
              <animate attributeName="width" values="100;124;100" dur="7.5s" repeatCount="indefinite" />
            </rect>
          </g>
        </svg>
      )}
    </div>
  );
}
