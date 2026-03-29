import { create } from 'zustand';
import {
  createId,
  type Annotation,
  type AnnotationStyle,
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
const BUTTON_ZOOM_FACTOR = 1.15;
const DEFAULT_TEXT_WIDTH = 32;
const DEFAULT_TEXT_HEIGHT = 24;

export const DEFAULT_TEXT_STYLE: AnnotationStyle = {
  stroke: '#2563eb',
  fill: 'rgba(255,255,255,0)',
  strokeWidth: 2,
  textColor: '#0f172a',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textBackgroundColor: 'transparent',
  textOutlineColor: 'transparent',
  textOutlineWidth: 0,
  textBoxMode: 'auto',
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
  style: AnnotationStyle;
}

export interface EditorUiState {
  draft: EditorDraft;
  selectedAnnotationId: string | null;
  contextMenu: ContextMenuState;
  inlineTextEditor: InlineTextEditorState | null;
  textStylePreset: AnnotationStyle;
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
  textStylePreset: DEFAULT_TEXT_STYLE,
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
    style: {
      ...state.textStylePreset,
      textBackgroundColor: DEFAULT_TEXT_STYLE.textBackgroundColor,
    },
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
      style: {
        ...DEFAULT_TEXT_STYLE,
        ...annotation.style,
      },
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

export const updateInlineTextSizeState = (
  state: EditorUiState,
  size: { width: number; height: number },
): EditorUiState => {
  if (!state.inlineTextEditor) {
    return state;
  }

  return {
    ...state,
    inlineTextEditor: {
      ...state.inlineTextEditor,
      width: size.width,
      height: size.height,
    },
  };
};

export const updateInlineTextFrameState = (
  state: EditorUiState,
  frame: Partial<Pick<InlineTextEditorState, 'x' | 'y' | 'width' | 'height'>> & {
    boxMode?: AnnotationStyle['textBoxMode'];
    fontSize?: number;
  },
): EditorUiState => {
  if (!state.inlineTextEditor) {
    return state;
  }

  return {
    ...state,
    inlineTextEditor: {
      ...state.inlineTextEditor,
      ...(frame.x !== undefined ? { x: frame.x } : {}),
      ...(frame.y !== undefined ? { y: frame.y } : {}),
      ...(frame.width !== undefined ? { width: frame.width } : {}),
      ...(frame.height !== undefined ? { height: frame.height } : {}),
      style: {
        ...state.inlineTextEditor.style,
        ...(frame.boxMode ? { textBoxMode: frame.boxMode } : {}),
        ...(frame.fontSize !== undefined ? { fontSize: frame.fontSize } : {}),
      },
    },
  };
};

export const updateTextStylePresetState = (
  state: EditorUiState,
  patch: Partial<AnnotationStyle>,
): EditorUiState => {
  const textStylePreset = {
    ...state.textStylePreset,
    ...patch,
  };

  if (!state.inlineTextEditor) {
    return {
      ...state,
      textStylePreset,
    };
  }

  return {
    ...state,
    textStylePreset,
    inlineTextEditor: {
      ...state.inlineTextEditor,
      style: {
        ...state.inlineTextEditor.style,
        ...patch,
      },
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
    style: editor.style,
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
    annotation.style = state.inlineTextEditor.style;

    if (annotation.geometry.kind === 'text') {
      annotation.geometry = {
        ...annotation.geometry,
        x: state.inlineTextEditor.x,
        y: state.inlineTextEditor.y,
        width: state.inlineTextEditor.width,
        height: state.inlineTextEditor.height,
      };
    }

    nextDraft.updatedAt = now();

    return {
      ...state,
      draft: nextDraft,
      inlineTextEditor: null,
      selectedAnnotationId: annotation.id,
      textStylePreset: state.inlineTextEditor.style,
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
    textStylePreset: state.inlineTextEditor.style,
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
  textStylePreset: AnnotationStyle;
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
  updateInlineTextSize: (size: { width: number; height: number }) => void;
  updateInlineTextFrame: (
    frame: Partial<Pick<InlineTextEditorState, 'x' | 'y' | 'width' | 'height'>> & {
      boxMode?: AnnotationStyle['textBoxMode'];
      fontSize?: number;
    },
  ) => void;
  updateTextStylePreset: (patch: Partial<AnnotationStyle>) => void;
  updateSelectedTextStyle: (patch: Partial<AnnotationStyle>) => void;
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
  textStylePreset: DEFAULT_TEXT_STYLE,
  setDraft: (draft) =>
    set({
      draft,
      history: [],
      future: [],
      selectedAnnotationId: null,
      contextMenu: createClosedContextMenu(),
      inlineTextEditor: null,
      textStylePreset: DEFAULT_TEXT_STYLE,
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
      textStylePreset: DEFAULT_TEXT_STYLE,
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
  updateInlineTextSize: (size) =>
    set((state) => updateInlineTextSizeState(state, size)),
  updateInlineTextFrame: (frame) =>
    set((state) => updateInlineTextFrameState(state, frame)),
  updateTextStylePreset: (patch) =>
    set((state) => updateTextStylePresetState(state, patch)),
  updateSelectedTextStyle: (patch) =>
    set((state) => {
      if (state.inlineTextEditor || !state.selectedAnnotationId) {
        return updateTextStylePresetState(state, patch);
      }

      const selectedAnnotation = state.draft.annotations.find((item) => item.id === state.selectedAnnotationId);

      if (!selectedAnnotation || selectedAnnotation.tool !== 'text') {
        return updateTextStylePresetState(state, patch);
      }

      const nextDraft = cloneDraft(state.draft);
      const annotation = nextDraft.annotations.find((item) => item.id === state.selectedAnnotationId);

      if (!annotation || annotation.tool !== 'text') {
        return updateTextStylePresetState(state, patch);
      }

      annotation.style = {
        ...annotation.style,
        ...patch,
      };
      nextDraft.updatedAt = now();

      return {
        ...pushHistory(state, nextDraft),
        textStylePreset: {
          ...state.textStylePreset,
          ...patch,
        },
        contextMenu: createClosedContextMenu(),
        inlineTextEditor: null,
      };
    }),
  commitInlineTextEditor: () =>
    set((state) => {
      const wasEditingText = Boolean(state.inlineTextEditor);
      const nextUi = commitInlineTextEditorState(state);
      const shouldReturnToSelect =
        wasEditingText && nextUi.inlineTextEditor === null && nextUi.draft !== state.draft;

      if (nextUi.draft !== state.draft) {
        return {
          ...pushHistory(state, nextUi.draft),
          activeTool: shouldReturnToSelect ? 'select' : state.activeTool,
          selectedAnnotationId: nextUi.selectedAnnotationId,
          contextMenu: nextUi.contextMenu,
          inlineTextEditor: nextUi.inlineTextEditor,
        };
      }

      return {
        activeTool: shouldReturnToSelect ? 'select' : state.activeTool,
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
  zoomIn: () =>
    set((state) => ({
      zoom: Math.min(MAX_ZOOM, Number((state.zoom * BUTTON_ZOOM_FACTOR).toFixed(2))),
    })),
  zoomOut: () =>
    set((state) => ({
      zoom: Math.max(0.5, Number((state.zoom / BUTTON_ZOOM_FACTOR).toFixed(2))),
    })),
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
