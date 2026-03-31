import { describe, expect, it } from 'vitest';
import { getAnnotationBounds, moveGeometry, normalizeRect } from './geometry.js';

describe('normalizeRect', () => {
  it('creates a positive rectangle regardless of drag direction', () => {
    expect(normalizeRect({ x1: 40, y1: 60, x2: 10, y2: 20 })).toEqual({
      kind: 'rect',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });
});

describe('line geometry helpers', () => {
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

describe('polygon geometry helpers', () => {
  it('moves polygon geometry by delta', () => {
    expect(
      moveGeometry(
        { kind: 'polygon', points: [10, 20, 30, 15, 28, 42] },
        5,
        -10,
      ),
    ).toEqual({
      kind: 'polygon',
      points: [15, 10, 35, 5, 33, 32],
    });
  });

  it('returns bounds that cover all polygon vertices', () => {
    expect(
      getAnnotationBounds({
        id: 'annotation-polygon',
        assetId: 'asset-1',
        tool: 'polygon',
        geometry: {
          kind: 'polygon',
          points: [80, 40, 140, 60, 120, 150, 30, 110],
        },
        style: { stroke: '#2563eb', fill: 'rgba(37,99,235,0.18)' },
        createdAt: '2026-03-31T00:00:00.000Z',
      }),
    ).toEqual({
      x: 30,
      y: 40,
      width: 110,
      height: 110,
    });
  });
});

describe('callout geometry helpers', () => {
  it('moves both the target box and text box together', () => {
    expect(
      moveGeometry(
        {
          kind: 'callout',
          target: { kind: 'rect', x: 40, y: 60, width: 80, height: 50 },
          text: { kind: 'text', x: 160, y: 30, width: 120, height: 70 },
        },
        12,
        -8,
      ),
    ).toEqual({
      kind: 'callout',
      target: { kind: 'rect', x: 52, y: 52, width: 80, height: 50 },
      text: { kind: 'text', x: 172, y: 22, width: 120, height: 70 },
    });
  });

  it('returns bounds that cover both the target box and text box', () => {
    expect(
      getAnnotationBounds({
        id: 'annotation-1',
        assetId: 'asset-1',
        tool: 'callout',
        geometry: {
          kind: 'callout',
          target: { kind: 'rect', x: 40, y: 90, width: 80, height: 50 },
          text: { kind: 'text', x: 160, y: 30, width: 120, height: 70 },
        },
        label: 'Callout',
        style: { stroke: '#2563eb' },
        createdAt: '2026-03-28T00:00:00.000Z',
      }),
    ).toEqual({
      x: 40,
      y: 30,
      width: 240,
      height: 110,
    });
  });
});

describe('image callout geometry helpers', () => {
  it('moves both the target box and image panel together', () => {
    expect(
      moveGeometry(
        {
          kind: 'image-callout',
          target: { kind: 'rect', x: 20, y: 40, width: 90, height: 60 },
          panel: { kind: 'rect', x: 180, y: 30, width: 160, height: 100 },
        },
        15,
        10,
      ),
    ).toEqual({
      kind: 'image-callout',
      target: { kind: 'rect', x: 35, y: 50, width: 90, height: 60 },
      panel: { kind: 'rect', x: 195, y: 40, width: 160, height: 100 },
    });
  });

  it('returns bounds that cover both the target box and image panel', () => {
    expect(
      getAnnotationBounds({
        id: 'annotation-2',
        assetId: 'asset-1',
        tool: 'image-callout',
        geometry: {
          kind: 'image-callout',
          target: { kind: 'rect', x: 20, y: 40, width: 90, height: 60 },
          panel: { kind: 'rect', x: 180, y: 30, width: 160, height: 100 },
        },
        imageAssetId: 'embedded-1',
        style: { stroke: '#2563eb' },
        createdAt: '2026-03-29T00:00:00.000Z',
      }),
    ).toEqual({
      x: 20,
      y: 30,
      width: 320,
      height: 100,
    });
  });
});
