import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { UpdateController } from './update-controller';

const UpdateContext = createContext<UpdateController | null>(null);
export function AppUpdatesProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() => new UpdateController({ check: Updates.checkForUpdateAsync, download: Updates.fetchUpdateAsync, reload: () => Updates.reloadAsync() },
    !__DEV__ && Updates.isEnabled,
    __DEV__ ? 'Updates are available only in a configured release build, not Expo Go or Metro development.'
      : Constants.expoConfig?.extra?.signalUpdatesConfigured ? 'Updates are unavailable in this build. Install a configured release APK.'
      : 'EAS Update is not configured. Link your Expo project and install a new release APK.'));
  const { isUpdatePending } = Updates.useUpdates();
  const lastAutomaticCheck = useRef(0);
  useEffect(() => { if (isUpdatePending) controller.markReady(); }, [controller, isUpdatePending]);
  useEffect(() => {
    const check = () => {
      if (Date.now() - lastAutomaticCheck.current < 15 * 60 * 1000) return;
      lastAutomaticCheck.current = Date.now(); void controller.check();
    };
    check();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') check(); });
    return () => listener.remove();
  }, [controller]);
  return <UpdateContext.Provider value={controller}>{children}</UpdateContext.Provider>;
}
function useAppUpdates() {
  const controller = useContext(UpdateContext);
  if (!controller) throw new Error('AppUpdatesProvider is missing.');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { controller, state };
}
function confirmRestart(controller: UpdateController) {
  Alert.alert('Restart to update?', 'The app will restart. Save any unfinished feedback or notes first.', [
    { text: 'Not now', style: 'cancel' }, { text: 'Restart', onPress: () => { void controller.restart(); } },
  ]);
}
function UpdateAction({ controller, status }: { controller: UpdateController; status: string }) {
  const busy = ['checking', 'downloading', 'restarting'].includes(status);
  const text = status === 'available' ? 'Download update' : status === 'ready' ? 'Restart to update' : status === 'error' ? 'Retry check' : 'Check for updates';
  if (status === 'disabled') return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={busy ? descriptions[status] : text} accessibilityState={{ disabled: busy }} disabled={busy} style={[styles.action, busy && { opacity: .5 }]} onPress={() => {
    if (status === 'ready') confirmRestart(controller);
    else if (status === 'available') void controller.download();
    else void controller.check();
  }}>{busy ? <ActivityIndicator color="#7A63C2"/> : <Text style={styles.actionText}>{text}</Text>}</Pressable>;
}
const descriptions: Record<string, string> = {
  idle: 'Check for compatible improvements to your app.', checking: 'Checking for an update…',
  available: 'An update is available. Download it when you’re ready.', downloading: 'Downloading the update. You can keep using the app.',
  ready: 'An update is ready. Save your work before restarting.', restarting: 'Restarting with the downloaded update…',
  error: 'Your current app is still available.', disabled: '',
};
export function AppUpdateCard() {
  const { controller, state } = useAppUpdates();
  return <View style={styles.card}><Text style={styles.title}>App updates</Text><Text style={styles.body}>{state.message || descriptions[state.status]}</Text>
    <Text style={styles.meta}>Version {Constants.expoConfig?.version || '—'} · {Updates.channel || 'No channel'}{__DEV__ ? ' · Development' : Updates.isEmbeddedLaunch ? ' · Built-in bundle' : ' · OTA bundle'}</Text>
    {!!Updates.runtimeVersion && <Text style={styles.meta}>Runtime {Updates.runtimeVersion.slice(0, 12)}</Text>}
    {state.lastChecked !== null && <Text style={styles.meta}>Last checked: {new Date(state.lastChecked).toLocaleString()}</Text>}
    <UpdateAction controller={controller} status={state.status}/></View>;
}
export function AppUpdateBanner() {
  const { controller, state } = useAppUpdates();
  if (!['available', 'downloading', 'ready', 'restarting'].includes(state.status)) return null;
  return <View accessibilityLiveRegion="polite" style={styles.banner}><Text style={styles.title}>{state.status === 'ready' ? 'Update ready' : 'App update'}</Text><Text style={styles.body}>{state.message || descriptions[state.status]}</Text><UpdateAction controller={controller} status={state.status}/></View>;
}
const styles = StyleSheet.create({
  card: { padding: 22, backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E9F1', borderRadius: 17, marginBottom: 16 },
  banner: { backgroundColor: '#F0EBFA', paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2D8F3' },
  title: { fontSize: 16, fontWeight: '600', color: '#283044', marginBottom: 6 },
  body: { fontSize: 13, color: '#7E8597', lineHeight: 20 }, meta: { fontSize: 10, color: '#969CAF', marginTop: 8 },
  action: { paddingVertical: 12, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  actionText: { color: '#7A63C2', fontSize: 13, fontWeight: '600' },
});
