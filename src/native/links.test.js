import { expect, it, vi } from 'vitest';
import { parseNativeAuthLink, acceptNativeAuthLink } from './links.js';
it('rejects other apps, callback paths, hosts and external URLs',()=>{
 for(const url of ['https://evil.example/?code=x','other://auth/callback?code=x','io.workouttrackerapp.app://evil/callback?code=x','io.workouttrackerapp.app://auth/other?code=x','broken']) expect(parseNativeAuthLink(url)).toBeNull();
});
it('accepts cold/warm callback shapes without navigating to supplied paths',async()=>{
 const auth={exchangeCodeForSession:vi.fn(async()=>({data:{session:{user:{id:'u'}}}})),setSession:vi.fn(async()=>({data:{session:{user:{id:'u'}}}}))};
 expect((await acceptNativeAuthLink('io.workouttrackerapp.app://auth/callback?code=abc',auth)).session.user.id).toBe('u');
 expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
 expect((await acceptNativeAuthLink('io.workouttrackerapp.app://auth/callback#access_token=a&refresh_token=b&type=recovery',auth)).recovery).toBe(true);
 expect(auth.setSession).toHaveBeenCalledWith({access_token:'a',refresh_token:'b'});
});
it('surfaces expired-link errors and rejects incomplete credentials',async()=>{
 const auth={setSession:vi.fn(async()=>({error:new Error('Expired')}))};
 await expect(acceptNativeAuthLink('io.workouttrackerapp.app://auth/callback#access_token=a&refresh_token=b',auth)).rejects.toThrow('Expired');
 expect(parseNativeAuthLink('io.workouttrackerapp.app://auth/callback#access_token=a')).toBeNull();
});
