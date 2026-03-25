import { useEffect, useState } from 'react';

export const useLoadedImage = (src?: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);

  return image;
};
