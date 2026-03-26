# Minimap Click Navigation Design

## Summary

Add click-to-locate behavior to the editor minimap. When the user clicks any point in the minimap, the main canvas scrolls so that the corresponding workspace position moves to the center of the visible viewport.

## Current Context

- The minimap is rendered inside `apps/web/src/components/editor/AnnotationCanvas.tsx`.
- It already computes:
  - the document rectangle inside the workspace
  - the current viewport rectangle inside the minimap
- The main canvas viewport is controlled by `viewportRef`, `scrollLeft`, and `scrollTop`.
- Existing zoom and centering logic already computes scroll targets using `canvasScale`, `layerOffsetX`, `layerOffsetY`, `viewportSize`, `stageWidth`, and `stageHeight`.

## Goal

Reduce navigation friction when the workspace is larger than the current visible area. Users should be able to jump directly to a distant image region with a single click on the minimap.

## Chosen Approach

Implement direct click navigation on the minimap.

### Behavior

- Clicking a point in the minimap maps that point to workspace coordinates.
- The editor scrolls so that the mapped workspace point becomes the center of the visible viewport.
- Current zoom level remains unchanged.
- The resulting scroll position is clamped so the viewport never scrolls outside the stage bounds.

### Non-Goals

- No minimap drag-to-pan in this change.
- No animated scrolling in this change.
- No zoom changes tied to minimap interaction.

## Design

### Interaction Model

- Make the minimap container interactive instead of display-only.
- Use pointer coordinates relative to the minimap box.
- Convert minimap coordinates into workspace coordinates using the existing minimap width and height scaling.
- Reuse a shared scroll-target helper to move the main viewport.

### Scroll Target Calculation

Introduce a small helper that:

1. accepts a workspace target point
2. converts that point into scaled stage coordinates
3. subtracts half the viewport width and height
4. clamps the result between `0` and the max scroll extents

This keeps the minimap click behavior aligned with existing fit/zoom centering math.

### Edge Handling

- Clicking near the minimap edges should still work.
- Targets near workspace edges clamp to the nearest legal viewport scroll position.
- If the viewport or scale is unavailable, the click does nothing.

## Testing Strategy

Add focused tests around the extracted scroll math:

- centers the viewport around a clicked minimap point
- clamps to the top-left bounds
- clamps to the bottom-right bounds

Keep tests at the helper level so they are deterministic and do not require Konva rendering.

## Files Expected To Change

- `apps/web/src/components/editor/AnnotationCanvas.tsx`
- `apps/web/src/components/editor` helper file if extraction improves testability
- new or updated test file near the extracted helper

## Risks

- Incorrect conversion between minimap coordinates and workspace coordinates could produce offset jumps.
- Clamp logic must use stage dimensions, not just workspace dimensions, to stay consistent with the existing centered layout.

## Acceptance Criteria

- Clicking the minimap moves the main canvas so the clicked location is centered in view when possible.
- Clicking near edges lands as close as possible without overscrolling.
- Existing fit, 1:1, wheel zoom, and manual pan behavior continue to work.
