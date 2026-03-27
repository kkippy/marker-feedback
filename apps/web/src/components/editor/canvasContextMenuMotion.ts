const DOCK_RADIUS = 96;

const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

export const getContextMenuDockMotion = (distance: number, radius = DOCK_RADIUS) => {
  const normalizedDistance = Math.min(Math.max(distance / radius, 0), 1);
  const influence = distance >= radius ? 0 : easeOutCubic(1 - normalizedDistance);

  return {
    itemScale: Number((1 + influence * 0.055).toFixed(3)),
    iconScale: Number((1 + influence * 0.24).toFixed(3)),
    itemTranslateY: Number((influence * -3.5).toFixed(3)),
    labelTranslateX: Number((influence * 1.75).toFixed(3)),
    highlightOpacity: Number((influence * 0.22).toFixed(3)),
  };
};
