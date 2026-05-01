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

const namespace = resolveNamespace();
const suffix = `.${namespace.replace(/[^a-z0-9]/g, '')}`;
const label = namespace !== 'main' ? ` (${namespace})` : '';

export default {
  expo: {
    name: `Kotonoha${label}`,
    slug: 'app-rn',
    version: '1.0.0',
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
      package: `com.eastshine.kotonoha${suffix}`,
      usesCleartextTraffic: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['./plugins/withReleaseSigning'],
  },
};
