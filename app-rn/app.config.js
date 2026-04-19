const namespace = process.env.DEPLOY_NS || 'main';
const suffix = `.${namespace.replace(/[^a-z0-9]/g, '')}`;
const label = namespace !== 'main' ? ` (${namespace})` : '';

export default {
  expo: {
    name: `app-rn${label}`,
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
      package: `com.anonymous.apprn${suffix}`,
      usesCleartextTraffic: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['./plugins/withReleaseSigning'],
  },
};
