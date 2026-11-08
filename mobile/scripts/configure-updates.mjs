import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const projectId = process.argv[2];
if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
  throw new Error('Usage: npm run updates:configure -- YOUR_REAL_EXPO_PROJECT_UUID (not an access token).');
}
const configFile = fileURLToPath(new URL('../app.json', import.meta.url));
const config = JSON.parse(readFileSync(configFile, 'utf8'));
if (config.expo.extra?.eas?.projectId && config.expo.extra.eas.projectId !== projectId) {
  throw new Error('This app is already linked to another Expo project. Review app.json before changing it.');
}
config.expo.extra = { ...config.expo.extra, eas: { ...config.expo.extra?.eas, projectId } };
writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
console.log('Saved the public Expo project UUID. Run npm run native:android to sync native config, then build and install a new signed APK before publishing OTA updates.');
