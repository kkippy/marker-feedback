import { describe, expect, it } from 'vitest';
import { moveGeometry, normalizeRect } from './geometry.js';

describe('normalizeRect', () => {
  it('creates a positive rectangle regardless of drag direction', () => {
    expect(normalizeRect({ x1: 40, y1: 60, x2: 10, y2: 20 })).toEqual({
      kind: 'rect',
      x: 10,
      y: 20,
      width: 30,
      height: 40
    });
  });

  it('moves line geometry by delta', () => {
    expect(
      moveGeometry(
        { kind: 'line', points: [10, 20, 30, 40] },
        5,
        -10,
      ),
    ).toEqual({
      kind: 'line',
      points: [15, 10, 35, 30],
    });
  });
});
