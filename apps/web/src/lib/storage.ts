import type { ImageAsset } from '@marker/shared';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export interface StorageBucketClient {
  upload: (path: string, fileBody: Blob, options: { contentType: string; upsert: boolean }) => Promise<{ error: Error | null }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
}

const isDataUrl = (value: string) => value.startsWith('data:');

const parseDataUrl = (value: string) => {
  const match = value.match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) throw new Error('Unsupported image data format.');

  const [, contentType, encodingFlag, payload] = match;
  const binary = encodingFlag ? window.atob(payload) : decodeURIComponent(payload);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const extension = MIME_EXTENSION_MAP[contentType] ?? 'bin';

  return {
    blob: new Blob([bytes], { type: contentType }),
    contentType,
    extension,
  };
};

export async function prepareAssetForStorage(
  asset: ImageAsset,
  storage: StorageBucketClient,
  prefix = 'assets',
): Promise<ImageAsset> {
  if (!isDataUrl(asset.imageDataUrl)) return asset;

  const { blob, contentType, extension } = parseDataUrl(asset.imageDataUrl);
  const objectPath = `${prefix}/${asset.id}.${extension}`;
  const { error } = await storage.upload(objectPath, blob, { contentType, upsert: true });
  if (error) throw error;

  const { data } = storage.getPublicUrl(objectPath);
  if (!data.publicUrl) throw new Error('Storage upload succeeded but no public URL was returned.');

  return {
    ...asset,
    imageDataUrl: data.publicUrl,
  };
}
