const fs = require('fs');
const path = require('path');
const { SourceSkips } = require('@expo/fingerprint');

// patch-package 패치에서 JS 파일만 고친 diff 는 번들에 들어가 OTA 로 나가므로 네이티브 입력에서 뺀다.
// JS 확장자가 아닌 파일(.h·.gradle·package.json 등)을 건드린 diff 는 보수적으로 네이티브로 본다.
const JS_FILE = /\.(js|jsx|mjs|cjs|ts|tsx|map)$/;

function nativePatchSources() {
  const dir = path.join(__dirname, 'patches');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.patch'))
    .sort()
    .flatMap((name) => {
      const contents = fs
        .readFileSync(path.join(dir, name), 'utf8')
        .split(/^(?=diff --git )/m)
        .filter((block) => {
          const file = block.match(/^diff --git a\/(\S+)/)?.[1];
          return !file || !JS_FILE.test(file);
        })
        .join('');
      return contents.trim() ? [{ type: 'contents', id: `patches/${name}`, contents, reasons: ['patchPackage'] }] : [];
    });
}

// version·runtimeVersion 은 네이티브 태그마다 달라지므로 빼야 같은 네이티브끼리 해시가 같다.
// 나머지 ignorePaths 는 config 평가 때 끌려오는 lockfile 잡음과 제출 설정이라 바이너리와 무관하다.
/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips:
    SourceSkips.ExpoConfigVersions |
    SourceSkips.ExpoConfigRuntimeVersionIfString |
    SourceSkips.PackageJsonScriptsAll |
    SourceSkips.GitIgnore,
  ignorePaths: [
    'eas.json',
    'patches/**/*',
    'android/**/*',
    'ios/**/*',
    'node_modules/baseline-browser-mapping/**/*',
    'node_modules/browserslist/**/*',
    'node_modules/caniuse-lite/**/*',
    'node_modules/electron-to-chromium/**/*',
    'node_modules/node-releases/**/*',
  ],
  extraSources: nativePatchSources(),
};
