import {
  createId,
  createShareToken,
  type Annotation,
  type Comment,
  type CommentThread,
  type EditorDraft,
  type EmbeddedImageAsset,
  type ImageAsset,
  type ShareItem,
} from '@marker/shared';
import { createClient } from '@supabase/supabase-js';
import { prepareAssetForStorage } from './storage';

const DRAFTS_KEY = 'marker-feedback:drafts';
const LATEST_DRAFT_KEY = 'marker-feedback:latest-draft';
const SHARES_KEY = 'marker-feedback:shares';
const STORAGE_BUCKET =
  (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string | undefined) || 'marker-assets';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const canUseSupabase = Boolean(supabaseUrl && supabaseAnonKey) && !import.meta.env.VITEST;
export const hasSupabaseConfig = canUseSupabase;
export const supabaseClient = canUseSupabase
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

type DraftPreview = {
  id: string;
  updatedAt: string;
  annotationCount: number;
  hasAsset: boolean;
};
type AssetRow = {
  id: string;
  source_type: ImageAsset['sourceType'];
  image_data_url: string;
  width: number;
  height: number;
  created_at: string;
};
type EmbeddedAssetRow = {
  id: string;
  asset_id: string;
  image_data_url: string;
  width: number;
  height: number;
  created_at: string;
};
type ShareRow = { id: string; asset_id: string; share_token: string; created_at: string };
type AnnotationRow = {
  id: string;
  asset_id: string;
  tool: Annotation['tool'];
  geometry: Annotation['geometry'];
  label: string | null;
  image_asset_id: string | null;
  style: Annotation['style'];
  created_at: string;
};
type ThreadRow = {
  id: string;
  asset_id: string;
  annotation_id: string | null;
  title: string;
  status: CommentThread['status'];
  created_at: string;
};
type CommentRow = {
  id: string;
  thread_id: string;
  parent_id: string | null;
  author_label: string;
  body: string;
  created_at: string;
};

const readJson = <T,>(key: string, fallback: T): T => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) =>
  window.localStorage.setItem(key, JSON.stringify(value));

const assetToRow = (asset: ImageAsset): AssetRow => ({
  id: asset.id,
  source_type: asset.sourceType,
  image_data_url: asset.imageDataUrl,
  width: asset.width,
  height: asset.height,
  created_at: asset.createdAt,
});

const embeddedAssetToRow = (
  embeddedAsset: EmbeddedImageAsset,
  assetId: string,
): EmbeddedAssetRow => ({
  id: embeddedAsset.id,
  asset_id: assetId,
  image_data_url: embeddedAsset.imageDataUrl,
  width: embeddedAsset.width,
  height: embeddedAsset.height,
  created_at: embeddedAsset.createdAt,
});

const annotationToRow = (annotation: Annotation): AnnotationRow => ({
  id: annotation.id,
  asset_id: annotation.assetId,
  tool: annotation.tool,
  geometry: annotation.geometry,
  label: annotation.label ?? null,
  image_asset_id: annotation.imageAssetId ?? null,
  style: annotation.style,
  created_at: annotation.createdAt,
});

const threadToRow = (thread: CommentThread): ThreadRow => ({
  id: thread.id,
  asset_id: thread.assetId,
  annotation_id: thread.annotationId,
  title: thread.title,
  status: thread.status,
  created_at: thread.createdAt,
});

const commentToRow = (comment: Comment): CommentRow => ({
  id: comment.id,
  thread_id: comment.threadId,
  parent_id: comment.parentId,
  author_label: comment.authorLabel,
  body: comment.body,
  created_at: comment.createdAt,
});

const rowToAsset = (row: AssetRow): ImageAsset => ({
  id: row.id,
  sourceType: row.source_type,
  imageDataUrl: row.image_data_url,
  width: row.width,
  height: row.height,
  createdAt: row.created_at,
});

const rowToEmbeddedAsset = (row: EmbeddedAssetRow): EmbeddedImageAsset => ({
  id: row.id,
  imageDataUrl: row.image_data_url,
  width: row.width,
  height: row.height,
  createdAt: row.created_at,
});

const rowToAnnotation = (row: AnnotationRow): Annotation => ({
  id: row.id,
  assetId: row.asset_id,
  tool: row.tool,
  geometry: row.geometry,
  label: row.label ?? undefined,
  imageAssetId: row.image_asset_id ?? undefined,
  style: row.style,
  createdAt: row.created_at,
});

