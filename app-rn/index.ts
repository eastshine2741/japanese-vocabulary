import { registerRootComponent } from 'expo';

import { installDevErrorLogger } from './src/utils/devErrorLogger';

import App from './App';

// 개발 빌드에서 에러 스택을 원본 파일:줄 로 터미널에 찍는다. 렌더가 시작되기 전에 건다.
installDevErrorLogger();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
