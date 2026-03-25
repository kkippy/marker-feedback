export type AnnotationTool = 'select' | 'rectangle' | 'arrow' | 'highlight' | 'text' | 'blur' | 'marker';
export type ThreadStatus = 'open' | 'resolved';
export type AssetSourceType = 'upload' | 'capture' | 'draft';

export interface ImageAsset {
  id: string;
  sourceType: AssetSourceType;
  imageDataUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface RectGeometry {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrowGeometry {
  kind: 'arrow';
  points: [number, number, number, number];
}

export interface MarkerGeometry {
  kind: 'marker';
  x: number;
  y: number;
}

export interface TextGeometry {
  kind: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnnotationGeometry = RectGeometry | ArrowGeometry | MarkerGeometry | TextGeometry;

export interface AnnotationStyle {
  stroke: string;
  fill?: string;
  strokeWidth?: number;
}

export interface Annotation {
  id: string;
  assetId: string;
  tool: Exclude<AnnotationTool, 'select'>;
  geometry: AnnotationGeometry;
  label?: string;
  style: AnnotationStyle;
  createdAt: string;
}

export interface Comment {
  id: string;
  threadId: string;
  parentId: string | null;
  body: string;
  authorLabel: string;
  createdAt: string;
}

export interface CommentThread {
  id: string;
  assetId: string;
  annotationId: string | null;
  title: string;
  status: ThreadStatus;
  createdAt: string;
  comments: Comment[];
}

export interface EditorDraft {
  id: string;
  asset: ImageAsset | null;
  annotations: Annotation[];
  threads: CommentThread[];
  updatedAt: string;
}

export interface ShareItem {
  id: string;
  shareToken: string;
  draft: EditorDraft;
  createdAt: string;
}

export interface ExtensionToWebPayload {
  sourceType: AssetSourceType;
  imageDataUrl?: string;
  draftId?: string;
}
