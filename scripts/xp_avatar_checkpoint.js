async function upload(paths,message) {
const repo="mrswain69-dotcom/workout-tracker",wd="/workspace/scratch/77b20176f3d2/workout-tracker",entries=[];
for(const path of paths) {
 const size=await tools.exec_command({cmd:"python -c 'import pathlib;print(pathlib.Path("+JSON.stringify(path)+").stat().st_size)'",workdir:wd,max_output_tokens:100});
 const total=4*Math.ceil(Number(size.output.trim())/3);let content="";
 for(let offset=0;offset<total;offset+=450000) {
 const r=await tools.exec_command({cmd:"python -c 'import base64,pathlib;print(base64.b64encode(pathlib.Path("+JSON.stringify(path)+").read_bytes()).decode()["+offset+":"+Math.min(offset+450000,total)+"])'",workdir:wd,max_output_tokens:200000});
 const c=r.output.trim();if(c.length!==Math.min(450000,total-offset)||!/^[A-Za-z0-9+/=]+$/.test(c))throw Error("Incomplete "+path);content+=c;
 }
 const blob=await tools.mcp__codex_apps__github_create_blob({repository_full_name:repo,encoding:"base64",content});if(blob.isError)throw Error(JSON.stringify(blob));
 const hash=await tools.exec_command({cmd:"git hash-object '"+path+"'",workdir:wd,max_output_tokens:100});
 if(hash.output.trim()!==blob.structuredContent.sha)throw Error("Checksum "+path);
 entries.push({path,mode:"100644",type:"blob",sha:blob.structuredContent.sha});
}
const tr=await tools.mcp__codex_apps__github_create_tree({repository_full_name:repo,base_tree_sha:load("remoteTree"),tree_elements:entries});if(tr.isError)throw Error("tree");
const co=await tools.mcp__codex_apps__github_create_commit({repository_full_name:repo,parent_sha:load("remoteHead"),tree_sha:tr.structuredContent.sha,message});if(co.isError)throw Error("commit");
const u=await tools.mcp__codex_apps__github_update_ref({repository_full_name:repo,branch_name:"feature/xp-avatar-packs16-20",expected_sha:load("remoteHead"),sha:co.structuredContent.sha});if(u.isError)throw Error("ref");
store("remoteHead",co.structuredContent.sha);store("remoteTree",tr.structuredContent.sha);return co.structuredContent.sha;
}
