const { withAppBuildGradle } = require('expo/config-plugins');
module.exports = function withReleaseSigning(config) {
  // EAS injects its configured credentials after prebuild; do not override them.
  if (process.env.EAS_BUILD === 'true') return config;
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Signal signing requires Groovy build.gradle.');
    let source = mod.modResults.contents.replace("storeFile file('debug.keystore')", "// Use Android Gradle's generated development keystore.");
    mod.modResults.contents = source;
    if (source.includes('// Signal release signing')) return mod;
    const signing = `// Signal release signing: secrets are supplied only through the build environment.
def signalStoreFile = System.getenv('SIGNAL_STORE_FILE')
def signalStorePassword = System.getenv('SIGNAL_STORE_PASSWORD')
def signalKeyAlias = System.getenv('SIGNAL_KEY_ALIAS')
def signalKeyPassword = System.getenv('SIGNAL_KEY_PASSWORD')
if (System.getenv('EAS_BUILD') != 'true' && gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') } &&
    (!signalStoreFile || !signalStorePassword || !signalKeyAlias || !signalKeyPassword)) {
    throw new GradleException('Use npm run build:apk with your Signal release signing credentials.')
}
`;
    source = signing + '\n' + source;
    source = source.replace('android {', `android {
    externalNativeBuild {
        cmake { buildStagingDirectory file("$rootDir/../../work/c") }
    }`);
    // Hash long CMake object directory names on Windows instead of mirroring
    // the entire node_modules source path into the object filename.
    source = source.replace('    defaultConfig {', `    defaultConfig {
        externalNativeBuild {
            cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=250" }
        }`);
    if (!source.includes('    signingConfigs {')) throw new Error('Could not find Android signing configuration.');
    source = source.replace('    signingConfigs {', `    signingConfigs {
        release {
            if (signalStoreFile) {
                storeFile file(signalStoreFile)
                storePassword signalStorePassword
                keyAlias signalKeyAlias
                keyPassword signalKeyPassword
            }
        }`);
    const releaseBlock = /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    // Start at buildTypes so the newly inserted signingConfigs.release is not matched.
    const split = source.indexOf('    buildTypes {');
    if (split < 0 || !releaseBlock.test(source.slice(split))) throw new Error('Could not find the release build type.');
    source = source.slice(0, split) + source.slice(split).replace(releaseBlock, '$1signingConfig signingConfigs.release');
    mod.modResults.contents = source;
    return mod;
  });
};

