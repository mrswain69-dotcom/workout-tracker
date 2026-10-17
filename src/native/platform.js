import { Capacitor } from '@capacitor/core';
export const isNativeApp = () => Capacitor.isNativePlatform();
export function nativeAuthRedirect(target = import.meta.env.VITE_NATIVE_BUILD_TARGET) {
  return target === 'staging' ? 'io.workouttrackerapp.app.staging://auth/callback' : 'io.workouttrackerapp.app://auth/callback';
}
export const NATIVE_AUTH_REDIRECT = nativeAuthRedirect();
export function authRedirectUrl(win = globalThis.window) {
  if (isNativeApp()) return NATIVE_AUTH_REDIRECT;
  const origin = win?.location?.origin;
  return /^https?:\/\//i.test(origin || '') ? `${origin}/` : undefined;
}
