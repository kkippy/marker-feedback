export const shouldHandleCanvasZoomShortcut = ({
  ctrlKey,
  metaKey,
}: {
  ctrlKey: boolean;
  metaKey: boolean;
}) => ctrlKey || metaKey;

const WHEEL_ZOOM_SENSITIVITY = 0.00195;
const WHEEL_LINE_HEIGHT_PX = 16;
const WHEEL_PAGE_HEIGHT_PX = 800;
const TRACKPAD_DELTA_BOOST_THRESHOLD = 24;
const TRACKPAD_DELTA_BOOST = 2.9;
const MAX_NORMALIZED_WHEEL_DELTA = 120;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeWheelDelta = ({
  deltaY,
  deltaMode,
}: {
  deltaY: number;
  deltaMode?: number;
}) => {
  const modeAdjustedDelta =
    deltaMode === 1
      ? deltaY * WHEEL_LINE_HEIGHT_PX
      : deltaMode === 2
        ? deltaY * WHEEL_PAGE_HEIGHT_PX
        : deltaY;
  const boostedDelta =
    Math.abs(modeAdjustedDelta) < TRACKPAD_DELTA_BOOST_THRESHOLD
      ? modeAdjustedDelta * TRACKPAD_DELTA_BOOST
      : modeAdjustedDelta;

  return clamp(boostedDelta, -MAX_NORMALIZED_WHEEL_DELTA, MAX_NORMALIZED_WHEEL_DELTA);
};

export const getNormalizedCanvasWheelDelta = ({
  deltaY,
  deltaMode,
}: {
  deltaY: number;
  deltaMode?: number;
}) => normalizeWheelDelta({ deltaY, deltaMode });

export const getNextCanvasZoomFromNormalizedDelta = ({
  currentZoom,
  normalizedDelta,
  minZoom,
  maxZoom,
}: {
  currentZoom: number;
  normalizedDelta: number;
  minZoom: number;
  maxZoom: number;
}) => {
  const zoomFactor = Math.exp(-normalizedDelta * WHEEL_ZOOM_SENSITIVITY);
  const nextZoom = currentZoom * zoomFactor;

  return Number(Math.min(maxZoom, Math.max(minZoom, nextZoom)).toFixed(3));
};

export const getNextCanvasZoom = ({
  currentZoom,
  deltaY,
  deltaMode,
  minZoom,
  maxZoom,
}: {
  currentZoom: number;
  deltaY: number;
  deltaMode?: number;
  minZoom: number;
  maxZoom: number;
}) => {
  const normalizedDelta = normalizeWheelDelta({ deltaY, deltaMode });

  return getNextCanvasZoomFromNormalizedDelta({
    currentZoom,
    normalizedDelta,
    minZoom,
    maxZoom,
  });
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
