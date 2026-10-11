import { RefObject } from 'react';
import { Platform, View } from 'react-native';
import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  SkCanvas,
  SkImage,
  Skia,
  makeImageFromView,
  matchFont,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { SHOWROOM } from './cardTheme';
import { PREVIEW_H, PREVIEW_W, STORY_H, STORY_W, StoryLayout, previewLayout, storyLayout } from './shareStory';
import type { ShareImages } from './shareImage';

const FONT_FAMILY = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });

// 시스템 폰트 대체 글리프가 기기마다 달라 하단 글귀는 ASCII 만 쓴다. 곡명은 카드에 이미 있다.
function drawCentered(canvas: SkCanvas, text: string, y: number, size: number, color: string, bold: boolean) {
  const font = matchFont({ fontFamily: FONT_FAMILY, fontSize: size, fontWeight: bold ? '700' : '400' });
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  const width = font.measureText(text).width;
  canvas.drawText(text, (STORY_W - width) / 2, y, paint, font);
}

function drawCard(canvas: SkCanvas, card: SkImage, rect: StoryLayout['card']) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRectOptions(
    card,
    Skia.XYWHRect(0, 0, card.width(), card.height()),
    Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height),
    FilterMode.Linear,
    MipmapMode.Linear,
    paint,
  );
}

function render(width: number, height: number, draw: (canvas: SkCanvas) => void, fileName: string): string {
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) throw new Error('surface failed');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color(SHOWROOM.bg));
  draw(canvas);
  surface.flush();
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100);
  const file = new File(Paths.cache, fileName);
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/** 화면의 카드 뷰를 한 번 떠서 스토리(9:16)와 링크 미리보기(1.91:1) PNG 를 캐시에 쓴다. */
export async function composeShareImages(cardView: RefObject<View | null>, name: string, footer: string): Promise<ShareImages> {
  const card = await makeImageFromView(cardView as RefObject<View>);
  if (!card) throw new Error('card capture failed');

  const layout = storyLayout(card.width(), card.height());
  const story = render(STORY_W, STORY_H, (canvas) => {
    drawCard(canvas, card, layout.card);
    drawCentered(canvas, 'Kotonoha', layout.appName.y, layout.appName.size, SHOWROOM.fg, true);
    drawCentered(canvas, footer, layout.url.y, layout.url.size, SHOWROOM.fgDim, false);
  }, `${name}-story.png`);
  const preview = render(PREVIEW_W, PREVIEW_H, (canvas) => {
    drawCard(canvas, card, previewLayout(card.width(), card.height()));
  }, `${name}-preview.png`);
  return { story, preview };
}
