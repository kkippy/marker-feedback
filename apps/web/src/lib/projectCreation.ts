import { createId, type ImageAsset } from '@marker/shared';
import { createProject, saveDraft } from '@/lib/persistence';
import { createEmptyDraft } from '@/lib/useEditorStore';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const measureImage = (imageDataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = reject;
    image.src = imageDataUrl;
  });

const createUploadAssetFromFile = async (file: File): Promise<ImageAsset> => {
  const imageDataUrl = await readFileAsDataUrl(file);
  const dimensions = await measureImage(imageDataUrl);
  const createdAt = new Date().toISOString();

  return {
    id: createId('asset'),
    sourceType: 'upload',
    imageDataUrl,
    name: file.name,
    width: dimensions.width,
    height: dimensions.height,
    createdAt,
  };
};

export const createProjectFromFile = async ({
  name,
  file,
}: {
  name: string;
  file: File;
}) => {
  const asset = await createUploadAssetFromFile(file);

  return createProject({
    name,
    draft: {
      ...createEmptyDraft(),
      asset,
      updatedAt: asset.createdAt,
    },
  });
};

export const addScreenshotToProjectFromFile = async ({
  projectId,
  file,
}: {
  projectId: string;
  file: File;
}) => {
  const asset = await createUploadAssetFromFile(file);
  const draft = {
    ...createEmptyDraft(),
    projectId,
    asset,
    updatedAt: asset.createdAt,
  };

  await saveDraft(draft);

  return { draft };
};
