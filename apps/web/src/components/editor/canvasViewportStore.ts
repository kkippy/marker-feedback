import { useSyncExternalStore } from 'react';

export interface ViewportMetrics {
  zoom: number;
  canvasScale: number;
  stageWidth: number;
  stageHeight: number;
  layerOffsetX: number;
  layerOffsetY: number;
  scrollLeft: number;
  scrollTop: number;
}

type Listener = () => void;

let snapshot: ViewportMetrics | null = null;
const listeners = new Set<Listener>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

export const setCanvasViewportSnapshot = (nextSnapshot: ViewportMetrics) => {
  snapshot = nextSnapshot;
  emitChange();
};

export const resetCanvasViewportSnapshot = () => {
  snapshot = null;
  emitChange();
};

export const useCanvasViewportSnapshot = (fallbackSnapshot: ViewportMetrics) =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    () => snapshot ?? fallbackSnapshot,
    () => fallbackSnapshot,
  );
