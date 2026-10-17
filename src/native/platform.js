import { Capacitor } from '@capacitor/core';
export const isNativeApp = () => Capacitor.isNativePlatform();
export const NATIVE_AUTH_REDIRECT = 'io.workouttrackerapp.app://auth/callback';
export function authRedirectUrl(win = globalThis.window) {
  if (isNativeApp()) return NATIVE_AUTH_REDIRECT;
  const origin = win?.location?.origin;
  return /^https?:\/\//i.test(origin || '') ? `${origin}/` : undefined;
}
