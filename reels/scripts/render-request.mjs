#!/usr/bin/env node
import {copyFile, mkdir, readFile, rm} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {assertYoutubeUrl, downloadYoutubeMp4, exitCodeFor, parseArgs, run} from './lib/source.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRenderDir = resolve(root, 'public', 'admin-render');
// x264 는 스레드를 호스트 코어 수(×1.5)로 잡고 스레드마다 프레임을 들고 있어서 컨테이너 한도를 넘긴다.
// Remotion 쪽 인코딩은 remotion.config.ts 의 overrideFfmpegCommand 가 같은 값을 넣는다.
const FFMPEG_THREADS = 4;

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.output) {
  console.error('Usage: npm run render:request -- --input <json> --output <mp4>');
  process.exit(2);
}

const inputPath = resolve(args.input);
const outputPath = resolve(args.output);
const rawOutputPath = outputPath.replace(/\.mp4$/i, '-raw.mp4');
const downloadedSourcePath = resolve(dirname(outputPath), 'source.mp4');
const publicMvPath = resolve(publicRenderDir, 'mv.mp4');

try {
  const request = JSON.parse(await readFile(inputPath, 'utf8'));
  if (!request?.source?.youtubeUrl) {
    throw new Error('Missing source.youtubeUrl');
  }
  assertYoutubeUrl(request.source.youtubeUrl);

  await mkdir(publicRenderDir, {recursive: true});
  // admin-api 가 미리보기 캐시에 받아 둔 source 가 있으면 다시 받지 않는다.
  const cachedSourcePath = request.source.localPath && existsSync(request.source.localPath)
    ? request.source.localPath
    : null;
  if (!cachedSourcePath) {
    await downloadYoutubeMp4(request.source.youtubeUrl, downloadedSourcePath, {cwd: root});
  }
  await copyFile(cachedSourcePath ?? downloadedSourcePath, publicMvPath);

  const data = {
    ...request.data,
    song: {
      ...request.data.song,
      mvAsset: 'admin-render/mv.mp4',
    },
  };

  await run('npx', [
    'remotion',
    'render',
    'PromoReel',
    rawOutputPath,
    '--codec=h264',
    '--crf=18',
    '--ipv4',
    '--concurrency=1',
    '--disallow-parallel-encoding',
    ...offthreadVideoCacheArgs(),
    `--props=${JSON.stringify({data})}`,
  ], {cwd: root});

  await run('ffmpeg', [
    '-y',
    '-i',
    rawOutputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
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
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-threads',
    String(FFMPEG_THREADS),
    outputPath,
  ], {cwd: root});
} catch (error) {
  process.exit(exitCodeFor(error));
} finally {
  await rm(publicRenderDir, {recursive: true, force: true}).catch(() => {});
}

// Remotion compositor 는 /proc/meminfo(호스트 메모리)의 절반을 프레임 캐시로 잡는다.
// 컨테이너에선 cgroup 한도가 진짜 상한이라 여기서 읽어 넘긴다. 한도가 없으면 기본 동작.
function offthreadVideoCacheArgs() {
  const limit = cgroupMemoryLimit();
  if (!limit) return [];
  const bytes = Math.max(240 * 1024 * 1024, Math.floor(limit * 0.2));
  console.log(`cgroup memory limit ${limit} bytes -> offthreadvideo cache ${bytes} bytes`);
  return [`--offthreadvideo-cache-size-in-bytes=${bytes}`];
}

function cgroupMemoryLimit() {
  for (const path of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const value = readFileSync(path, 'utf8').trim();
      const parsed = Number(value);
      if (value !== 'max' && Number.isFinite(parsed) && parsed < 2 ** 60) return parsed;
    } catch {}
  }
  return null;
}
