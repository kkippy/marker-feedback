import { create } from 'zustand';
import {
  createId,
  type Annotation,
  type AnnotationTool,
  type Comment,
  type EditorDraft,
  type ImageAsset,
  type TextGeometry,
  type ThreadStatus,
} from '@marker/shared';

const cloneDraft = (draft: EditorDraft): EditorDraft => JSON.parse(JSON.stringify(draft));
const now = () => new Date().toISOString();
const MAX_ZOOM = 6;
const DEFAULT_TEXT_WIDTH = 180;
const DEFAULT_TEXT_HEIGHT = 72;
const DEFAULT_TEXT_STYLE = {
  stroke: '#2563eb',
  fill: 'rgba(255,255,255,0.95)',
  strokeWidth: 2,
};

export const createEmptyDraft = (): EditorDraft => ({
  id: createId('draft'),
  asset: null,
  annotations: [],
  threads: [],
  updatedAt: now(),
});

type DraftMutator = (draft: EditorDraft) => void;

export type ContextMenuTarget =
  | { kind: 'empty-space'; point: { x: number; y: number } }
  | { kind: 'annotation'; annotationId: string };

export interface ContextMenuState {
  isOpen: boolean;
  screenX: number;
  screenY: number;
  target: ContextMenuTarget | null;
}

export interface InlineTextEditorState {
  mode: 'create' | 'edit';
  annotationId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
}

export interface EditorUiState {
  draft: EditorDraft;
  selectedAnnotationId: string | null;
  contextMenu: ContextMenuState;
  inlineTextEditor: InlineTextEditorState | null;
}

const createClosedContextMenu = (): ContextMenuState => ({
  isOpen: false,
  screenX: 0,
  screenY: 0,
  target: null,
});

export const createEditorUiState = (draft: EditorDraft = createEmptyDraft()): EditorUiState => ({
  draft,
  selectedAnnotationId: null,
  contextMenu: createClosedContextMenu(),
  inlineTextEditor: null,
});

export const openContextMenuState = (
  state: EditorUiState,
  target: ContextMenuTarget,
  screenPosition: { x: number; y: number },
): EditorUiState => ({
  ...state,
  selectedAnnotationId: target.kind === 'annotation' ? target.annotationId : state.selectedAnnotationId,
  contextMenu: {
    isOpen: true,
    screenX: screenPosition.x,
    screenY: screenPosition.y,
    target,
  },
});

export const closeContextMenuState = (state: EditorUiState): EditorUiState => ({
  ...state,
  contextMenu: createClosedContextMenu(),
});

export const startInlineTextCreateState = (
  state: EditorUiState,
  point: { x: number; y: number },
): EditorUiState => ({
  ...closeContextMenuState(state),
  inlineTextEditor: {
    mode: 'create',
    annotationId: null,
    x: point.x,
    y: point.y,
    width: DEFAULT_TEXT_WIDTH,
    height: DEFAULT_TEXT_HEIGHT,
    value: '',
  },
});

export const startInlineTextEditState = (
  state: EditorUiState,
  annotationId: string,
): EditorUiState => {
  const annotation = state.draft.annotations.find((item) => item.id === annotationId);

  if (!annotation || annotation.tool !== 'text' || annotation.geometry.kind !== 'text') {
    return state;
  }

  return {
    ...closeContextMenuState(state),
    selectedAnnotationId: annotationId,
    inlineTextEditor: {
      mode: 'edit',
      annotationId,
      x: annotation.geometry.x,
      y: annotation.geometry.y,
      width: annotation.geometry.width,
      height: annotation.geometry.height,
      value: annotation.label ?? '',
    },
  };
};

export const updateInlineTextValueState = (
  state: EditorUiState,
  value: string,
): EditorUiState => {
  if (!state.inlineTextEditor) {
    return state;
  }

  return {
    ...state,
    inlineTextEditor: {
      ...state.inlineTextEditor,
      value,
    },
  };
};

export const cancelInlineTextEditorState = (state: EditorUiState): EditorUiState => ({
  ...state,
  inlineTextEditor: null,
});

const createTextAnnotation = (
  draft: EditorDraft,
  editor: InlineTextEditorState,
  label: string,
): Annotation | null => {
  if (!draft.asset) {
    return null;
  }

  return {
    id: createId('annotation'),
    assetId: draft.asset.id,
    tool: 'text',
    geometry: {
      kind: 'text',
      x: editor.x,
      y: editor.y,
      width: editor.width,
      height: editor.height,
    },
    label,
    style: DEFAULT_TEXT_STYLE,
    createdAt: now(),
  };
};

