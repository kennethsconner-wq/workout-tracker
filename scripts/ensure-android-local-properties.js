const fs = require('fs');
const path = require('path');

const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdkDir) {
  console.error(
    'ANDROID_HOME (or ANDROID_SDK_ROOT) is not set.\n' +
      'Install Android Studio, then set ANDROID_HOME to your SDK path, e.g.:\n' +
      '  C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk',
  );
  process.exit(1);
}

const localPropertiesPath = path.join(__dirname, '..', 'android', 'local.properties');
const escapedSdkDir = sdkDir.replace(/\\/g, '\\\\');
fs.writeFileSync(localPropertiesPath, `sdk.dir=${escapedSdkDir}\n`);
console.log(`Wrote ${localPropertiesPath}`);
