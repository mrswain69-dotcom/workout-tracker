import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateNativeEnvironment } from './nativeBuildConfig.js';

// Public client configuration only. Never load a production env or server secret here.
const config = JSON.parse(await readFile(new URL('../config/native-staging.json',import.meta.url),'utf8'));
if (config.projectRef !== 'relsoshjvfcjcwhzofjs' || config.url !== `https://${config.projectRef}.supabase.co` ||
    !config.publishableKey.startsWith('sb_publishable_')) throw new Error('Unexpected staging backend');
const env = {...process.env, VITE_SUPABASE_URL:config.url,VITE_SUPABASE_ANON_KEY:config.publishableKey,
  VITE_LOG_SYNC_MODE:'versioned',VITE_NATIVE_BUILD_TARGET:'staging',NATIVE_ALLOW_PRODUCTION:'',NATIVE_SHELL_ONLY:''};
validateNativeEnvironment(env);
const root = fileURLToPath(new URL('../',import.meta.url));
const result = spawnSync(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'build','--mode','native'],{cwd:root,env,stdio:'inherit'});
if(result.error) throw result.error;
process.exitCode=result.status ?? 1;
