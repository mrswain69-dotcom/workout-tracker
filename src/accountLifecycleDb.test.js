import { beforeEach, expect, it, vi } from 'vitest';

const { invoke, signOut } = vi.hoisted(() => ({ invoke: vi.fn(), signOut: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { functions: { invoke }, auth: { signOut } } }));
import { permanentlyDeleteAccount } from './accountLifecycleDb.js';

beforeEach(() => { invoke.mockReset(); signOut.mockReset(); });

it('clears the local session before confirmed deletion resolves', async () => {
  invoke.mockResolvedValue({ data: { deleted: true }, error: null });
  let finish;
  signOut.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  let completed = false;
  const deletion = permanentlyDeleteAccount({ password: 'synthetic', confirmation: 'DELETE' }).then(result => { completed = true; return result; });
  await vi.waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: 'local' }));
  expect(completed).toBe(false);
  finish({ error: null });
  expect((await deletion).data.deleted).toBe(true);
});

it.each([
  { data: null, error: new Error('Incorrect password') },
  { data: { deleted: false }, error: null },
])('preserves the session when deletion is not confirmed', async result => {
  invoke.mockResolvedValue(result);
  await permanentlyDeleteAccount({ password: 'synthetic', confirmation: 'DELETE' });
  expect(signOut).not.toHaveBeenCalled();
});

it('still reports final server deletion so draft cleanup runs if local signout throws', async () => {
  invoke.mockResolvedValue({ data: { deleted: true }, error: null });
  signOut.mockRejectedValue(new Error('Storage unavailable'));
  expect((await permanentlyDeleteAccount({ password: 'synthetic', confirmation: 'DELETE' })).data.deleted).toBe(true);
});
