# Expo in-app updates

Signal uses `expo-updates` and EAS Update for compatible JavaScript/assets updates. New native dependencies or native configuration changes require a new signed APK/IPA; they cannot be installed through OTA.

## One-time activation

The published v1.0.0 APK was built without `expo-updates`. It cannot receive this feature as an OTA update. Configure your Expo project, then build and install a replacement APK using the existing signing key. The next native version is 1.1.0 (Android versionCode 2).

1. Sign into your Expo account and create/link the Signal EAS project:

   ```sh
   cd mobile
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

2. Ensure `extra.eas.projectId` in `app.json` contains that project's real UUID. The init command usually writes it. For an existing project, `npm run updates:configure -- YOUR_PROJECT_UUID` writes the public UUID without accepting an access token. Alternatively supply `EAS_PROJECT_ID` consistently in build and update-publishing environments. Project ownership/access is enforced by Expo; this helper only validates and saves the UUID.

3. Run `npm run native:android` to apply the EAS project/update configuration to the checked-in Android project, then build the replacement production APK using `npm run build:apk`. On macOS, run `npm run native:ios` before an iOS build. EAS does not automatically prebuild when native folders are checked in. The existing private `work/android-signing` key must be available so Android accepts the app as an upgrade. Install it over v1.0.0. No replacement GitHub release is created by the update integration itself.

4. Publish an initial compatible update after linking/creating the production channel:

   ```powershell
   $env:EXPO_UPDATE_CHANNEL='production'
   npx eas-cli@latest channel:create production
   npx eas-cli@latest update --channel production --environment production --message "Enable Signal in-app updates"
   ```

   Skip channel creation if it already exists. EAS may prompt to create/link a branch; point production at your production branch and preview at your preview branch. Both publish environment and build environment must resolve the same project/runtime configuration.

Without a configured project, update checks are disabled and the UI explains how to activate them. No fake project UUID or access token is shipped. An unconfigured APK remains usable for feedback management but will need another configured native build to enable OTA.

## Daily workflow

For a JavaScript-only improvement:

```powershell
$env:EXPO_UPDATE_CHANNEL='preview'
npx eas-cli@latest update --channel preview --environment preview --message "Describe the change"
# Validate on a preview build, then publish tested code to production:
$env:EXPO_UPDATE_CHANNEL='production'
npx eas-cli@latest update --channel production --environment production --message "Describe the change"
```

These publishing examples use PowerShell. On macOS/Linux, set the corresponding `EXPO_UPDATE_CHANNEL` environment variable with your shell's syntax. Keep it consistent with the target build when publishing so fingerprint configuration matches.

EAS build profiles use matching `preview` and `production` channels. The local APK build defaults to `production`; set `EXPO_UPDATE_CHANNEL=preview` before building a preview APK. Supply that same variable when publishing its update. Channels are public metadata, not secrets. Expo credentials are used only by the publishing CLI; never put an Expo access token in app source or `EXPO_PUBLIC_*` variables.

Runtime compatibility uses Expo's `fingerprint` policy. Only updates with matching native runtime fingerprints can be downloaded by a build. After changing a native dependency/configuration, produce and distribute a new native build before expecting it to receive that runtime's updates. Preserve the signed APK's keystore for all subsequent releases.

## App behavior

- Check after launch and on foreground return, with a 15-minute automatic-check cooldown. Native automatic launch checks are set to `ON_ERROR_RECOVERY` so they do not duplicate the app-controlled check; Expo's recovery protections remain enabled.
- Show a banner when an update is available. Download only when the owner chooses Download; the feedback workspace stays usable.
- Show Restart to update once downloaded. Restart requires an explicit confirmation with an unsaved-work reminder. There is no forced restart during editing.
- Offer manual checks/retries in Settings and on the connection screen, independent of backend authentication.
- Keep current code usable if checks/downloads fail. A failed restart keeps the downloaded update available for retry. A pending update is also applied on a normal subsequent cold start by the native updater.
- Recognize Expo rollback directives and pending downloads found by the native updater. Keep the embedded update and normal Expo recovery behavior; anti-bricking measures are not disabled.
- Show app version, channel, abbreviated runtime, last successful check time, and whether the running code is embedded or OTA.

## Verification

`npm test` includes update-controller tests for manual restart, deduplication, no-update responses, offline/download retry, reload failure, pending-update races, rollback directives, and project/channel configuration. `npm run typecheck`, `npx expo install --check`, and native platform bundle exports check integration.

End-to-end OTA verification requires a real EAS project and two compatible release versions: install a configured native build, publish a visible JavaScript-only change, check/download in the app, defer restart to confirm editing is unaffected, then restart and confirm the change. Repeat offline and verify native-incompatible updates are not offered. Expo Go/Metro cannot validate release OTA behavior. No OTA update has been published by this integration alone.

References: [EAS Update setup](https://docs.expo.dev/eas-update/getting-started/), [expo-updates API](https://docs.expo.dev/versions/latest/sdk/updates/), [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).
