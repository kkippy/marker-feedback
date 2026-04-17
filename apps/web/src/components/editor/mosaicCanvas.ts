import type { RectGeometry } from '@marker/shared';

export const MIN_MOSAIC_CELL_SIZE = 4;
export const MAX_MOSAIC_CELL_SIZE = 32;
export const DEFAULT_MOSAIC_CELL_SIZE = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getCanvasContext = (canvas: HTMLCanvasElement) => {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
};

export const normalizeMosaicCellSize = (value?: number) => {
  const baseValue =
    typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_MOSAIC_CELL_SIZE;
  return clamp(Math.round(baseValue), MIN_MOSAIC_CELL_SIZE, MAX_MOSAIC_CELL_SIZE);
};

export const getMosaicLayoutForRect = ({
  rect,
  imageBounds,
  assetWidth,
  assetHeight,
}: {
  rect: RectGeometry;
  imageBounds: RectGeometry;
  assetWidth: number;
  assetHeight: number;
}) => {
  const intersectionLeft = Math.max(rect.x, imageBounds.x);
  const intersectionTop = Math.max(rect.y, imageBounds.y);
  const intersectionRight = Math.min(rect.x + rect.width, imageBounds.x + imageBounds.width);
  const intersectionBottom = Math.min(rect.y + rect.height, imageBounds.y + imageBounds.height);
  const intersectionWidth = intersectionRight - intersectionLeft;
  const intersectionHeight = intersectionBottom - intersectionTop;

  if (intersectionWidth <= 0 || intersectionHeight <= 0) {
    return null;
  }

  const scaleX = assetWidth / imageBounds.width;
  const scaleY = assetHeight / imageBounds.height;

  return {
    drawX: intersectionLeft - rect.x,
    drawY: intersectionTop - rect.y,
    drawWidth: intersectionWidth,
    drawHeight: intersectionHeight,
    cropX: (intersectionLeft - imageBounds.x) * scaleX,
    cropY: (intersectionTop - imageBounds.y) * scaleY,
    cropWidth: intersectionWidth * scaleX,
    cropHeight: intersectionHeight * scaleY,
  };
};

export const renderMosaicCanvas = ({
  source,
  crop,
  cellSize,
}: {
  source: CanvasImageSource;
  crop: { x: number; y: number; width: number; height: number };
  cellSize?: number;
}) => {
  const normalizedCellSize = normalizeMosaicCellSize(cellSize);
  const targetWidth = Math.max(1, Math.round(crop.width));
  const targetHeight = Math.max(1, Math.round(crop.height));
  const sampleWidth = Math.max(1, Math.ceil(targetWidth / normalizedCellSize));
  const sampleHeight = Math.max(1, Math.ceil(targetHeight / normalizedCellSize));
  const targetCanvas = document.createElement('canvas');
  const sampleCanvas = document.createElement('canvas');
  const targetContext = getCanvasContext(targetCanvas);
  const sampleContext = getCanvasContext(sampleCanvas);

  if (!targetContext || !sampleContext) {
    return null;
  }

  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;

  sampleContext.clearRect(0, 0, sampleWidth, sampleHeight);
  sampleContext.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    sampleWidth,
    sampleHeight,
  );

  targetContext.clearRect(0, 0, targetWidth, targetHeight);
  targetContext.imageSmoothingEnabled = false;
  targetContext.drawImage(sampleCanvas, 0, 0, sampleWidth, sampleHeight, 0, 0, targetWidth, targetHeight);

  return targetCanvas;
};
