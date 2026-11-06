import * as SecureStore from 'expo-secure-store';
import type { Connection } from './types';
import { normalizeUrl } from './api';
const connectionKey = 'signal.owner.connection.v1';
export async function readConnection(): Promise<Connection | null> {
  const raw = await SecureStore.getItemAsync(connectionKey);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Connection;
    if (typeof value.key !== 'string' || value.key.length < 32 || value.key.length > 256) return null;
    return { url: normalizeUrl(value.url, __DEV__), key: value.key };
  } catch { return null; }
}
export function saveConnection(value: Connection) {
  if (JSON.stringify(value).length > 1800) throw new Error('Connection settings are too long.');
  return SecureStore.setItemAsync(connectionKey, JSON.stringify(value), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export function clearConnection() { return SecureStore.deleteItemAsync(connectionKey); }
