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

const buildEnv = process.env.BUILD_ENV ?? process.env.EXPO_PUBLIC_BUILD_ENV ?? 'dev';
const isProd = buildEnv === 'prod';
const defaultUpdateChannel =
  buildEnv === 'prod' ? 'production' : buildEnv === 'staging' ? 'preview' : 'development';
const updateChannel = process.env.EAS_UPDATE_CHANNEL ?? defaultUpdateChannel;
const versionName = process.env.BUILD_VERSION_NAME ?? '1.0.0';
const buildNumber = process.env.BUILD_NUMBER ?? '1';
const versionCodeEnv = process.env.BUILD_VERSION_CODE;
const versionCode = versionCodeEnv ? parseInt(versionCodeEnv, 10) : undefined;
// OTA compatibility is keyed by the native release's major.minor.patch. A JS
// tag such as js-v1.2.1-update.3.prod therefore targets native runtime 1.2.1,
// regardless of its OTA iteration and target environment suffix.
const nativeRuntimeVersion =
  process.env.NATIVE_RUNTIME_VERSION ?? versionName.replace(/-(?:dev|rc)\.\d+$/, '');

const namespace = resolveNamespace();
const suffix = `.${namespace.replace(/[^a-z0-9]/g, '')}`;
const label = isProd ? '' : namespace !== 'main' ? ` (${namespace})` : '-dev';

// Worktrees use per-namespace package names (dev.eastshine.kotonoha.<ns>) that
// aren't registered in google-services.json, which makes the google-services
// Gradle plugin fail the build. Set EXPO_PUBLIC_FIREBASE_DISABLED=1 to drop the
// Firebase plugin + config so worktree builds succeed without registering a
// client. Push notifications are inert in that mode (guarded in pushNotifications.ts).
const firebaseDisabled = process.env.EXPO_PUBLIC_FIREBASE_DISABLED === '1';

const packageName = isProd
  ? 'dev.eastshine.kotonoha'
  : `dev.eastshine.kotonoha${suffix}`;
const bundleIdentifier = packageName;

export default {
  expo: {
    name: `코토노하${label}`,
    slug: 'app-rn',
    version: versionName,
    runtimeVersion: nativeRuntimeVersion,
    updates: {
      url: 'https://u.expo.dev/f03be909-9675-45fc-8ad5-818e30cdf18e',
      requestHeaders: {
        'expo-channel-name': updateChannel,
      },
    },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      bundleIdentifier,
      buildNumber,
      supportsTablet: false,
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      ...(firebaseDisabled
        ? {}
        : {
            googleServicesFile:
              process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
          }),
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#52B788',
        foregroundImage: './assets/adaptive-icon.png',
      },
      predictiveBackGestureEnabled: false,
      package: packageName,
      ...(versionCode !== undefined ? { versionCode } : {}),
      usesCleartextTraffic: true,
      ...(firebaseDisabled ? {} : { googleServicesFile: './google-services.json' }),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: 'f03be909-9675-45fc-8ad5-818e30cdf18e',
      },
    },
    plugins: [
      './plugins/withReleaseSigning',
      'expo-apple-authentication',
      '@react-native-google-signin/google-signin',
      ...(firebaseDisabled
        ? []
        : [
            [
              '@react-native-firebase/app',
              {
                ios: {
                  disableSPM: true,
                },
              },
            ],
            '@react-native-firebase/messaging',
          ]),
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            forceStaticLinking: ['RNFBApp', 'RNFBMessaging'],
          },
        },
      ],
      'expo-notifications',
      [
        'expo-splash-screen',
        {
          image: './assets/icon.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      [
        '@sentry/react-native/expo',
        {
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
        },
      ],
    ],
  },
};
