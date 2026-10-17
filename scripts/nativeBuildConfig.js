export function validateNativeEnvironment(env) {
  if (env.NATIVE_SHELL_ONLY === '1') return;
  const url = env.VITE_SUPABASE_URL || '';
  const key = env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key || /YOURPROJECT|YOUR_ANON|replace-me/i.test(url + key)) {
    throw new Error('Native builds need a test Supabase URL and public key in .env.native.local. Use NATIVE_SHELL_ONLY=1 only for an unconfigured build smoke test.');
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('Native API must use HTTPS.');
  if (parsed.hostname === 'chdoyavyydwaewpuzbsb.supabase.co' && env.NATIVE_ALLOW_PRODUCTION !== '1') {
    throw new Error('Native builds cannot use the production database without explicit NATIVE_ALLOW_PRODUCTION=1.');
  }
  if (key.startsWith('sb_secret_')) throw new Error('Never bundle a Supabase secret key.');
  if (key.split('.').length === 3) {
    try { if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'service_role') throw new Error('Never bundle a Supabase service-role key.'); }
    catch (error) { if (error.message.includes('service-role')) throw error; }
  }
}
