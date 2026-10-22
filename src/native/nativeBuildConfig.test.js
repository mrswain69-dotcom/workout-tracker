import { expect, it } from 'vitest';
import { validateNativeEnvironment } from '../../scripts/nativeBuildConfig.js';
it('requires explicit test backend configuration and explicit permission for production',()=>{
 expect(()=>validateNativeEnvironment({})).toThrow('test Supabase');
 const config={VITE_SUPABASE_URL:'https://chdoyavyydwaewpuzbsb.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_publishable_example'};
 expect(()=>validateNativeEnvironment(config)).toThrow('production');
 expect(()=>validateNativeEnvironment({...config,NATIVE_ALLOW_PRODUCTION:'1'})).not.toThrow();
 expect(()=>validateNativeEnvironment({...config,VITE_SUPABASE_URL:'https://staging.supabase.co'})).not.toThrow();
});
it('permits unconfigured shell smoke builds and refuses private keys',()=>{
 expect(()=>validateNativeEnvironment({NATIVE_SHELL_ONLY:'1'})).not.toThrow();
 expect(()=>validateNativeEnvironment({VITE_SUPABASE_URL:'https://staging.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_secret_example'})).toThrow('secret');
 const key='a.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.sig';
 expect(()=>validateNativeEnvironment({VITE_SUPABASE_URL:'https://staging.supabase.co',VITE_SUPABASE_ANON_KEY:key})).toThrow('service-role');
});
