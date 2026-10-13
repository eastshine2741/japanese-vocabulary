import {execFile} from 'node:child_process';
import {resolve} from 'node:path';

import {mvPlacement} from './mv-placement.mjs';

export const FPS = 30;
export const END_CARD_FRAMES = 210;
const AUDIO_FADE_FRAMES = 36;
const AUDIO_VOLUME = 0.72;
// PromoReel.tsx 의 END_CARD_FADE_FRAMES, endCardBackdrop 블러 반경과 같은 값.
const END_CARD_FADE_FRAMES = 6;
const END_CARD_BLUR = 56;
const PROMO_WIDTH = 1080;
const PROMO_HEIGHT = 1920;

/**
 * overlay 렌더(투명 PNG 시퀀스)와 MV 원본을 합성해 최종 mp4 로 내는 ffmpeg 인자.
 * MV 는 GPU(NVDEC → 디코더 crop → scale_cuda)에서 줄이고 내려받는다.
 * 글자 층 합성·엔드카드 배경 블러·인코딩은 CPU 다 — overlay_cuda 는 hwupload 가 끝나기 전 프레임을 읽어 지난 글자·MV 가
 * 끼어들고, ffmpeg 에 CUDA 가우시안 블러가 없다.
 */
export function gpuCompositeFfmpegArgs({data, mvPath, source, framesDir, outputPath}) {
  const lyricsEndFrame = Math.max(1, data.lyricsEndFrame);
  const totalFrames = lyricsEndFrame + END_CARD_FRAMES;
  const padLength = String(totalFrames - 1).length;
  // 키프레임마다 디코더 crop·크기가 달라 구간마다 MV 를 따로 열어 이어 붙인다. 안 보이는 구간은 검은 바탕이다.
  const segments = mvSegments(data, totalFrames).map((segment) => ({
    ...segment,
    placement: mvPlacement({source, mvFrame: segment.mvFrame}),
  }));
  const mvInputs = segments.filter((segment) => segment.placement);
  const framesInput = mvInputs.length;
  const audioInput = framesInput + 1;
  const toYuva = 'scale=out_color_matrix=bt709:out_range=tv,format=yuva420p';
  const fromEndCard = `enable='gte(n,${lyricsEndFrame})'`;
  const mvLabel = (index) => (segments.length === 1 ? 'mv' : `mv${index}`);
  const graph = [
    // color 바탕에 MV 를 overlay 하면 프레임 동기화가 1프레임 밀린다. pad 로 MV 프레임이 곧 타임라인이 되게 한다.
    // pad_cuda 는 느린 PNG 쪽을 기다리는 동안 GPU 프레임 풀이 바닥나 실패하므로 내려받은 뒤 CPU 에서 붙인다.
    // 출력 프레임레이트는 첫 입력(MV)을 따르므로 24fps MV 도 30fps 로 맞춘다 — 엔드카드 enable 이 프레임 번호 기준이다.
    // 종횡비를 바꿔 줄이면 scale 이 SAR 로 보정해 비정사각 픽셀이 되어 일부 플레이어가 재생하지 못한다.
    // 구간 길이는 프레임 수로 못 박는다 — MV 가 먼저 끝나도 다음 구간이 앞당겨지지 않게 마지막 프레임으로 채운다.
    ...segments.map(({placement, start, end}, index) => {
      const frames = end - start;
      const fit = `trim=end_frame=${frames},setpts=PTS-STARTPTS[${mvLabel(index)}]`;
      return placement
        ? `[${mvInputs.indexOf(segments[index])}:v]scale_cuda=w=${placement.width}:h=${placement.height}:format=yuv420p,hwdownload,format=yuv420p,fps=${FPS},setsar=1,pad=w=${PROMO_WIDTH}:h=${PROMO_HEIGHT}:x=${placement.x}:y=${placement.y}:color=black,tpad=stop=-1:stop_mode=clone,${fit}`
        : `color=c=black:s=${PROMO_WIDTH}x${PROMO_HEIGHT}:r=${FPS}:d=${frames / FPS},format=yuv420p,setsar=1,${fit}`;
    }),
    // concat 은 시간 단위를 µs 로 바꿔 pts 가 1µs 씩 어긋나고, 그러면 출력이 프레임 하나를 더 찍는다. fps 로 프레임 격자에 되돌린다.
    ...(segments.length > 1 ? [`${segments.map((_, index) => `[${mvLabel(index)}]`).join('')}concat=n=${segments.length}:v=1:a=0,fps=${FPS}[mv]`] : []),
    `[${framesInput}:v]split[txtsrc][endsrc]`,
    // 엔드카드 구간의 가사 층은 overlay 렌더가 비워 두므로, 마지막 가사 프레임을 그대로 늘려 깐다.
    `[txtsrc]trim=end_frame=${lyricsEndFrame},tpad=stop_mode=clone:stop=${END_CARD_FRAMES},${toYuva}[txt]`,
    '[mv][txt]overlay=format=yuv420,split[plain][toblur]',
    // CSS backdrop blur 는 RGB 기준이라 chroma(가로세로 절반) 평면엔 반경 절반을 건다.
    `[toblur]gblur=sigma=${END_CARD_BLUR}:planes=1:${fromEndCard},gblur=sigma=${END_CARD_BLUR / 2}:planes=6:${fromEndCard},format=yuva420p,fade=t=in:start_frame=${lyricsEndFrame}:nb_frames=${END_CARD_FADE_FRAMES}:alpha=1[blur]`,
    `[plain][blur]overlay=${fromEndCard}:format=yuv420[backdrop]`,
    `[endsrc]${toYuva}[end]`,
    `[backdrop][end]overlay=${fromEndCard}:format=yuv420[out]`,
  ].join(';');

  return [
    '-y',
    ...mvInputs.flatMap(({placement, start, end}) => [
      '-hwaccel',
      'cuda',
      '-hwaccel_output_format',
      'cuda',
      '-c:v',
      `${source.codec}_cuvid`,
      '-crop',
      placement.decoderCrop,
      '-ss',
      String((data.sourceStartFrame + start) / FPS),
      '-t',
      String((end - start) / FPS),
      '-i',
      mvPath,
    ]),
    '-framerate',
    String(FPS),
    '-i',
    resolve(framesDir, `element-%0${padLength}d.png`),
    // 소리는 구간과 상관없이 처음부터 끝까지 한 번에 읽는다.
    '-ss',
    String(data.sourceStartFrame / FPS),
    '-t',
    String(totalFrames / FPS),
    '-i',
    mvPath,
    '-filter_complex',
    graph,
    '-map',
    '[out]',
    '-map',
    `${audioInput}:a:0?`,
    '-af',
    `volume=${AUDIO_VOLUME},afade=t=out:st=${(totalFrames - AUDIO_FADE_FRAMES) / FPS}:d=${(AUDIO_FADE_FRAMES - 1) / FPS}`,
    ...x264Args(),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    outputPath,
  ];
}

