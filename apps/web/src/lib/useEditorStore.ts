import { create } from 'zustand';
import { createId, type Annotation, type AnnotationTool, type Comment, type EditorDraft, type ImageAsset, type ThreadStatus } from '@marker/shared';

const cloneDraft = (draft: EditorDraft): EditorDraft => JSON.parse(JSON.stringify(draft));
const now = () => new Date().toISOString();
export const createEmptyDraft = (): EditorDraft => ({ id: createId('draft'), asset: null, annotations: [], threads: [], updatedAt: now() });
type DraftMutator = (draft: EditorDraft) => void;

interface EditorState {
  draft: EditorDraft; history: EditorDraft[]; future: EditorDraft[]; activeTool: AnnotationTool; selectedAnnotationId: string | null; zoom: number;
  setDraft: (draft: EditorDraft) => void; resetDraft: () => void; setAsset: (asset: ImageAsset) => void; setActiveTool: (tool: AnnotationTool) => void; setSelectedAnnotation: (annotationId: string | null) => void;
  zoomIn: () => void; zoomOut: () => void; commitDraft: (mutator: DraftMutator) => void; addAnnotation: (annotation: Annotation) => void; updateAnnotation: (annotationId: string, mutator: (annotation: Annotation) => void) => void;
  createThreadComment: (body: string, annotationId: string | null) => void; replyToThread: (threadId: string, body: string, parentId?: string | null) => void; updateThreadStatus: (threadId: string, status: ThreadStatus) => void;
  undo: () => void; redo: () => void;
}

const pushHistory = (state: EditorState, nextDraft: EditorDraft) => ({ draft: nextDraft, history: [...state.history, cloneDraft(state.draft)].slice(-50), future: [] });

export const useEditorStore = create<EditorState>((set, get) => ({
  draft: createEmptyDraft(), history: [], future: [], activeTool: 'select', selectedAnnotationId: null, zoom: 1,
  setDraft: (draft) => set({ draft, history: [], future: [], selectedAnnotationId: null }),
  resetDraft: () => set({ draft: createEmptyDraft(), history: [], future: [], selectedAnnotationId: null, activeTool: 'select', zoom: 1 }),
  setAsset: (asset) => set((state) => ({ ...pushHistory(state, { ...state.draft, asset, updatedAt: now() }) })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectedAnnotation: (annotationId) => set({ selectedAnnotationId: annotationId }),
  zoomIn: () => set((state) => ({ zoom: Math.min(2.5, Number((state.zoom + 0.1).toFixed(2))) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(0.5, Number((state.zoom - 0.1).toFixed(2))) })),
  commitDraft: (mutator) => set((state) => { const nextDraft = cloneDraft(state.draft); mutator(nextDraft); nextDraft.updatedAt = now(); return pushHistory(state, nextDraft); }),
  addAnnotation: (annotation) => { get().commitDraft((draft) => { draft.annotations.push(annotation); }); set({ selectedAnnotationId: annotation.id }); },
  updateAnnotation: (annotationId, mutator) => { get().commitDraft((draft) => { const annotation = draft.annotations.find((item) => item.id === annotationId); if (annotation) mutator(annotation); }); },
  createThreadComment: (body, annotationId) => {
    get().commitDraft((draft) => {
      let thread = draft.threads.find((item) => item.annotationId === annotationId);
      if (!thread) {
        thread = { id: createId('thread'), assetId: draft.asset?.id ?? 'unknown-asset', annotationId, title: annotationId ? 'Annotation feedback' : 'General feedback', status: 'open', createdAt: now(), comments: [] };
        draft.threads.unshift(thread);
      }
      const comment: Comment = { id: createId('comment'), threadId: thread.id, parentId: null, body, authorLabel: 'You', createdAt: now() };
      thread.comments.push(comment);
    });
  },
  replyToThread: (threadId, body, parentId = null) => { get().commitDraft((draft) => { const thread = draft.threads.find((item) => item.id === threadId); if (!thread) return; thread.comments.push({ id: createId('comment'), threadId, parentId, body, authorLabel: 'You', createdAt: now() }); }); },
  updateThreadStatus: (threadId, status) => { get().commitDraft((draft) => { const thread = draft.threads.find((item) => item.id === threadId); if (thread) thread.status = status; }); },
  undo: () => set((state) => { if (!state.history.length) return state; const previous = state.history[state.history.length - 1]; return { draft: previous, history: state.history.slice(0, -1), future: [cloneDraft(state.draft), ...state.future] }; }),
  redo: () => set((state) => { if (!state.future.length) return state; const [next, ...rest] = state.future; return { draft: next, history: [...state.history, cloneDraft(state.draft)], future: rest }; }),
}));
