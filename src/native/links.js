// Accept only our exact auth callback. Never navigate to a URL supplied by a link.
export function parseNativeAuthLink(raw) {
  let url; try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'io.workouttrackerapp.app:' || url.hostname !== 'auth' || url.pathname !== '/callback') return null;
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has('error') || hash.has('error')) return { error: 'This sign-in link could not be used. Request a new link.' };
  const code = url.searchParams.get('code');
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');
  const recovery = hash.get('type') === 'recovery' || url.searchParams.get('type') === 'recovery';
  if (code) return { code, recovery };
  if (access_token && refresh_token) return { access_token, refresh_token, recovery };
  return null;
}

export async function acceptNativeAuthLink(raw, auth) {
  const link = parseNativeAuthLink(raw);
  if (!link) return null;
  if (link.error) throw new Error(link.error);
  const result = link.code
    ? await auth.exchangeCodeForSession(link.code)
    : await auth.setSession({ access_token: link.access_token, refresh_token: link.refresh_token });
  if (result.error) throw result.error;
  return { session: result.data?.session || null, recovery: link.recovery };
}
