import type { ExtensionToWebPayload } from '@marker/shared';

const getHashParams = () => {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
};

export const getBootstrapPayload = (): ExtensionToWebPayload => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = getHashParams();

  return {
    sourceType: (searchParams.get('sourceType') as ExtensionToWebPayload['sourceType']) ?? 'upload',
    imageDataUrl: hashParams.get('imageDataUrl') ?? searchParams.get('imageDataUrl') ?? undefined,
    draftId: searchParams.get('draftId') ?? hashParams.get('draftId') ?? undefined,
  };
};