export const commitInlineTextEditorState = (state: EditorUiState): EditorUiState => {
  if (!state.inlineTextEditor) {
    return state;
  }

  const value = state.inlineTextEditor.value.trim();

  if (!value) {
    return cancelInlineTextEditorState(state);
  }

  if (state.inlineTextEditor.mode === 'edit' && state.inlineTextEditor.annotationId) {
    const nextDraft = cloneDraft(state.draft);
    const annotation = nextDraft.annotations.find((item) => item.id === state.inlineTextEditor?.annotationId);

    if (!annotation || annotation.tool !== 'text') {
      return cancelInlineTextEditorState(state);
    }

    annotation.label = value;
    nextDraft.updatedAt = now();

    return {
      ...state,
      draft: nextDraft,
      inlineTextEditor: null,
      selectedAnnotationId: annotation.id,
    };
  }

  const nextDraft = cloneDraft(state.draft);
  const annotation = createTextAnnotation(nextDraft, state.inlineTextEditor, value);

  if (!annotation) {
    return cancelInlineTextEditorState(state);
  }

  nextDraft.annotations.push(annotation);
  nextDraft.updatedAt = now();

  return {
    ...state,
    draft: nextDraft,
    inlineTextEditor: null,
    selectedAnnotationId: annotation.id,
  };
};

interface EditorState {
  draft: EditorDraft;
  history: EditorDraft[];
  future: EditorDraft[];
  activeTool: AnnotationTool;
  selectedAnnotationId: string | null;
  zoom: number;
  contextMenu: ContextMenuState;
  inlineTextEditor: InlineTextEditorState | null;
  setDraft: (draft: EditorDraft) => void;
  resetDraft: () => void;
  setAsset: (asset: ImageAsset) => void;
  setActiveTool: (tool: AnnotationTool) => void;
  setSelectedAnnotation: (annotationId: string | null) => void;
  openContextMenu: (target: ContextMenuTarget, screenPosition: { x: number; y: number }) => void;
  closeContextMenu: () => void;
  startInlineTextCreate: (point: { x: number; y: number }) => void;
  startInlineTextEdit: (annotationId: string) => void;
  updateInlineTextValue: (value: string) => void;
  commitInlineTextEditor: () => void;
  cancelInlineTextEditor: () => void;
  setAssetPosition: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  commitDraft: (mutator: DraftMutator) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (annotationId: string, mutator: (annotation: Annotation) => void) => void;
  createThreadComment: (body: string, annotationId: string | null) => void;
  replyToThread: (threadId: string, body: string, parentId?: string | null) => void;
  updateThreadStatus: (threadId: string, status: ThreadStatus) => void;
  undo: () => void;
  redo: () => void;
}

const pushHistory = (state: EditorState, nextDraft: EditorDraft) => ({
  draft: nextDraft,
  history: [...state.history, cloneDraft(state.draft)].slice(-50),
  future: [],
});

