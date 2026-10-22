import { App as NativeApp } from '@capacitor/app';
import { supabase } from '../supabaseClient.js';
import { acceptNativeAuthLink } from './links.js';
import { isNativeApp } from './platform.js';

export async function startNativeRuntime() {
  if (!isNativeApp()) return;
  document.documentElement.classList.add('nativeApp');
  const handleUrl = async ({ url }) => {
    if (!supabase) return;
    try {
      const result = await acceptNativeAuthLink(url, supabase.auth);
      if (result) window.dispatchEvent(new CustomEvent('wt-native-auth', { detail: result }));
    } catch {
      // Never log callback URLs: they can contain access/refresh tokens.
      window.dispatchEvent(new CustomEvent('wt-native-auth-error'));
    }
  };
  // Register warm-link handler before checking a cold launch.
  await NativeApp.addListener('appUrlOpen', handleUrl);
  const launch = await NativeApp.getLaunchUrl();
  if (launch?.url) await handleUrl(launch);
  await NativeApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      supabase?.auth.startAutoRefresh();
      window.dispatchEvent(new Event('wt-app-resume'));
    } else {
      supabase?.auth.stopAutoRefresh();
    }
  });
  await NativeApp.addListener('backButton', ({ canGoBack }) => {
    // Let dialogs consume back first, then return to Dashboard. Do not exit
    // while a user may have pending changes.
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    const dashboard = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Dashboard');
    if (dashboard && !dashboard.classList.contains('active')) dashboard.click();
    else if (canGoBack) window.history.back();
    else NativeApp.minimizeApp();
  });
}
