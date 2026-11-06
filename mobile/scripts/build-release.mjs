import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const mobileRoot = fileURLToPath(new URL('../', import.meta.url));
const workspaceRoot = path.resolve(mobileRoot, '..');
const signingDir = path.resolve(process.env.SIGNAL_SIGNING_DIR || path.join(workspaceRoot, 'work/android-signing'));
const secretsFile = path.join(signingDir, 'credentials.json');
const storeFile = path.join(signingDir, 'signal-release.jks');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android/Sdk'));
if (!sdk || !existsSync(sdk)) throw new Error('Set ANDROID_HOME to your installed Android SDK.');
function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: false });
  if (result.error) throw new Error(`Unable to start ${path.basename(command)}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed with exit ${result.status}.`);
}
let credentials;
if (existsSync(secretsFile)) {
  if (!existsSync(storeFile)) throw new Error('Signing credentials exist but keystore is missing. Restore it; do not generate a replacement key.');
  credentials = JSON.parse(readFileSync(secretsFile, 'utf8'));
} else {
  if (existsSync(storeFile)) throw new Error('Keystore already exists without credentials. Restore its credentials before building.');
  mkdirSync(signingDir, { recursive: true, mode: 0o700 });
  credentials = { storePassword: randomBytes(32).toString('base64url'), keyPassword: randomBytes(32).toString('base64url'), alias: 'signal-release' };
  const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool';
  run(keytool, ['-genkeypair', '-noprompt', '-keystore', storeFile, '-storetype', 'JKS', '-alias', credentials.alias,
    '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Signal Feedback, OU=Mobile, O=Signal, C=IN',
    '-storepass:env', 'SIGNAL_STORE_PASSWORD', '-keypass:env', 'SIGNAL_KEY_PASSWORD'], mobileRoot,
    { ...process.env, SIGNAL_STORE_PASSWORD: credentials.storePassword, SIGNAL_KEY_PASSWORD: credentials.keyPassword });
  writeFileSync(secretsFile, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600 });
  console.log('Created local release signing key. Back up work/android-signing privately for future updates.');
}
if (!credentials.storePassword || !credentials.keyPassword || !credentials.alias) throw new Error('Invalid signing credentials file.');
// Windows packaged desktops may virtualize AppData temp files, breaking Java's
// AF_UNIX wakeup pipe. Keep its socket files in a real workspace directory.
const socketDir = path.join(workspaceRoot, 'work/j');
mkdirSync(socketDir, { recursive: true });
const javaCompatibility = process.platform === 'win32'
  ? `-Djava.net.preferIPv4Stack=true -Djdk.net.unixdomain.tmpdir="${socketDir.replaceAll('\\', '/')}"` : '';
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, NODE_ENV: 'production',
  JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS || ''} ${javaCompatibility}`.trim(),
  SIGNAL_STORE_FILE: storeFile, SIGNAL_STORE_PASSWORD: credentials.storePassword,
  SIGNAL_KEY_ALIAS: credentials.alias, SIGNAL_KEY_PASSWORD: credentials.keyPassword };
if (!process.argv.includes('--skip-prebuild')) {
  run(process.execPath, [path.join(mobileRoot, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'], mobileRoot, env);
}
const android = path.join(mobileRoot, 'android');
const args = ['app:assembleRelease', '--console=plain', '--no-daemon', '--max-workers=2', '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64'];
if (process.platform === 'win32') {
  // The command is fixed; secrets remain in env and are never interpolated into shell text.
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'gradlew.bat', ...args], android, env);
} else { run(path.join(android, 'gradlew'), args, android, env); }
const version = JSON.parse(readFileSync(path.join(mobileRoot, 'app.json'), 'utf8')).expo.version;
const output = path.resolve(process.env.SIGNAL_OUTPUT_DIR || path.join(workspaceRoot, 'outputs'));
mkdirSync(output, { recursive: true });
const apkName = `signal-feedback-${version}.apk`;
const apk = path.join(output, apkName);
copyFileSync(path.join(android, 'app/build/outputs/apk/release/app-release.apk'), apk);
writeFileSync(path.join(output, `${apkName}.sha256`), `${createHash('sha256').update(readFileSync(apk)).digest('hex')}  ${apkName}\n`);
console.log(`Release APK: ${apk}`);
