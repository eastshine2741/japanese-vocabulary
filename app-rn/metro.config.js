// Sentry's Metro wrapper — assigns Debug IDs to bundles and source maps so
// `sentry-expo-upload-sourcemaps` can match an OTA bundle to its source map.
// https://docs.sentry.io/platforms/react-native/sourcemaps/uploading/expo/
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
