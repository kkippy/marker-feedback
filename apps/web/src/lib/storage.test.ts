import { describe, expect, it, vi } from 'vitest';
import type { ImageAsset } from '@marker/shared';
import { prepareAssetForStorage } from './storage';

const createAsset = (imageDataUrl: string): ImageAsset => ({
  id: 'asset_123',
  sourceType: 'upload',
  imageDataUrl,
  width: 100,
  height: 80,
  createdAt: '2026-03-25T00:00:00.000Z',
});

describe('prepareAssetForStorage', () => {
  it('uploads data url images and returns a public storage url', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const getPublicUrl = vi.fn(() => ({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/marker-assets/assets/asset_123.png' },
    }));

    const result = await prepareAssetForStorage(
      createAsset('data:image/png;base64,Zm9v'),
      { upload, getPublicUrl },
      'assets',
    );

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(
      'assets/asset_123.png',
      expect.any(Blob),
      { contentType: 'image/png', upsert: true },
    );
    expect(result.imageDataUrl).toBe('https://example.supabase.co/storage/v1/object/public/marker-assets/assets/asset_123.png');
  });

  it('keeps existing remote urls untouched', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const getPublicUrl = vi.fn(() => ({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/marker-assets/assets/asset_123.png' },
    }));

    const asset = createAsset('https://example.com/existing.png');
    const result = await prepareAssetForStorage(asset, { upload, getPublicUrl }, 'assets');

    expect(upload).not.toHaveBeenCalled();
    expect(result).toEqual(asset);
  });
});
