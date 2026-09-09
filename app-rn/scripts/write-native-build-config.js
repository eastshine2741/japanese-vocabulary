const fs = require('fs');
const path = require('path');

const versionName = process.argv[2] ?? process.env.BUILD_VERSION_NAME;
const buildNumber = process.argv[3] ?? process.env.BUILD_NUMBER;
const runtimeVersion = process.argv[4] ?? process.env.NATIVE_RUNTIME_VERSION ?? versionName;

if (!versionName || !buildNumber || !runtimeVersion) {
  console.error(
    'Usage: node scripts/write-native-build-config.js <versionName> <buildNumber> <runtimeVersion>',
  );
  process.exit(1);
}

const config = {
  versionName,
  buildNumber: String(buildNumber),
  nativeRuntimeVersion: runtimeVersion,
};

fs.writeFileSync(
  path.join(__dirname, '..', 'native-build.json'),
  `${JSON.stringify(config, null, 2)}\n`,
);
