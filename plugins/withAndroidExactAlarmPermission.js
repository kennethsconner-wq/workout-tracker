const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/** Ensures Android 12+ can offer this app under Settings → Alarms & reminders. */
function withAndroidExactAlarmPermission(config) {
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Permissions.ensurePermission(
      config.modResults,
      'android.permission.SCHEDULE_EXACT_ALARM',
    );
    AndroidConfig.Permissions.ensurePermission(
      config.modResults,
      'android.permission.POST_NOTIFICATIONS',
    );
    return config;
  });
}

module.exports = withAndroidExactAlarmPermission;
