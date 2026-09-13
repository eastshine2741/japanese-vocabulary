#!/usr/bin/env node
import {copyFile, mkdir, readFile, rm} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

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
  await downloadYoutubeMp4(request.source.youtubeUrl, downloadedSourcePath);
  await copyFile(downloadedSourcePath, publicMvPath);

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
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(message.includes('EXTRACTION_FAILED') ? 20 : 1);
} finally {
  await rm(publicRenderDir, {recursive: true, force: true}).catch(() => {});
}

async function downloadYoutubeMp4(url, outputPath) {
  if (!existsOnPath('yt-dlp')) {
    throw new Error('EXTRACTION_FAILED: yt-dlp is not installed');
  }
  await run('yt-dlp', [
    '--no-playlist',
    '--js-runtimes',
    'node',
    '--merge-output-format',
    'mp4',
    '-f',
    'bv*[height<=1080]+ba/b[height<=1080]/b',
    '-o',
    outputPath,
    url,
  ], {cwd: root, extraction: true});
}

function assertYoutubeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('EXTRACTION_FAILED: invalid source URL');
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (parsed.protocol !== 'https:' || !['youtube.com', 'youtu.be', 'music.youtube.com'].includes(host)) {
    throw new Error('EXTRACTION_FAILED: source URL is not an allowed YouTube URL');
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (current === '--input') parsed.input = values[++index];
    if (current === '--output') parsed.output = values[++index];
  }
  return parsed;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let captured = '';
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      captured = trimCaptured(captured + chunk.toString());
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      captured = trimCaptured(captured + chunk.toString());
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${options.extraction ? 'EXTRACTION_FAILED: ' : ''}${command} exited with ${code}\n${captured}`));
    });
  });
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

function existsOnPath(command) {
  const pathValue = process.env.PATH ?? '';
  return pathValue.split(':').some((entry) => existsSync(resolve(entry, command)));
}

function trimCaptured(value) {
  return value.length > 8192 ? value.slice(value.length - 8192) : value;
}
