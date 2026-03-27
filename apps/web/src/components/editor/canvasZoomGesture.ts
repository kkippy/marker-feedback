export const shouldHandleCanvasZoomShortcut = ({
  ctrlKey,
  metaKey,
}: {
  ctrlKey: boolean;
  metaKey: boolean;
}) => ctrlKey || metaKey;

const WHEEL_ZOOM_SENSITIVITY = 0.0006;

export const getNextCanvasZoom = ({
  currentZoom,
  deltaY,
  minZoom,
  maxZoom,
}: {
  currentZoom: number;
  deltaY: number;
  minZoom: number;
  maxZoom: number;
}) => {
  const zoomFactor = Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
  const nextZoom = currentZoom * zoomFactor;

  return Number(Math.min(maxZoom, Math.max(minZoom, nextZoom)).toFixed(3));
};

export const getCanvasWheelConfig = ({
  target,
}: {
  target: React.RefObject<EventTarget | null>;
}) => ({
  target,
  eventOptions: { passive: false },
  wheel: {
    threshold: 0,
  },
});
