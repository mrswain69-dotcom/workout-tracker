async function generatePack(number) {
const wd="/workspace/scratch/77b20176f3d2/workout-tracker",p=load("packs").find(p=>p.number===number);
const known=await tools.exec_command({cmd:"python -c 'import pathlib,json;print(json.dumps([p.name for p in pathlib.Path(\"public/avatars/pack"+number+"\").glob(\"*.png\")]))'",workdir:wd,max_output_tokens:1000});
const done=JSON.parse(known.output);
const jobs=p.avatars.filter(a=>!done.includes(a.file));
const result=await Promise.allSettled(jobs.map(async a=>{
const r=await tools.image_gen__imagegen({referenced_image_paths:["/workspace/scratch/77b20176f3d2/upload/pack"+number+"-contact-sheet.jpg"],transparent_background:true,prompt:"Reconstruct ONE original Workout Tracker avatar "+a.name+" ("+a.subtitle+") from the reference sheet. Target row "+(Math.floor(a.index/4)+1)+" column "+(a.index%4+1)+" labelled "+a.name+". Closely preserve target silhouette, palette, face/head design, materials, pose and props: "+a.design+". Crisp premium stylised 3D collectible game-skin finish, believable materials, polished studio lighting, teen/adult proportions. Output ONLY this selected subject on actual fully transparent alpha background. No other cells, labels, text, scenery, floor, opaque shadow, logos or aura. Humanoids waist-up portrait; vehicles and nonhumanoid robots whole body as shown. Square 1024x1024, centered with 10% safe margin. NO human accompanying a drone and NO aircraft behind a portrait."});
generatedImage(r);
const source=r.output_hint?.match(/as (\/[^\n]+\.png) by default/)?.[1];if(!source||!/^[\/a-zA-Z0-9_.-]+$/.test(source))throw Error("Missing image path");
const raw="docs/avatar-production/rebuild-originals/pack"+number+"/"+a.file,target="public/avatars/pack"+number+"/"+a.file;
const saved=await tools.exec_command({cmd:"mkdir -p docs/avatar-production/rebuild-originals/pack"+number+" && cp '"+source+"' '"+raw+"' && python scripts/prepare_xp_avatar.py '"+raw+"' '"+target+"'",workdir:wd,max_output_tokens:200});
if(saved.exit_code!==0)throw Error(saved.output);return [raw,target];
}));
const failed=result.filter(r=>r.status==="rejected");if(failed.length)text(failed.map(r=>String(r.reason)));
return result.filter(r=>r.status==="fulfilled").flatMap(r=>r.value);
}
