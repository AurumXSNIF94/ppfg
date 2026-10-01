import { auth } from '../config/firebase';
import { enqueueMutation, listQueue, removeQueue, updateQueue } from './offlineStore';

let syncing = false;
const listeners = new Set();

function emit() {
  listQueue().then(queue => listeners.forEach(listener => listener(queue))).catch(() => {});
}

export function subscribeOfflineQueue(listener) {
  listeners.add(listener);
  emit();
  return () => listeners.delete(listener);
}

export async function getPendingCount() {
  return (await listQueue()).length;
}

async function sendMutation(item) {
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated.');

  const token = await user.getIdToken();
  const response = await fetch(item.url, {
    method: item.method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Offline-Transaction-Id': item.id
    },
    body: item.body || undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `API request failed (${response.status})`);
  return payload;
}

export async function syncOfflineQueue() {
  const run = async () => {
    if (syncing || (typeof navigator !== 'undefined' && navigator.onLine === false) || !auth.currentUser) {
      return { synced: 0, pending: await getPendingCount() };
    }

    syncing = true;
    let synced = 0;
    try {
      const queue = await listQueue();
      for (const item of queue) {
        if (navigator.onLine === false) break;
        try {
          await sendMutation(item);
          await removeQueue(item.id);
          synced += 1;
        } catch (error) {
          await updateQueue(item.id, {
            status: 'PENDING',
            attempts: Number(item.attempts || 0) + 1,
            lastError: error.message,
            lastAttemptAt: Date.now()
          });
          break;
        }
      }
    } finally {
      syncing = false;
      emit();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ppfg:offline-sync-complete'));
      }
    }

    return { synced, pending: await getPendingCount() };
  };

  // Prevent two browser tabs from draining the same queue simultaneously.
  if (navigator?.locks?.request) {
    return navigator.locks.request('ppfg-wms-offline-sync', { ifAvailable: true }, async lock => {
      if (!lock) return { synced: 0, pending: await getPendingCount() };
      return run();
    });
  }

  return run();
}

export async function queueMutation(item) {
  const queued = await enqueueMutation(item);
  emit();
  if (navigator.onLine !== false) {
    void syncOfflineQueue();
  }
  return queued;
}
