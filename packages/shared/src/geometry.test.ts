import { describe, expect, it } from 'vitest';
import { normalizeRect } from './geometry';

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
});
