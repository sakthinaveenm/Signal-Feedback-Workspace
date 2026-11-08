# Native Android and iOS projects

`android/` and `ios/` are now checked into Git. They are generated from Expo SDK 58 and the current Signal 1.1.0 configuration, including SecureStore and expo-updates. Production signing keys, SDK paths, caches, Pods, and build products remain ignored.

## Android

Open `mobile/android` in Android Studio, or run from `mobile/`:

```sh
npm ci
npm run android
# Signed release using the existing local signing identity:
npm run build:apk
```

Debug builds use Android Gradle's generated development keystore. Release builds use the private key supplied by the release script; no keystore is committed. EAS workers use their configured signing credentials. The release script builds the checked-in project without regenerating it by default, preserving native edits.

## iOS

The repository includes the Xcode project, shared scheme, Swift app/scene delegates, assets, Info.plist, entitlements, Expo configuration, and Podfile. Sources were generated with Expo's SDK template and config mods on Windows; Xcode/CocoaPods were not run.

On macOS, from `mobile/`:

```sh
npm ci
npx pod-install
npm run ios
```

After CocoaPods installation, open `ios/SignalFeedback.xcworkspace` in Xcode. Select your development team for device signing. iOS compilation, simulator/device testing, and distribution require macOS/Xcode and applicable Apple credentials. Commit the resulting Podfile.lock after validating on macOS; it is not fabricated here.

## Syncing Expo configuration

Because native folders are committed, EAS does not automatically run prebuild to apply app.json/app.config.js changes. After changing native dependencies, plugins, version, or EAS project/update configuration, sync and review the resulting diff:

```sh
npm run native:android
# On macOS/Linux for iOS, or both platforms on macOS:
npm run native:ios
npm run native:sync
```

These commands use `--no-clean` to preserve the projects. Expo CLI skips iOS generation on Windows; use macOS/Linux for subsequent iOS syncs. A full clean regeneration can overwrite manual native edits, so do it only deliberately with those edits backed up or represented by config plugins.

OTA checks currently remain disabled in native config because no EAS project UUID has been supplied. Link the project and follow [UPDATES.md](UPDATES.md), including native sync and a new signed build. Adding folders does not activate the updater in the previously released v1.0.0 APK.
