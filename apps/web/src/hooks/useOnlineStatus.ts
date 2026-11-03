import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void): () => void {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

/** Brauzer/telefon internetga ulanganini kuzatadi. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
