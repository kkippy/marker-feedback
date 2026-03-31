import { useEffect, useState } from 'react';

export const useLoadedImage = (src?: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    let isActive = true;
    const img = new window.Image();

    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (isActive) {
        setImage(img);
      }
    };
    img.onerror = () => {
      if (isActive) {
        setImage(null);
      }
    };
    img.src = src;

    return () => {
      isActive = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return image;
};
