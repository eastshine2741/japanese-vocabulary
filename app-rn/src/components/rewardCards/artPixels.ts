const SIZE = 32;

/** 아트를 SIZE×SIZE 로 줄여 RGBA 픽셀을 읽는다. 아트 서버가 CORS 를 열어 줘야 캔버스를 읽을 수 있다. */
export function readArtPixels(uri: string): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        resolve(ctx.getImageData(0, 0, SIZE, SIZE).data);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('load failed'));
    img.src = uri;
  });
}
