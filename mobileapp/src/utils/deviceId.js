import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY = 'teamchatx_device_id';

export async function getDeviceId() {
  let id = await SecureStore.getItemAsync(KEY);
  if (!id) {
    id = Crypto?.randomUUID?.() || `mob-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await SecureStore.setItemAsync(KEY, id);
  }
  return id;
}
