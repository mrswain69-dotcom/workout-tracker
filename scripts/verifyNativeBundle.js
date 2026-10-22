import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function verifyNativeBundle(dir='dist-native', {requireClean = process.env.CI === 'true'} = {}) {
 const info=JSON.parse(await readFile(path.join(dir,'native-build.json'),'utf8'));
 if(requireClean && info.dirty) throw new Error('CI bundle was built from uncommitted changes');
 const html=await readFile(path.join(dir,'index.html'),'utf8');
 if(info.schema!==1 || !/^[a-f0-9]{40}$/.test(info.commit)) throw new Error('Missing build identity');
 if(/rel=["']manifest|@vite\/client|localhost:5173/.test(html)) throw new Error('Native bundle contains development/PWA references');
 try{await stat(path.join(dir,'sw.js'));throw new Error('Native service worker present');}catch(e){if(e.code!=='ENOENT')throw e;}
 const files=await readdir(path.join(dir,'assets'));
 const code=(await Promise.all(files.filter(f=>f.endsWith('.js')).map(f=>readFile(path.join(dir,'assets',f),'utf8')))).join('\n');
 if(info.target==='staging') {
  if(info.apiOrigin!=='https://relsoshjvfcjcwhzofjs.supabase.co' || !code.includes(info.apiOrigin)) throw new Error('Wrong staging API');
  if(code.includes('https://chdoyavyydwaewpuzbsb.supabase.co')) throw new Error('Production API in staging bundle');
  if(info.authRedirect!=='io.workouttrackerapp.app.staging://auth/callback' || !code.includes(info.authRedirect)) throw new Error('Wrong staging callback');
 } else if(info.target==='shell') {
  if(info.apiOrigin!==null || code.includes('https://relsoshjvfcjcwhzofjs.supabase.co') || code.includes('https://chdoyavyydwaewpuzbsb.supabase.co')) throw new Error('Configured API in shell bundle');
 } else throw new Error('Release bundle verification requires a separately reviewed production configuration');
 const artwork=JSON.parse(await readFile(path.join(dir,'native-artwork-report.json'),'utf8'));
 let bytes=0;
 async function walk(folder){for(const f of await readdir(folder,{withFileTypes:true})){const p=path.join(folder,f.name);if(f.isDirectory())await walk(p);else bytes+=(await stat(p)).size;}}
 await walk(dir);
 return {verified:true,...info,artwork,bundleBytes:bytes,
  releaseReady:false,remaining:['Staging signup/confirmation/reset and email delivery','Physical-device acceptance','Production migration/configuration review','Publisher signing and store declarations','Privileged RPC review']};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const report=await verifyNativeBundle(process.argv[2]||'dist-native');
 await writeFile(path.join(process.argv[2]||'dist-native','native-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
