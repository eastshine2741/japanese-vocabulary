#!/usr/bin/env node
import {mkdir, rm} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const fixtureDir = resolve(publicDir, 'fixture');
const outDir = resolve(root, 'out');
const fixtureVideo = resolve(fixtureDir, 'mv.mp4');
const rawOutput = resolve(outDir, 'fixture-reel-raw.mp4');
const finalOutput = resolve(outDir, 'fixture-reel.mp4');

await mkdir(fixtureDir, {recursive: true});
await mkdir(outDir, {recursive: true});

await run('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=1280x720:rate=30',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=440:sample_rate=48000',
  '-t',
  '5',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  fixtureVideo,
]);

const data = {
  song: {
    title: 'Fixture',
    artist: 'Kotonoha',
    artworkAsset: '',
    mvAsset: 'fixture/mv.mp4',
  },
  headline: '테스트 렌더',
  instagramHandle: '@kotonoha.music',
  catchphrase: '가사에서 바로 배우는 일본어',
  sourceStartFrame: 0,
  lyricLines: [0, 1, 2, 3].map((index) => ({
    startFrame: index * 30,
    originalText: `夢を見る${index}`,
    koreanLyrics: `꿈을 꾸다 ${index}`,
    tokens: [
      {surface: '夢', baseForm: '夢', partOfSpeech: 'NOUN', charStart: 0, charEnd: 1},
      {surface: '見る', baseForm: '見る', partOfSpeech: 'VERB', charStart: 2, charEnd: 4},
    ],
    vocabulary: [{japanese: '夢', reading: 'ゆめ', korean: '꿈'}],
  })),
};

await run('npx', [
  'remotion',
  'render',
  'PromoReel',
  rawOutput,
  '--codec=h264',
  '--crf=28',
  '--frames=0-120',
  `--props=${JSON.stringify({data})}`,
]);

await run('ffmpeg', [
  '-y',
  '-i',
  rawOutput,
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
  '28',
  '-preset',
  'veryfast',
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
  '128k',
  finalOutput,
]);

const probe = await capture('ffprobe', [
  '-v',
  'error',
  '-select_streams',
  'v:0',
  '-show_entries',
  'stream=codec_name,pix_fmt,width,height,r_frame_rate',
  '-of',
  'json',
  finalOutput,
]);
const parsed = JSON.parse(probe);
const stream = parsed.streams?.[0];
if (stream?.codec_name !== 'h264' || stream?.pix_fmt !== 'yuv420p' || stream?.width !== 1080 || stream?.height !== 1920) {
  throw new Error(`Unexpected fixture output: ${probe}`);
}
console.log(`Fixture render smoke passed: ${finalOutput}`);

await rm(fixtureDir, {recursive: true, force: true});

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: 'inherit', shell: false});
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

function capture(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: false});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`${command} exited with ${code}: ${stderr}`));
    });
  });
}
