# Signal Mobile — React Native + Expo

An Android and iOS **owner app** for the NestJS backend in `../backend`. It has the Signal dashboard, projects, searchable/paginated feedback inbox, feedback creation, report details, status/priority updates, notes, pull-to-refresh, and connection settings. It uses real backend records; there is no demo data or local-only feedback database.

## Start

Requires Node.js 22+, a running configured Signal NestJS API, and a physical device or compatible simulator/emulator.

```sh
cd mobile
npm ci
npm start
```

Open the project in an Expo Go version compatible with the installed Expo SDK, or use an Expo development build. `npm run android` opens an available Android emulator; `npm run ios` requires macOS with Xcode. On Windows, use an Android device/emulator or a physical iPhone via Expo Go. If Expo Go does not yet support this SDK, use an EAS development/internal build instead.

### Connect to your backend

1. Follow `../backend/README.md` to configure MongoDB Atlas and run/deploy the NestJS API.
2. In the app, enter the API origin (for example `https://api.example.com`) and the backend's `ADMIN_API_KEY`. The app verifies authenticated project access before saving the connection.
3. The key is entered by the owner at runtime and saved using Expo SecureStore. No credential or database URI is bundled with the application. Disconnecting removes the saved connection; it does not delete server records.
4. Use HTTPS in production. Do not enter the Signal dashboard website URL: it is not the NestJS API host. The existing site's D1 records and MongoDB records remain separate until migrated.

For local development, Android emulator access to a host API is usually `http://10.0.2.2:3001`; an iOS simulator can use `http://localhost:3001`. A physical device needs your computer's LAN address or an HTTPS development endpoint, not `localhost`. The backend must listen on a reachable interface and the local firewall must permit it. HTTP is accepted only by development JavaScript builds and may still be blocked by native platform transport policies; prefer HTTPS if connection fails. The phone and development computer must be on a network that allows communication.

Native requests do not require browser CORS configuration. Server authentication still applies.

## Usage

- **Overview:** totals, status counts, feedback breakdown, latest feedback.
- **Projects:** create projects and open their filtered inbox. The new project's submission key is shown once in selectable text; save it in the project's server secret store. Never embed it in a customer-facing app. Existing/archived projects remain visible for history.
- **Inbox:** search title/description/reporter, filter project/status/type, pull to refresh, load more results (25 per page).
- **Feedback details:** read description/reporter, change status and priority, add internal notes, save to MongoDB through the API.
- **Settings:** inspect the API URL or disconnect to configure another workspace/key. A rejected key does not erase local settings automatically.

This is a trusted single-owner management app. Entering the admin key grants access to the entire workspace. Do not distribute it as a multi-user/customer app with a shared embedded key. Public customer feedback should use your app server and the backend's per-project ingestion endpoint. A multi-user version would need user authentication and server-side ownership authorization.

## Checks

```sh
npm run typecheck
npm test
npx expo install --check
npm run export
```

The API client tests cover connection URL handling, credentials, filters/pagination, write payloads, and backend/network errors. Exporting produces JavaScript/assets for Android and iOS; **it does not produce an APK/IPA or replace testing on a device**. SecureStore, keyboard/layout, native navigation/back behavior, and real Atlas connectivity require device verification.

At implementation time, npm audit reports five moderate advisories in Expo's CLI/fingerprint glob/minimatch dependency chain. These concern development/build tooling. npm's suggested automatic fix downgrades Expo across major SDK versions, so it has not been applied. Review upstream SDK patches before distribution.

## Installable builds

### Local signed Android APK

With JDK 17+ and the Android SDK installed, run:

```sh
npm run build:apk
```

The script generates Android native files from app configuration, builds a signed release APK for `arm64-v8a`, `armeabi-v7a`, and `x86_64`, and writes `outputs/signal-feedback-1.0.0.apk` and its SHA-256 checksum at the repository root. The build requires network access to download Gradle/Maven/SDK dependencies. Set `ANDROID_HOME` if the SDK is not in the default Windows location.

The first run creates a dedicated signing key and credentials under `work/android-signing/` at the repository root. **Back up that entire directory privately:** future updates must use the same signing key. It is excluded from Git and release assets. Set `SIGNAL_SIGNING_DIR` to another private directory if needed, or `SIGNAL_OUTPUT_DIR` to change the output location. The app contains no Atlas credentials or admin API key. On first launch, connect it to your own HTTPS NestJS API.

The Expo config plugin replaces the template's debug signing for release builds. Signing passwords are passed through process environment variables, never committed or included in shell arguments. Generated Android files remain ignored; keep the config plugin and build script in source control. Windows builds also place Java socket temporary files in `work/j` to avoid packaged desktop AppData redirection issues.

The plugin keeps app CMake intermediates under `work/c` at the repository root and hashes long object directory names. This avoids Windows' native toolchain path limits without moving the checkout or mixing drive roots.

For a retry with already-generated, unchanged native configuration, `npm run build:apk -- --skip-prebuild` retains native build caches. Run the normal command after changing Expo/native configuration. The plugin also sets a short CMake object path limit to avoid long generated object filenames.

### EAS cloud builds

`eas.json` includes an internal Android APK profile and production profile. Sign in to your own Expo account and configure the project:

The local signing plugin defers to EAS's credential injection on EAS workers. To publish updates compatible with this locally signed APK, import the same backed-up keystore into EAS credentials instead of generating a new signing identity.

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

For iOS: `npx eas-cli build --platform ios --profile preview`. Device registration/signing and an Apple Developer account may be required. Store distribution uses the production profile and the relevant developer accounts. No Expo project, signing certificate, store listing, or cloud build is created automatically. Review bundle identifiers in `app.json` before publishing.

Official documentation: [Expo setup](https://docs.expo.dev/get-started/create-a-project/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [EAS Build](https://docs.expo.dev/build/introduction/).