const rowToComment = (row: CommentRow): Comment => ({
  id: row.id,
  threadId: row.thread_id,
  parentId: row.parent_id,
  authorLabel: row.author_label,
  body: row.body,
  createdAt: row.created_at,
});

const toDraftPreview = (draft: EditorDraft): DraftPreview => ({
  id: draft.id,
  updatedAt: draft.updatedAt,
  annotationCount: draft.annotations.length,
  hasAsset: Boolean(draft.asset),
});

const saveDraftLocal = async (draft: EditorDraft) => {
  const drafts = readJson<Record<string, EditorDraft>>(DRAFTS_KEY, {});
  drafts[draft.id] = draft;
  writeJson(DRAFTS_KEY, drafts);
  window.localStorage.setItem(LATEST_DRAFT_KEY, draft.id);
  return draft.id;
};

const loadDraftLocal = async (draftId: string | 'latest') => {
  const drafts = readJson<Record<string, EditorDraft>>(DRAFTS_KEY, {});
  const actualId =
    draftId === 'latest' ? window.localStorage.getItem(LATEST_DRAFT_KEY) : draftId;
  return actualId ? drafts[actualId] ?? null : null;
};

const listDraftPreviewsLocal = async () =>
  Object.values(readJson<Record<string, EditorDraft>>(DRAFTS_KEY, {}))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toDraftPreview);

const createShareLocal = async (draft: EditorDraft) => {
  const token = createShareToken();
  const share: ShareItem = {
    id: createId('share'),
    shareToken: token,
    draft,
    createdAt: new Date().toISOString(),
  };
  const shares = readJson<Record<string, ShareItem>>(SHARES_KEY, {});
  shares[token] = share;
  writeJson(SHARES_KEY, shares);
  return share;
};

const getShareLocal = async (token: string) =>
  readJson<Record<string, ShareItem>>(SHARES_KEY, {})[token] ?? null;

const syncShareDraftLocal = async (token: string, draft: EditorDraft) => {
  const shares = readJson<Record<string, ShareItem>>(SHARES_KEY, {});
  const current = shares[token];
  if (!current) return null;
  shares[token] = { ...current, draft };
  writeJson(SHARES_KEY, shares);
  return shares[token];
};

const replaceShareGraphRemote = async (share: ShareRow, draft: EditorDraft) => {
  if (!supabaseClient || !draft.asset) return null;

  const persistedAsset = await prepareAssetForStorage(
    draft.asset,
    supabaseClient.storage.from(STORAGE_BUCKET),
  );
  const persistedDraft: EditorDraft & { asset: ImageAsset } = {
    ...draft,
    asset: persistedAsset,
  };
  const assetId = persistedAsset.id;
  const threadIds = persistedDraft.threads.map((thread) => thread.id);

  const { error: assetError } = await supabaseClient
    .from('image_assets')
    .upsert(assetToRow(persistedAsset));
  if (assetError) throw assetError;

  const { error: shareError } = await supabaseClient.from('share_items').upsert(share);
  if (shareError) throw shareError;

  if (threadIds.length) {
    const { error } = await supabaseClient.from('comments').delete().in('thread_id', threadIds);
    if (error) throw error;
  }

  const { error: threadDeleteError } = await supabaseClient
    .from('threads')
    .delete()
    .eq('asset_id', assetId);
  if (threadDeleteError) throw threadDeleteError;

  const { error: annotationDeleteError } = await supabaseClient
    .from('annotations')
    .delete()
    .eq('asset_id', assetId);
  if (annotationDeleteError) throw annotationDeleteError;

  const { error: embeddedAssetDeleteError } = await supabaseClient
    .from('embedded_image_assets')
    .delete()
    .eq('asset_id', assetId);
  if (embeddedAssetDeleteError) throw embeddedAssetDeleteError;

  if (persistedDraft.embeddedAssets.length) {
    const { error } = await supabaseClient
      .from('embedded_image_assets')
      .insert(
        persistedDraft.embeddedAssets.map((embeddedAsset) =>
          embeddedAssetToRow(embeddedAsset, assetId),
        ),
      );
    if (error) throw error;
  }

  if (persistedDraft.annotations.length) {
    const { error } = await supabaseClient
      .from('annotations')
      .insert(persistedDraft.annotations.map(annotationToRow));
    if (error) throw error;
  }

  if (persistedDraft.threads.length) {
    const { error } = await supabaseClient
      .from('threads')
      .insert(persistedDraft.threads.map(threadToRow));
    if (error) throw error;

    const comments = persistedDraft.threads.flatMap((thread) =>
      thread.comments.map(commentToRow),
    );

    if (comments.length) {
      const { error: commentError } = await supabaseClient
        .from('comments')
        .insert(comments);
      if (commentError) throw commentError;
    }
  }

  return { share, draft: persistedDraft };
};

