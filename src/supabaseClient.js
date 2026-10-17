import { clearGroupBoardCache } from './groups/groupBoardCache';
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If env vars missing, we keep a null client so the app can show a setup message.
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Never carry cached group standings into another signed-in account.
let boardCacheUser;
supabase?.auth.onAuthStateChange((event, session) => {
  const userId = session?.user?.id || null;
  if (event === 'SIGNED_OUT' || (boardCacheUser !== undefined && userId !== boardCacheUser)) clearGroupBoardCache();
  boardCacheUser = userId;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('wt-auth-state', { detail: { event, session } }));
});
