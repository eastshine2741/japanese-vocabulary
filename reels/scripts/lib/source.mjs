import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';

// yt-dlp 포맷은 여기 한 곳에만 둔다. 어드민 미리보기 캐시와 본 렌더가 같은 파일을 써야 한다.
const YT_DLP_FORMAT = 'bv*[height<=1080]+ba/b[height<=1080]/b';

export async function downloadYoutubeMp4(url, outputPath, {cwd}) {
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
    YT_DLP_FORMAT,
    '-o',
    outputPath,
    url,
  ], {cwd, extraction: true});
}

export function assertYoutubeUrl(url) {
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

export function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (current.startsWith('--')) parsed[current.slice(2)] = values[++index];
  }
  return parsed;
}

export function exitCodeFor(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  return message.includes('EXTRACTION_FAILED') ? 20 : 1;
}

export function run(command, args, options = {}) {
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
