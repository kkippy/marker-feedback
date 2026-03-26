# Minimap Click Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users click any point in the editor minimap and immediately scroll the main canvas so that the corresponding workspace position is centered in view.

**Architecture:** Extract the viewport-scroll math into a focused helper so minimap clicks can reuse the same coordinate system as the existing canvas viewport. Add helper-level Vitest coverage first, then wire the minimap container in `AnnotationCanvas.tsx` to translate click coordinates into workspace coordinates and scroll the viewport without changing zoom.

**Tech Stack:** React, TypeScript, Vitest, Vite, Konva

---

### Task 1: Extract scroll-target math for viewport centering

**Files:**
- Create: `apps/web/src/components/editor/minimapNavigation.ts`
- Test: `apps/web/src/components/editor/minimapNavigation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('centers the viewport around a workspace point', () => {
  expect(
    getViewportScrollForWorkspacePoint({
      target: { x: 1200, y: 900 },
      canvasScale: 0.5,
      layerOffsetX: 100,
      layerOffsetY: 60,
      viewportWidth: 800,
      viewportHeight: 600,
      stageWidth: 2200,
      stageHeight: 1600,
    }),
  ).toEqual({ left: 300, top: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @marker/web -- minimapNavigation.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export const getViewportScrollForWorkspacePoint = (...) => {
  const rawLeft = target.x * canvasScale + layerOffsetX - viewportWidth / 2;
  const rawTop = target.y * canvasScale + layerOffsetY - viewportHeight / 2;
  return {
    left: clamp(rawLeft, 0, Math.max(0, stageWidth - viewportWidth)),
    top: clamp(rawTop, 0, Math.max(0, stageHeight - viewportHeight)),
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w @marker/web -- minimapNavigation.test.ts`
Expected: PASS.

### Task 2: Cover edge clamping cases

**Files:**
- Modify: `apps/web/src/components/editor/minimapNavigation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('clamps to the workspace bounds near the bottom-right edge', () => {
  expect(...).toEqual({ left: maxLeft, top: maxTop });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @marker/web -- minimapNavigation.test.ts`
Expected: FAIL with mismatched scroll values.

- [ ] **Step 3: Extend the implementation minimally**

Ensure the helper clamps both axes against the stage scroll limits.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w @marker/web -- minimapNavigation.test.ts`
Expected: PASS.

### Task 3: Wire minimap click-to-center behavior

**Files:**
- Modify: `apps/web/src/components/editor/AnnotationCanvas.tsx`
- Reference: `apps/web/src/components/editor/minimapNavigation.ts`

- [ ] **Step 1: Add a failing interaction path**

Describe the intended integration in code by calling the new helper from a minimap click handler before the handler exists.

- [ ] **Step 2: Run targeted tests to verify coverage remains focused**

Run: `npm run test -w @marker/web -- minimapNavigation.test.ts`
Expected: existing helper tests still pass while integration is not yet complete.

- [ ] **Step 3: Implement minimal UI wiring**

Add a minimap click handler that:
- reads pointer coordinates relative to the minimap box
- maps them into workspace coordinates
- uses the helper to compute `scrollLeft` / `scrollTop`
- updates the viewport immediately and syncs `scrollPosition`

- [ ] **Step 4: Keep the existing overlay rendering intact**

Preserve document/viewport rectangles, zoom controls, and current styling while only enabling pointer interaction on the minimap container.

### Task 4: Verify editor behavior

**Files:**
- Verify: `apps/web/src/components/editor/AnnotationCanvas.tsx`
- Verify: `apps/web/src/components/editor/minimapNavigation.ts`
- Verify: `apps/web/src/components/editor/minimapNavigation.test.ts`

- [ ] **Step 1: Run the focused minimap test file**

Run: `npm run test -w @marker/web -- minimapNavigation.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the web build**

Run: `npm run build:web`
Expected: build succeeds.

- [ ] **Step 3: Summarize manual verification guidance**

Confirm that clicking the minimap should move the main viewport toward the clicked region without changing zoom.

## Notes

- Follow TDD: no production helper or click handler code before the failing tests exist.
- Do not add drag behavior or smooth-scroll animation in this change.
- Skip commits unless the user explicitly asks for them.
