// Project UUID is public metadata, not an access token. `eas init` / update:configure
// can persist extra.eas.projectId in app.json; CI/local builds may supply it in env.
module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new Error('EAS_PROJECT_ID must be your real Expo project UUID.');
  }
  const channel = process.env.EXPO_UPDATE_CHANNEL || (process.env.EAS_BUILD_PROFILE === 'preview' ? 'preview' : 'production');
  if (!['preview', 'production'].includes(channel)) throw new Error('EXPO_UPDATE_CHANNEL must be preview or production.');
  return {
    ...config,
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      ...config.updates,
      enabled: Boolean(projectId),
      ...(projectId ? { url: `https://u.expo.dev/${projectId}` } : {}),
      checkAutomatically: 'ON_ERROR_RECOVERY',
      fallbackToCacheTimeout: 0,
      requestHeaders: { ...config.updates?.requestHeaders, 'expo-channel-name': channel },
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
      signalUpdatesConfigured: Boolean(projectId),
    },
  };
};
