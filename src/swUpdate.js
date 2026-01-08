// src/swUpdate.js
// Registers the service worker and emits a single custom event when a *new* SW is waiting.
// The app listens for: window.addEventListener('kwt-sw-update', ...)

const STORAGE_KEY = 'kwt_sw_waiting_key_v1';

function getWaitingKey(reg) {
  try {
    const w = reg?.waiting;
    // scriptURL is stable per SW build and is safe to use as a uniqueness key.
    return w?.scriptURL || 'waiting';
  } catch {
    return 'waiting';
  }
}

function alreadyNotified(key) {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === key;
  } catch {
    return false;
  }
}

function markNotified(key) {
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    // ignore
  }
}

function emitUpdateAvailable(reg) {
  try {
    window.dispatchEvent(new CustomEvent('kwt-sw-update', { detail: { registration: reg } }));
  } catch {
    // ignore
  }
}

async function checkWaitingAndNotify(reg) {
  if (!reg?.waiting) return;
  const key = getWaitingKey(reg);
  if (alreadyNotified(key)) return;
  markNotified(key);
  emitUpdateAvailable(reg);
}

async function wireRegistration(reg) {
  // If there's already a waiting worker (e.g. opened after update downloaded)
  await checkWaitingAndNotify(reg);

  // When a new SW is found
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    if (!sw) return;

    sw.addEventListener('statechange', () => {
      // waiting happens when: installed AND there's an existing controller
      if (sw.state === 'installed' && navigator.serviceWorker.controller) {
        checkWaitingAndNotify(reg);
      }
    });
  });
}

export async function registerServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Vite serves /sw.js from public/
    const reg = await navigator.serviceWorker.register('/sw.js');
    await wireRegistration(reg);

    // Also re-check when page becomes visible (covers background update finishing)
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        checkWaitingAndNotify(reg);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return reg;
  } catch {
    return null;
  }
}

// Backwards-compatible named export some earlier builds used.
export const registerServiceWorkerUpdate = registerServiceWorkerUpdates;

