#!/usr/bin/env node
import {copyFile, mkdir, readFile, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRenderDir = resolve(root, 'public', 'admin-render');

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
    '--merge-output-format',
    'mp4',
    '-f',
    'bv*+ba/b',
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

function existsOnPath(command) {
  const pathValue = process.env.PATH ?? '';
  return pathValue.split(':').some((entry) => existsSync(resolve(entry, command)));
}

function trimCaptured(value) {
  return value.length > 8192 ? value.slice(value.length - 8192) : value;
}
