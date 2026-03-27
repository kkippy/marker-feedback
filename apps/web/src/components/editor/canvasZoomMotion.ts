export const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

export const interpolateViewportTransition = ({
  startZoom,
  targetZoom,
  startLeft,
  targetLeft,
  startTop,
  targetTop,
  progress,
}: {
  startZoom: number;
  targetZoom: number;
  startLeft: number;
  targetLeft: number;
  startTop: number;
  targetTop: number;
  progress: number;
}) => {
  const easedProgress = easeOutCubic(progress);

  return {
    zoom: startZoom + (targetZoom - startZoom) * easedProgress,
    left: startLeft + (targetLeft - startLeft) * easedProgress,
    top: startTop + (targetTop - startTop) * easedProgress,
  };
};
