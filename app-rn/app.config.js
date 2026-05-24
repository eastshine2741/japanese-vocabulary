const { execSync } = require('child_process');

function resolveNamespace() {
  if (process.env.DEPLOY_NS) return process.env.DEPLOY_NS;
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return branch.replace(/.*\//, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  } catch {
    return 'main';
  }
}

const isProd = process.env.BUILD_ENV === 'prod';
const versionName = process.env.BUILD_VERSION_NAME ?? '1.0.0';
const versionCodeEnv = process.env.BUILD_VERSION_CODE;
const versionCode = versionCodeEnv ? parseInt(versionCodeEnv, 10) : undefined;

const namespace = resolveNamespace();
const suffix = `.${namespace.replace(/[^a-z0-9]/g, '')}`;
const label = isProd ? '' : namespace !== 'main' ? ` (${namespace})` : '-dev';

const packageName = isProd
  ? 'dev.eastshine.kotonoha'
  : `dev.eastshine.kotonoha${suffix}`;

export default {
  expo: {
    name: `Kotonoha${label}`,
    slug: 'app-rn',
    version: versionName,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      package: packageName,
      ...(versionCode !== undefined ? { versionCode } : {}),
      usesCleartextTraffic: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      './plugins/withReleaseSigning',
      '@react-native-google-signin/google-signin',
    ],
  },
};
