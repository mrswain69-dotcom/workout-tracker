import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, single } = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { rpc } }));
import { getOrCreateFamily } from './db';

describe('atomic family bootstrap', () => {
  beforeEach(() => {
    single.mockReset();
    rpc.mockReset().mockReturnValue({ single });
  });

  it('passes the blank plan into the same transaction that creates the account', async () => {
    const plan = { days: [] };
    const family = { id: 'family-1' };
    single.mockResolvedValue({ data: family, error: null });
    await expect(getOrCreateFamily('My Family', plan)).resolves.toEqual({ family, error: null });
    expect(rpc).toHaveBeenCalledWith('bootstrap_family_account', {
      default_family_name: 'My Family', initial_plan: plan,
    });
    expect(single).toHaveBeenCalledTimes(1);
  });

  it('propagates failed initialization instead of falling back to non-atomic inserts', async () => {
    const error = { message: 'Not logged in', code: '42501' };
    single.mockResolvedValue({ data: null, error });
    await expect(getOrCreateFamily()).resolves.toEqual({ family: null, error });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