const getShareRemote = async (token: string): Promise<ShareItem | null> => {
  if (!supabaseClient) return null;

  const { data: shareRow, error: shareError } = await supabaseClient
    .from('share_items')
    .select('*')
    .eq('share_token', token)
    .single<ShareRow>();
  if (shareError || !shareRow) return null;

  const [{ data: assetRow }, { data: embeddedAssetRows }, { data: annotationRows }, { data: threadRows }, { data: commentRows }] = await Promise.all([
    supabaseClient.from('image_assets').select('*').eq('id', shareRow.asset_id).single<AssetRow>(),
    supabaseClient
      .from('embedded_image_assets')
      .select('*')
      .eq('asset_id', shareRow.asset_id)
      .returns<EmbeddedAssetRow[]>(),
    supabaseClient
      .from('annotations')
      .select('*')
      .eq('asset_id', shareRow.asset_id)
      .order('created_at', { ascending: true })
      .returns<AnnotationRow[]>(),
    supabaseClient
      .from('threads')
      .select('*')
      .eq('asset_id', shareRow.asset_id)
      .order('created_at', { ascending: true })
      .returns<ThreadRow[]>(),
    supabaseClient
      .from('comments')
      .select('*')
      .order('created_at', { ascending: true })
      .returns<CommentRow[]>(),
  ]);

  if (!assetRow) return null;

  const validThreadIds = new Set((threadRows ?? []).map((thread) => thread.id));
  const commentsByThread = new Map<string, Comment[]>();

  for (const comment of commentRows ?? []) {
    if (!validThreadIds.has(comment.thread_id)) continue;
    const mapped = rowToComment(comment);
    const current = commentsByThread.get(mapped.threadId) ?? [];
    current.push(mapped);
    commentsByThread.set(mapped.threadId, current);
  }

  const draft: EditorDraft = {
    id: createId('draft'),
    asset: rowToAsset(assetRow),
    embeddedAssets: (embeddedAssetRows ?? []).map(rowToEmbeddedAsset),
    annotations: (annotationRows ?? []).map(rowToAnnotation),
    threads: (threadRows ?? []).map((thread) => ({
      id: thread.id,
      assetId: thread.asset_id,
      annotationId: thread.annotation_id,
      title: thread.title,
      status: thread.status,
      createdAt: thread.created_at,
      comments: commentsByThread.get(thread.id) ?? [],
    })),
    updatedAt: shareRow.created_at,
  };

  return {
    id: shareRow.id,
    shareToken: shareRow.share_token,
    draft,
    createdAt: shareRow.created_at,
  };
};

export const saveDraft = async (draft: EditorDraft) => saveDraftLocal(draft);
export const loadDraft = async (draftId: string | 'latest') => loadDraftLocal(draftId);
export const listDraftPreviews = async () => listDraftPreviewsLocal();

export const createShare = async (draft: EditorDraft) => {
  if (!draft.asset) throw new Error('Cannot create a share without an image asset.');
  if (!hasSupabaseConfig || !supabaseClient) return createShareLocal(draft);

  const share: ShareItem = {
    id: createId('share'),
    shareToken: createShareToken(),
    draft,
    createdAt: new Date().toISOString(),
  };
  const persisted = await replaceShareGraphRemote(
    {
      id: share.id,
      asset_id: draft.asset.id,
      share_token: share.shareToken,
      created_at: share.createdAt,
    },
    draft,
  );
  return persisted ? { ...share, draft: persisted.draft } : share;
};

export const getShare = async (token: string) => {
  if (!hasSupabaseConfig || !supabaseClient) return getShareLocal(token);
  const remote = await getShareRemote(token);
  return remote ?? getShareLocal(token);
};

export const syncShareDraft = async (token: string, draft: EditorDraft) => {
  if (!draft.asset) return null;
  if (!hasSupabaseConfig || !supabaseClient) return syncShareDraftLocal(token, draft);

  const current = await getShareRemote(token);
  if (!current) return syncShareDraftLocal(token, draft);

  const persisted = await replaceShareGraphRemote(
    {
      id: current.id,
      asset_id: draft.asset.id,
      share_token: token,
      created_at: current.createdAt,
    },
    draft,
  );
  return persisted ? { ...current, draft: persisted.draft } : { ...current, draft };
};
