import { registerRootComponent } from 'expo';

import { installDevErrorLogger } from './src/utils/devErrorLogger';

// 개발 빌드에서 에러 스택을 원본 파일:줄 로 터미널에 찍는다. 렌더가 시작되기 전에 건다.
installDevErrorLogger();

// share-web 빌드는 공유 카드 화면만 담는다. 빌드 때 박히는 상수라 쓰지 않는 쪽 require 는 번들에서 빠진다.
if (process.env.EXPO_PUBLIC_SHARE_WEB === '1') {
  registerRootComponent(require('./src/shareWeb/ShareWebApp').default);
} else if (process.env.EXPO_PUBLIC_PREVIEW === '1') {
  registerRootComponent(require('./src/preview/PreviewApp').default);
} else {
  registerRootComponent(require('./App').default);
}
