const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withLocalMusic(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const permissions = manifest['uses-permission'] ?? [];
    const legacy = 'android.permission.READ_EXTERNAL_STORAGE';
    const audio = 'android.permission.READ_MEDIA_AUDIO';
    manifest['uses-permission'] = permissions.filter((item) => ![legacy, audio].includes(item.$['android:name']));
    manifest['uses-permission'].push(
      { $: { 'android:name': legacy, 'android:maxSdkVersion': '32' } },
      { $: { 'android:name': audio } },
    );
    return mod;
  });
};
