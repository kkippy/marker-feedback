import type { CSSProperties } from 'react';

export const CHECKERBOARD_CELL_SIZE = 24;

export const getCanvasCheckerboardStyle = (): CSSProperties => ({
  backgroundColor: '#eef2f7',
  backgroundImage:
    'linear-gradient(45deg, rgba(255,255,255,0.72) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.72) 75%, rgba(255,255,255,0.72)), linear-gradient(45deg, rgba(255,255,255,0.72) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.72) 75%, rgba(255,255,255,0.72))',
  backgroundPosition: '0 0, 12px 12px',
  backgroundSize: `${CHECKERBOARD_CELL_SIZE}px ${CHECKERBOARD_CELL_SIZE}px`,
});