export const useEditorStore = create<EditorState>((set, get) => ({
  draft: createEmptyDraft(),
  history: [],
  future: [],
  activeTool: 'select',
  selectedAnnotationId: null,
  zoom: 1,
  contextMenu: createClosedContextMenu(),
  inlineTextEditor: null,
  setDraft: (draft) =>
    set({
      draft,
      history: [],
      future: [],
      selectedAnnotationId: null,
      contextMenu: createClosedContextMenu(),
      inlineTextEditor: null,
    }),
  resetDraft: () =>
    set({
      draft: createEmptyDraft(),
      history: [],
      future: [],
      selectedAnnotationId: null,
      activeTool: 'select',
      zoom: 1,
      contextMenu: createClosedContextMenu(),
      inlineTextEditor: null,
    }),
  setAsset: (asset) =>
    set((state) => ({
      ...pushHistory(state, { ...state.draft, asset, updatedAt: now() }),
      contextMenu: createClosedContextMenu(),
      inlineTextEditor: null,
    })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectedAnnotation: (annotationId) => set({ selectedAnnotationId: annotationId }),
  openContextMenu: (target, screenPosition) =>
    set((state) => openContextMenuState(state, target, screenPosition)),
  closeContextMenu: () => set((state) => closeContextMenuState(state)),
  startInlineTextCreate: (point) =>
    set((state) => startInlineTextCreateState(state, point)),
  startInlineTextEdit: (annotationId) =>
    set((state) => startInlineTextEditState(state, annotationId)),
  updateInlineTextValue: (value) =>
    set((state) => updateInlineTextValueState(state, value)),
  commitInlineTextEditor: () =>
    set((state) => {
      const nextUi = commitInlineTextEditorState(state);

      if (nextUi.draft !== state.draft) {
        return {
          ...pushHistory(state, nextUi.draft),
          selectedAnnotationId: nextUi.selectedAnnotationId,
          contextMenu: nextUi.contextMenu,
          inlineTextEditor: nextUi.inlineTextEditor,
        };
      }

      return {
        selectedAnnotationId: nextUi.selectedAnnotationId,
        contextMenu: nextUi.contextMenu,
        inlineTextEditor: nextUi.inlineTextEditor,
      };
    }),
  cancelInlineTextEditor: () =>
    set((state) => cancelInlineTextEditorState(state)),
  setAssetPosition: (x, y) =>
    get().commitDraft((draft) => {
      if (draft.asset) {
        draft.asset.x = x;
        draft.asset.y = y;
      }
    }),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(MAX_ZOOM, Number(zoom.toFixed(2)))) }),
  zoomIn: () => set((state) => ({ zoom: Math.min(MAX_ZOOM, Number((state.zoom + 0.1).toFixed(2))) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(0.5, Number((state.zoom - 0.1).toFixed(2))) })),
  commitDraft: (mutator) =>
    set((state) => {
      const nextDraft = cloneDraft(state.draft);
      mutator(nextDraft);
      nextDraft.updatedAt = now();

      return {
        ...pushHistory(state, nextDraft),
        contextMenu: createClosedContextMenu(),
        inlineTextEditor: null,
      };
    }),
  addAnnotation: (annotation) => {
    get().commitDraft((draft) => {
      draft.annotations.push(annotation);
    });
    set({ selectedAnnotationId: annotation.id });
  },
  updateAnnotation: (annotationId, mutator) => {
    get().commitDraft((draft) => {
      const annotation = draft.annotations.find((item) => item.id === annotationId);
      if (annotation) {
        mutator(annotation);
      }
    });
  },
  createThreadComment: (body, annotationId) => {
    get().commitDraft((draft) => {
      let thread = draft.threads.find((item) => item.annotationId === annotationId);
      if (!thread) {
        thread = {
          id: createId('thread'),
          assetId: draft.asset?.id ?? 'unknown-asset',
          annotationId,
          title: annotationId ? 'Annotation feedback' : 'General feedback',
          status: 'open',
          createdAt: now(),
          comments: [],
        };
        draft.threads.unshift(thread);
      }
      const comment: Comment = {
        id: createId('comment'),
        threadId: thread.id,
        parentId: null,
        body,
        authorLabel: 'You',
        createdAt: now(),
      };
      thread.comments.push(comment);
    });
  },
  replyToThread: (threadId, body, parentId = null) => {
    get().commitDraft((draft) => {
      const thread = draft.threads.find((item) => item.id === threadId);
      if (!thread) {
        return;
      }
      thread.comments.push({
        id: createId('comment'),
        threadId,
        parentId,
        body,
        authorLabel: 'You',
        createdAt: now(),
      });
    });
  },
  updateThreadStatus: (threadId, status) => {
    get().commitDraft((draft) => {
      const thread = draft.threads.find((item) => item.id === threadId);
      if (thread) {
        thread.status = status;
      }
    });
  },
  undo: () =>
    set((state) => {
      if (!state.history.length) {
        return state;
      }

      const previous = state.history[state.history.length - 1];
      return {
        draft: previous,
        history: state.history.slice(0, -1),
        future: [cloneDraft(state.draft), ...state.future],
        contextMenu: createClosedContextMenu(),
        inlineTextEditor: null,
      };
    }),
  redo: () =>
    set((state) => {
      if (!state.future.length) {
        return state;
      }

      const [next, ...rest] = state.future;
      return {
        draft: next,
        history: [...state.history, cloneDraft(state.draft)],
        future: rest,
        contextMenu: createClosedContextMenu(),
        inlineTextEditor: null,
      };
    }),
}));
