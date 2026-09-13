#!/usr/bin/env node
// 어드민 미리보기용 source 다운로드. 결과 mp4 는 admin-api 가 캐시하고 본 렌더에도 그대로 넘긴다.
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {assertYoutubeUrl, downloadYoutubeMp4, exitCodeFor, parseArgs} from './lib/source.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
if (!args.url || !args.output) {
  console.error('Usage: npm run fetch:source -- --url <youtube url> --output <mp4>');
  process.exit(2);
}

try {
  assertYoutubeUrl(args.url);
  await downloadYoutubeMp4(args.url, resolve(args.output), {cwd: root});
} catch (error) {
  process.exit(exitCodeFor(error));
}
