import { describe, expect, it, vi } from 'vitest';
import { createPwaInstallController, installDevice, INSTALL_REMINDER_KEY } from './pwaInstall';

const phoneUA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
function browser({ userAgent = phoneUA, storage = new Map(), standalone = false } = {}) {
  const win = new EventTarget();
  win.navigator = { userAgent, standalone };
  win.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  };
  const query = new EventTarget();
  query.matches = standalone;
  win.matchMedia = () => query;
  const controller = createPwaInstallController(win);
  controller.start();
  function eligible(outcome = 'accepted') {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = vi.fn(() => Promise.resolve({ outcome }));
    win.dispatchEvent(event);
    return event;
  }
  return { win, controller, eligible, storage, query };
}

describe('device-local PWA installation', () => {
  it('waits for browser eligibility rather than inferring missing installation', () => {
    const { controller, eligible } = browser();
    expect(controller.getSnapshot().showReminder).toBe(false);
    const event = eligible();
    expect(event.defaultPrevented).toBe(true);
    expect(controller.getSnapshot().showReminder).toBe(true);
    expect(event.prompt).not.toHaveBeenCalled();
  });

  it('never nudges desktop users, even when the browser can install', () => {
    const { controller, eligible } = browser({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130' });
    eligible();
    expect(controller.getSnapshot()).toMatchObject({ isPhone: false, canInstall: true, showReminder: false });
  });

  it('treats unknown devices conservatively and recognizes phones without width checks', () => {
    expect(installDevice({})).toEqual({ platform: 'other', isPhone: false });
    expect(installDevice({ userAgent: 'Android Tablet' }).isPhone).toBe(false);
    expect(installDevice({ userAgent: 'iPhone' })).toEqual({ platform: 'ios', isPhone: true });
    expect(installDevice({ platform: 'MacIntel', maxTouchPoints: 5 }).platform).toBe('ios');
    expect(installDevice({ userAgentData: { mobile: true } }).isPhone).toBe(true);
    const { eligible, controller } = browser({ userAgent: '' });
    eligible();
    expect(controller.getSnapshot().showReminder).toBe(false);
  });

  it('keeps iPhone silent when no programmatic install event is available', () => {
    const { controller } = browser({ userAgent: 'iPhone Safari' });
    expect(controller.getSnapshot()).toMatchObject({ platform: 'ios', canInstall: false, showReminder: false });
  });

  it('does not promote installation inside the installed app', () => {
    const { controller, eligible } = browser({ standalone: true });
    eligible();
    expect(controller.getSnapshot()).toMatchObject({ installed: true, standalone: true, canInstall: false, showReminder: false });
  });

  it('reacts to installation and display-mode changes', () => {
    const { win, query, eligible, controller, storage } = browser();
    eligible();
    query.matches = true;
    query.dispatchEvent(new Event('change'));
    expect(controller.getSnapshot().showReminder).toBe(false);
    expect(storage.get(INSTALL_REMINDER_KEY)).toBe('installed');
    query.matches = false;
    win.dispatchEvent(new Event('appinstalled'));
    expect(controller.getSnapshot()).toMatchObject({ installed: true, canInstall: false });
  });

  it('remembers dismissal in this browser without disabling manual installation', async () => {
    const storage = new Map();
    const first = browser({ storage });
    first.eligible();
    first.controller.dismiss();
    expect(first.controller.getSnapshot()).toMatchObject({ canInstall: true, showReminder: false });
    first.controller.stop();
    const second = browser({ storage });
    const event = second.eligible();
    expect(second.controller.getSnapshot().showReminder).toBe(false);
    await second.controller.install();
    expect(event.prompt).toHaveBeenCalledOnce();
    // A separate device/browser has independent preferences.
    const other = browser();
    other.eligible();
    expect(other.controller.getSnapshot().showReminder).toBe(true);
  });

  it('does not claim an old install marker proves the app is still installed', () => {
    const { controller, eligible } = browser({ storage: new Map([[INSTALL_REMINDER_KEY, 'installed']]) });
    eligible();
    expect(controller.getSnapshot()).toMatchObject({ installed: false, canInstall: true, showReminder: false });
  });

  it('suppresses automatic reminders if preferences cannot be saved', () => {
    const { win, controller, eligible } = browser();
    controller.stop();
    win.localStorage = { getItem: () => null, setItem: () => { throw new Error('blocked'); } };
    controller.start();
    eligible();
    expect(controller.getSnapshot()).toMatchObject({ canInstall: true, showReminder: false });
  });

  it('handles dismissal from another tab', () => {
    const { win, controller, eligible, storage } = browser();
    eligible();
    storage.set(INSTALL_REMINDER_KEY, 'dismissed');
    const event = new Event('storage');
    event.key = INSTALL_REMINDER_KEY;
    win.dispatchEvent(event);
    expect(controller.getSnapshot().showReminder).toBe(false);
  });

  it('only invokes the prompt once, directly in the click, without assuming installation', async () => {
    const { controller, eligible } = browser();
    const event = eligible();
    const pending = controller.install();
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toMatchObject({ prompting: true, canInstall: false, showReminder: false });
    await controller.install();
    await pending;
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toMatchObject({ installed: false, prompting: false, outcome: 'accepted' });
  });

  it('supports legacy userChoice and cancellation, and handles installer errors', async () => {
    const { controller, eligible } = browser();
    const event = eligible();
    event.prompt.mockResolvedValue(undefined);
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    await controller.install();
    expect(controller.getSnapshot()).toMatchObject({ outcome: 'dismissed', canInstall: false });
    const retry = eligible();
    retry.prompt.mockRejectedValue(new Error('unavailable'));
    await controller.install();
    expect(controller.getSnapshot()).toMatchObject({ outcome: 'error', prompting: false });
  });

  it('initializes once and cleans up listeners', () => {
    const { win, controller, eligible } = browser();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.start();
    eligible();
    expect(listener).toHaveBeenCalledOnce();
    controller.stop();
    win.dispatchEvent(new Event('appinstalled'));
    expect(listener).toHaveBeenCalledOnce();
  });
});
