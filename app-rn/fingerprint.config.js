const { SourceSkips } = require('@expo/fingerprint');

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
    'android/**/*',
    'ios/**/*',
    'node_modules/baseline-browser-mapping/**/*',
    'node_modules/browserslist/**/*',
    'node_modules/caniuse-lite/**/*',
    'node_modules/electron-to-chromium/**/*',
    'node_modules/node-releases/**/*',
  ],
};
