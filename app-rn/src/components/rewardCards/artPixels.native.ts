import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';

const SIZE = 32;

/** 아트를 SIZE×SIZE 로 줄여 RGBA 픽셀을 읽는다. */
export async function readArtPixels(uri: string): Promise<Uint8Array> {
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!image) throw new Error('decode failed');
  const surface = Skia.Surface.Make(SIZE, SIZE);
  if (!surface) throw new Error('surface failed');
  surface.getCanvas().drawImageRect(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(0, 0, SIZE, SIZE),
    Skia.Paint(),
  );
  surface.flush();
  const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
    width: SIZE,
    height: SIZE,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!(pixels instanceof Uint8Array)) throw new Error('read failed');
  return pixels;
}
