import { describe, expect, it } from 'vitest';
import { createId } from '@marker/shared';
import { createShare, getShare, saveDraft } from './persistence';
import { createEmptyDraft } from './useEditorStore';

describe('local persistence', () => {
  it('stores and retrieves a share payload', async () => {
    const draft = {
      ...createEmptyDraft(),
      id: createId('draft'),
      asset: {
        id: createId('asset'),
        sourceType: 'upload' as const,
        imageDataUrl: 'data:image/png;base64,abc',
        width: 100,
        height: 80,
        createdAt: new Date().toISOString(),
      },
    };
    await saveDraft(draft);
    const share = await createShare(draft);
    const loaded = await getShare(share.shareToken);
    expect(loaded?.draft.id).toBe(draft.id);
    expect(loaded?.draft.asset?.imageDataUrl).toBe(draft.asset.imageDataUrl);
  });
});
