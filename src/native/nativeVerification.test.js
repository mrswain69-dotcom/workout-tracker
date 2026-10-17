import {afterEach,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {verifyNativeBundle} from '../../scripts/verifyNativeBundle.js';
let root;
afterEach(async()=>{if(root)await rm(root,{recursive:true,force:true});});
async function fixture(target='staging') {
 root=await mkdtemp(path.join(tmpdir(),'wt-bundle-'));await mkdir(path.join(root,'assets'));
 const info={schema:1,commit:'a'.repeat(40),version:'0.1.0',dirty:false,target,
  apiOrigin:target==='shell'?null:'https://relsoshjvfcjcwhzofjs.supabase.co',authRedirect:'io.workouttrackerapp.app.staging://auth/callback'};
 await writeFile(path.join(root,'native-build.json'),JSON.stringify(info));
 await writeFile(path.join(root,'index.html'),'<main>Workout Tracker</main>');
 await writeFile(path.join(root,'assets/app.js'),target==='shell'?'app':'https://relsoshjvfcjcwhzofjs.supabase.co io.workouttrackerapp.app.staging://auth/callback');
 await writeFile(path.join(root,'native-artwork-report.json'),JSON.stringify({inputBytes:100,outputBytes:60,converted:1}));
 return info;
}
it('verifies staging identity without declaring a public release ready',async()=>{
 await fixture();const r=await verifyNativeBundle(root);expect(r.verified).toBe(true);expect(r.releaseReady).toBe(false);expect(r.bundleBytes).toBeGreaterThan(0);
});
it('rejects production endpoints and PWA workers in a staging artifact',async()=>{
 await fixture();await writeFile(path.join(root,'assets/app.js'),'https://relsoshjvfcjcwhzofjs.supabase.co io.workouttrackerapp.app.staging://auth/callback https://chdoyavyydwaewpuzbsb.supabase.co');
 await expect(verifyNativeBundle(root)).rejects.toThrow('Production API');
 await writeFile(path.join(root,'sw.js'),'worker');await expect(verifyNativeBundle(root)).rejects.toThrow('service worker');
});
it('rejects configured shell artifacts and dirty CI builds',async()=>{
 const info=await fixture('shell');expect((await verifyNativeBundle(root)).target).toBe('shell');
 await writeFile(path.join(root,'assets/app.js'),'https://relsoshjvfcjcwhzofjs.supabase.co');
 await expect(verifyNativeBundle(root)).rejects.toThrow('Configured API');
 await writeFile(path.join(root,'native-build.json'),JSON.stringify({...info,dirty:true}));
 await expect(verifyNativeBundle(root,{requireClean:true})).rejects.toThrow('uncommitted');
});
