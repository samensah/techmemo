import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readSession, sessionConfiguration } from './auth.mjs';
import { visibleData, mergeProjectData } from './project-data.mjs';
const hash = token=>createHash('sha256').update(token).digest('hex');
const uuid = value=>typeof value==='string'&&/^[0-9a-f-]{36}$/.test(value);
const json=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
const error=(status,message)=>Object.assign(new Error(message),{status});
export function projectStore(env, exchange=fetch){
  const url=env.SUPABASE_URL, key=env.SUPABASE_SECRET_KEY;
  if(!url || !key || !sessionConfiguration(env))return null;
  let origin;try{origin=new URL(url).origin}catch{return null}
  if(!origin.startsWith('https://'))return null;
  return async(path,{method='GET',body}={})=>{
    const headers={apikey:key,'Content-Type':'application/json',Prefer:'return=representation'};
    // New secret keys belong in apikey, legacy service_role keys also require Authorization.
    if(!key.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
    const result=await exchange(`${origin}/rest/v1/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!result.ok)throw error(503,'Project storage is unavailable. Check the Supabase migration and server configuration.');
    return result.status===204?null:result.json();
  };
}
export function createProjectsHandler({env=process.env,store=projectStore(env),getSession=req=>readSession(req,env)}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    try{
      const user=await getSession(req);if(!user)return json(res,401,{error:'Please log in to access your workspace.'});
      if(!store)return json(res,503,{error:'Project storage needs setup. Run the Supabase project migration and add SUPABASE_SECRET_KEY in Vercel.'});
      if(!['GET','POST','PUT'].includes(req.method))return json(res,405,{error:'Method not allowed'});
      if(req.method!=='GET' && req.headers.origin!==sessionConfiguration(env)?.origin)return json(res,403,{error:'Invalid origin'});
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
      const action=req.query?.action,id=req.query?.id;
      if(action==='accept'&&req.method==='POST'){
        if(typeof body.token!=='string'||!/^[a-zA-Z0-9_-]{43}$/.test(body.token))throw error(400,'Invalid invitation.');
        let projectId;
        try{projectId=await store('rpc/tm_accept_invite',{method:'POST',body:{p_token_hash:hash(body.token),p_user_id:user.id,p_email:user.email.toLowerCase(),p_name:user.name}})}
        catch{throw error(403,'This invitation is expired, already used, or belongs to another email address. Sign in with the invited address.');}
        return json(res,200,{projectId});
      }
      if(!id&&req.method==='GET'){
        const mine=await store(`tm_project_members?user_id=eq.${encodeURIComponent(user.id)}&select=project_id`);
        if(!mine.length)return json(res,200,{projects:[]});
        const ids=mine.map(m=>m.project_id).filter(uuid).join(',');
        const projects=await store(`tm_projects?id=in.(${ids})&order=created_at.desc`);
        const members=await store(`tm_project_members?project_id=in.(${ids})`);
        return json(res,200,{projects:projects.map(p=>({...p,data:visibleData(p,user.id),members:members.filter(m=>m.project_id===p.id)}))});
      }
      if(!id&&req.method==='POST'){
        if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100||typeof body.description!=='string'||!body.description.trim()||body.description.length>3000
          ||!['IFRS 15','IFRS 16','IAS 36','IFRS 3'].includes(body.standard)||typeof body.period!=='string'||body.period.length>100)throw error(400,'Enter a project title, accounting question, standard and reporting period.');
        const projectId=randomUUID();
        const data={conversations:[{id:randomUUID(),workspace:projectId,kind:'general',name:'General discussion',members:[]}],messages:[],files:[],evidence:[],versions:[],activities:[],seq:0};
        await store('rpc/tm_create_project',{method:'POST',body:{p_id:projectId,p_user_id:user.id,p_email:user.email,p_user_name:user.name,p_name:body.name.trim(),p_description:body.description.trim(),p_standard:body.standard,p_period:body.period,p_data:data}});
        return json(res,201,{projectId});
      }
      if(!uuid(id))throw error(404,'Project not found.');
      const memberships=await store(`tm_project_members?project_id=eq.${id}`);
      if(!memberships.some(m=>m.user_id===user.id))throw error(404,'Project not found.');
      const projects=await store(`tm_projects?id=eq.${id}`),project=projects[0];
      if(!project)throw error(404,'Project not found.');
      if(action==='invite'&&req.method==='POST'){
        if(project.owner_id!==user.id)throw error(403,'Only the project owner can invite people.');
        const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
        if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw error(400,'Enter the invitee’s email address.');
        const token=randomBytes(32).toString('base64url');
        await store('tm_project_invites',{method:'POST',body:{project_id:id,email,token_hash:hash(token),expires_at:new Date(Date.now()+7*86400000).toISOString()}});
        return json(res,201,{link:`${sessionConfiguration(env).origin}/workspace.html?invite=${token}`,email});
      }
      if(req.method==='PUT'){
        if(body.revision!==project.revision)throw error(409,'The project changed in another session. Reload before making further edits. Your current edits have not been saved.');
        const data=mergeProjectData(project,memberships,user,body.data);
        const result=await store(`tm_projects?id=eq.${id}&revision=eq.${project.revision}`,{method:'PATCH',body:{data,revision:project.revision+1}});
        if(!result.length)throw error(409,'Another user saved first. Reload before making further edits. Your current edits have not been saved.');
        return json(res,200,{revision:project.revision+1});
      }
      throw error(405,'Method not allowed');
    }catch(err){return json(res,err.status||503,{error:err.status?err.message:'Project storage is temporarily unavailable.'});}
  };
}