/** MV 배치가 같은 구간들 `[start, end)`(릴스 프레임). PromoReel.tsx 의 activeMvFrame 과 같은 규칙이다. */
export function mvSegments(data, totalFrames) {
  const segments = [{start: 0, mvFrame: data.mvFrame ?? null}];
  for (const keyframe of data.mvKeyframes ?? []) {
    if (keyframe.startFrame >= totalFrames) break;
    if (keyframe.startFrame <= segments[segments.length - 1].start) {
      segments[segments.length - 1].mvFrame = keyframe.mvFrame ?? null;
    } else {
      segments.push({start: keyframe.startFrame, mvFrame: keyframe.mvFrame ?? null});
    }
  }
  return segments.map((segment, index) => ({...segment, end: segments[index + 1]?.start ?? totalFrames}));
}

// NVENC 는 쓰지 않는다. 컨테이너 ffmpeg(6.1)의 NVENC 가 쓰는 SPS 를 OpenH264(GNOME 기본 플레이어 등)가 잘못 읽어 재생하지 못한다.
// x264 후처리 경로(render-request.mjs)와 같은 설정이다.
export function x264Args() {
  return [
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'high',
    '-level',
    '4.1',
    '-crf',
    '20',
    '-preset',
    'medium',
    '-threads',
    '4',
    '-color_range',
    'tv',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-movflags',
    '+faststart',
  ];
}

export function probeVideo(path) {
  return new Promise((resolvePromise, reject) => {
    execFile('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', path], (error, stdout) => {
      if (error) return reject(error);
      const stream = JSON.parse(stdout).streams?.[0];
      if (!stream) return reject(new Error('MV has no video stream'));
      resolvePromise({codec: stream.codec_name, width: stream.width, height: stream.height});
    });
  });
}
