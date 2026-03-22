const { withAppBuildGradle, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withReleaseConfig(config) {
  // Allow cleartext HTTP traffic
  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });

  return withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    // Add release signing config block after signingConfigs {
    buildGradle = buildGradle.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        release {
            storeFile file(RELEASE_STORE_FILE)
            storePassword RELEASE_STORE_PASSWORD
            keyAlias RELEASE_KEY_ALIAS
            keyPassword RELEASE_KEY_PASSWORD
        }`,
    );

    // Point release buildType to release signingConfig
    buildGradle = buildGradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );

    config.modResults.contents = buildGradle;
    return config;
  });
};
