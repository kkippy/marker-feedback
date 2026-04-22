import type { ReactNode } from 'react';
import { motion } from 'motion/react';

export const routeSharedLayoutIds = {
  primarySurface: 'route-primary-surface',
  previewStage: 'route-preview-stage',
  latestProject: 'route-latest-project',
  projectGrid: 'route-project-grid',
  currentProject: 'route-current-project',
} as const;

export const routeSharedTransition = {
  type: 'tween',
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1],
} as const;

export const routePageTransition = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1],
} as const;

export const routeShellStates = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export const routeContentFadeStates = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export const routeCenterScaleStates = {
  home: {
    initial: { opacity: 0, scale: 1.008 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.992 },
  },
  canvas: {
    initial: { opacity: 0, scale: 0.992 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.008 },
  },
} as const;

export function RouteTransitionShell({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      data-testid={`route-transition-${routeKey}`}
      className="absolute inset-0 overflow-auto"
      style={{ willChange: 'opacity' }}
      initial={routeShellStates.initial}
      animate={routeShellStates.animate}
      exit={routeShellStates.exit}
      transition={routePageTransition}
    >
      {children}
    </motion.div>
  );
}
