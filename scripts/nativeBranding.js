import sharp from 'sharp';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';

// Derive platform sizes from the existing app mark; never overwrite public originals.
const root = process.cwd();
const source = await readFile(path.join(root,'public/icons/icon-512.png'));
const sample = await sharp(source).extract({left:80,top:80,width:1,height:1}).removeAlpha().raw().toBuffer();
const orange={r:sample[0],g:sample[1],b:sample[2],alpha:1};
const hex='#'+[orange.r,orange.g,orange.b].map(v=>v.toString(16).padStart(2,'0')).join('');
const opaque = await sharp(source).flatten({background:orange}).png().toBuffer();
const base='android/app/src/main/res';
for (const [density,scale] of Object.entries({mdpi:1,hdpi:1.5,xhdpi:2,xxhdpi:3,xxxhdpi:4})) {
 const dir=path.join(base,'mipmap-'+density);
 const size=Math.round(48*scale), canvas=Math.round(108*scale), mark=Math.round(66*scale);
 await sharp(opaque).resize(size,size).png().toFile(path.join(dir,'ic_launcher.png'));
 const mask=Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`);
 await sharp(opaque).resize(size,size).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toFile(path.join(dir,'ic_launcher_round.png'));
 const foreground=await sharp(opaque).resize(mark,mark).png().toBuffer();
 await sharp({create:{width:canvas,height:canvas,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:foreground,gravity:'centre'}]).png().toFile(path.join(dir,'ic_launcher_foreground.png'));
}
await writeFile(path.join(base,'values/ic_launcher_background.xml'),`<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">${hex}</color><color name="native_splash_background">#0f172a</color></resources>\n`);
async function splash(file) {
 const metadata=await sharp(file).metadata();
 const side=Math.max(64,Math.round(Math.min(metadata.width,metadata.height)*0.16));
 const icon=await sharp(source).resize(side,side).png().toBuffer();
 await sharp({create:{width:metadata.width,height:metadata.height,channels:4,background:'#0f172a'}}).composite([{input:icon,gravity:'centre'}]).png().toFile(file+'.tmp.png');
 await writeFile(file,await readFile(file+'.tmp.png'));
 const {unlink}=await import('node:fs/promises');await unlink(file+'.tmp.png');
}
for(const dir of await readdir(base)) if(dir.startsWith('drawable')) {
 const file=path.join(base,dir,'splash.png');try{await readFile(file);}catch{continue;}await splash(file);
}
await sharp(opaque).resize(1024,1024).png().toFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
for(const name of await readdir('ios/App/App/Assets.xcassets/Splash.imageset')) if(name.endsWith('.png')) await splash(path.join('ios/App/App/Assets.xcassets/Splash.imageset',name));
console.log('Generated native launcher and splash sizes from the existing Workout Tracker mark.');
