// Service worker update notifier.
// Dispatches a browser event when a new version is waiting to activate.

export function registerServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      const notify = () => {
        window.dispatchEvent(
          new CustomEvent('kwt-sw-update', { detail: { registration: reg } })
        );
      };

      if (reg.waiting) notify();

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            notify();
          }
        });
      });
    } catch {
      // ignore
    }
  });
}
