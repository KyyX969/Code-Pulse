import { isSupabaseConfigured } from '../config.js';
import { LocalJsonStore } from './localStore.js';
import { SupabaseStore } from './supabaseStore.js';
import type { DataStore } from './types.js';

let storeInstance: DataStore | null = null;

export async function getStore(): Promise<DataStore> {
  if (storeInstance) return storeInstance;

  if (isSupabaseConfigured()) {
    const sb = new SupabaseStore();
    await sb.init();
    storeInstance = sb;
    console.log('[CodePulse DB] Connected to Supabase PostgreSQL');
    return storeInstance;
  }

  const local = new LocalJsonStore();
  await local.init();
  storeInstance = local;
  console.log('[CodePulse DB] Initialized Local JSON Store (set SUPABASE_URL to use Supabase)');
  return storeInstance;
}

export function isSupabaseStoreActive(): boolean {
  return storeInstance instanceof SupabaseStore;
}

export function setStoreForTesting(store: DataStore): void {
  storeInstance = store;
}

