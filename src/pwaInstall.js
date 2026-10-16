// Device-local install UX. Browser eligibility is positive evidence; a missing
// event never means "not installed". No install preferences sync to an account.
export const INSTALL_REMINDER_KEY = 'wt_install_reminder_v1';

export function installDevice(navigator = {}) {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  return {
    platform: ios ? 'ios' : android ? 'android' : 'other',
    // Screen size alone must never turn a desktop into a phone.
    isPhone: navigator.userAgentData?.mobile === true || /iPhone|iPod|Android.*Mobile/i.test(ua),
  };
}

export function createPwaInstallController(win) {
  const device = installDevice(win?.navigator);
  const modes = ['standalone', 'minimal-ui', 'window-controls-overlay']
    .map(mode => win?.matchMedia?.(`(display-mode: ${mode})`)).filter(Boolean);
  let state = { ...device, standalone: false, installed: false, canInstall: false,
    showReminder: false, prompting: false, outcome: '' };
  let deferredPrompt = null;
  let installedEvent = false;
  let reminderHidden = false;
  let started = false;
  const subscribers = new Set();
  const cleanups = [];

  function storedPreference() {
    try {
      const storage = win.localStorage;
      let value = storage.getItem(INSTALL_REMINDER_KEY);
      if (!value) {
        // If a dismissal cannot persist, keep automatic reminders off.
        storage.setItem(INSTALL_REMINDER_KEY, 'ready');
        value = storage.getItem(INSTALL_REMINDER_KEY);
      }
      return value || 'unavailable';
    } catch { return 'unavailable'; }
  }

  function hideReminder(reason = 'dismissed') {
    reminderHidden = true;
    try { win.localStorage.setItem(INSTALL_REMINDER_KEY, reason); } catch { /* Optional preference. */ }
  }

  function publish(changes = {}) {
    const standalone = !!win?.navigator?.standalone || modes.some(query => query.matches);
    const installed = standalone || installedEvent;
    if (installed) {
      deferredPrompt = null;
      hideReminder('installed');
    }
    const canInstall = !!deferredPrompt && !installed;
    state = { ...state, ...changes, standalone, installed, canInstall };
    state.showReminder = device.isPhone && canInstall && !reminderHidden && !state.prompting;
    subscribers.forEach(callback => callback());
  }

  function onBeforeInstall(event) {
    event.preventDefault(); // No browser-driven automatic popup, including desktop.
    if (typeof event.prompt !== 'function') return;
    deferredPrompt = event;
    publish({ outcome: '' });
  }
  function onInstalled() {
    installedEvent = true;
    publish({ prompting: false, outcome: 'installed' });
  }
  function refresh() { publish(); }
  function onStorage(event) {
    if (event.key === INSTALL_REMINDER_KEY || event.key === null) {
      reminderHidden = storedPreference() !== 'ready';
      publish();
    }
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => state,
    subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    start() {
      if (started || !win) return;
      started = true;
      reminderHidden = storedPreference() !== 'ready';
      for (const [event, handler] of [
        ['beforeinstallprompt', onBeforeInstall], ['appinstalled', onInstalled],
        ['storage', onStorage], ['pageshow', refresh], ['focus', refresh],
      ]) {
        win.addEventListener(event, handler);
        cleanups.push(() => win.removeEventListener(event, handler));
      }
      for (const query of modes) {
        query.addEventListener?.('change', refresh);
        cleanups.push(() => query.removeEventListener?.('change', refresh));
      }
      publish();
    },
    stop() { cleanups.splice(0).forEach(cleanup => cleanup()); started = false; },
    dismiss() { hideReminder(); publish(); },
    async install() {
      const event = deferredPrompt;
      if (!event || state.installed || state.prompting) return;
      deferredPrompt = null; // Each browser event can only be used once.
      hideReminder();
      publish({ prompting: true, outcome: '' });
      try {
        // Invoke immediately within the user's click (before the first await).
        const result = await event.prompt();
        const choice = result?.outcome ? result : await event.userChoice;
        publish({ prompting: false, outcome: state.installed ? 'installed' : choice?.outcome || 'dismissed' });
      } catch {
        publish({ prompting: false, outcome: state.installed ? 'installed' : 'error' });
      }
    },
  };
}

export const pwaInstall = createPwaInstallController(typeof window === 'undefined' ? null : window);
