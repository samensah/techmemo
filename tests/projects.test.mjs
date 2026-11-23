import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectsHandler } from '../lib/projects.mjs';
import { visibleData, mergeProjectData } from '../lib/project-data.mjs';
const id='11111111-1111-4111-8111-111111111111';
const alice={id:'alice',email:'alice@example.com',name:'Alice'};
const bob={id:'bob',email:'bob@example.com',name:'Bob'};
const charlie={id:'charlie',email:'charlie@example.com',name:'Charlie'};
const env={APP_URL:'https://techmemo-smoky.vercel.app',AUTH_SECRET:'s'.repeat(48)};
const members=[alice,bob].map(u=>({project_id:id,user_id:u.id,email:u.email,name:u.name}));
const general={id:'c1',workspace:id,kind:'general',name:'General',members:[]};
const privateChannel={id:'c2',workspace:id,kind:'direct',name:'Private',members:['alice']};
const project={id,owner_id:'alice',name:'Revenue',description:'Revenue accounting issue',standard:'IFRS 15',period:'FY 2026',revision:0,
 data:{conversations:[general,privateChannel],messages:[{id:'m1',channel:'c2',author:'alice',text:'Confidential input'}],files:[{id:'f1',workspace:id,channel:'c2',addedBy:'alice',name:'Private.txt',extracted:'secret'}],evidence:[{id:'EV1',workspace:id,kind:'message',channel:'c2',source:'m1',proposedBy:'alice',status:'pending',name:'Private',content:'secret'}],versions:[],activities:[],seq:0}};
async function req(user,{method='GET',query={},body={},origin=env.APP_URL,store}={}){
 const headers={};const res={statusCode:200,setHeader(k,v){headers[k]=v},end(body){this.body=JSON.parse(body)}};
 await createProjectsHandler({env,getSession:async()=>user,store:store||(async path=>path.startsWith('tm_project_members')?members:[project])})({method,query,body,headers:{origin}},res);
 return {status:res.statusCode,body:res.body,headers};
}
test('project endpoints require signed account; new accounts list no projects',async()=>{
 assert.equal((await req(null)).status,401);
 const empty=await req(charlie,{store:async path=>{assert(path.includes('user_id=eq.charlie'));return []}});
 assert.deepEqual(empty.body,{projects:[]});
});
test('guessing a project ID never gives an outsider read or write access',async()=>{
 for(const method of ['GET','PUT'])assert.equal((await req(charlie,{method,query:{id}})).status,404);
});
test('project list is filtered by server identity and private content is stripped',async()=>{
 const result=await req(bob,{store:async path=>path.includes('user_id=eq.bob')?[{project_id:id}]:path.startsWith('tm_project_members')?members:[project]});
 assert.equal(result.status,200);
 assert.equal(result.body.projects.length,1);
 const data=result.body.projects[0].data;
 assert.deepEqual(data.conversations,[general]);assert.deepEqual(data.messages,[]);assert.deepEqual(data.files,[]);assert.deepEqual(data.evidence,[]);
 assert(!JSON.stringify(result.body).includes('Confidential input'));
});
test('only owner creates email-bound invitation links and raw invitation tokens are not stored',async()=>{
 assert.equal((await req(bob,{method:'POST',query:{id,action:'invite'},body:{email:'new@example.com'}})).status,403);
 let stored;
 const invited=await req(alice,{method:'POST',query:{id,action:'invite'},body:{email:'New@Example.com'},store:async(path,options)=>{
  if(options?.method==='POST'){stored=options.body;return [stored]}
  return path.startsWith('tm_project_members')?members:[project];
 }});
 assert.equal(invited.status,201);assert.equal(stored.email,'new@example.com');
 const token=new URL(invited.body.link).searchParams.get('invite');
 assert.equal(token.length,43);assert.equal(stored.token_hash.length,64);assert(!JSON.stringify(stored).includes(token));
});
test('invitation acceptance passes only verified identity to atomic database routine',async()=>{
 const result=await req(bob,{method:'POST',query:{action:'accept'},body:{token:'a'.repeat(43),email:'alice@example.com',user_id:'alice'},store:async(path,options)=>{
  assert.equal(path,'rpc/tm_accept_invite');assert.equal(options.body.p_user_id,'bob');assert.equal(options.body.p_email,'bob@example.com');return id;
 }});
 assert.equal(result.body.projectId,id);
 const invalid=await req(charlie,{method:'POST',query:{action:'accept'},body:{token:'a'.repeat(43)},store:async()=>{throw new Error('database rejected mismatched or expired invitation')}});
 assert.equal(invalid.status,403);
});
test('project creation uses signed-in owner, empty content and atomic owner membership',async()=>{
 const result=await req(bob,{method:'POST',body:{name:'Leases',description:'Assess the lease modification',standard:'IFRS 16',period:'FY 2026',owner:'alice',members:['charlie']},store:async(path,options)=>{
  assert.equal(path,'rpc/tm_create_project');assert.equal(options.body.p_user_id,'bob');assert.equal(options.body.p_email,bob.email);
  assert.deepEqual(options.body.p_data.messages,[]);assert.deepEqual(options.body.p_data.versions,[]);return null;
 }});
 assert.equal(result.status,201);
});
test('collaborator writes preserve hidden data and cannot impersonate another author',()=>{
 const data=visibleData(project,'bob');data.messages.push({id:'m2',channel:'c1',author:'bob',text:'Shared input'});
 const merged=mergeProjectData(project,members,bob,data);assert.equal(merged.messages.length,2);assert.equal(merged.files.length,1);assert.equal(merged.evidence[0].content,'secret');
 data.messages[0].author='alice';assert.throws(()=>mergeProjectData(project,members,bob,data));
});
test('collaborators cannot forge private-channel writes, membership, evidence approval or memo history',()=>{
 const attacks=[
 d=>d.messages.push({id:'m2',channel:'c2',author:'bob',text:'invisible-channel'}),
 d=>d.conversations.push({id:'c3',workspace:id,kind:'group',name:'group',members:['bob','charlie','alice']}),
 d=>d.evidence.push({...project.data.evidence[0],status:'approved',approvedBy:'bob'}),
 d=>d.versions.push({id:'v1',number:1,reason:'test',date:'today',method:'Human edit',sections:[],evidenceIds:[]})
 ];
 for(const attack of attacks){const data=visibleData(project,'bob');attack(data);assert.throws(()=>mergeProjectData(project,members,bob,data))}
});
test('approved excerpts are shared without sharing the private conversation',()=>{
 const approved=structuredClone(project);approved.data.evidence[0].status='approved';
 const view=visibleData(approved,'bob');assert.equal(view.evidence.length,1);assert.equal(view.messages.length,0);assert.equal(view.conversations.length,1);
 const incoming=visibleData(project,'alice');Object.assign(incoming.evidence[0],{status:'approved',approvedBy:'alice',approvedAt:'2026-11-23'});
 assert.equal(mergeProjectData(project,members,alice,incoming).evidence[0].status,'approved');
});
test('edits require current revision and protect against concurrent lost updates',async()=>{
 assert.equal((await req(alice,{method:'PUT',query:{id},body:{revision:2,data:visibleData(project,'alice')}})).status,409);
 const conflict=await req(alice,{method:'PUT',query:{id},body:{revision:0,data:visibleData(project,'alice')},store:async(path,options)=>options?.method==='PATCH'?[]:path.startsWith('tm_project_members')?members:[project]});
 assert.equal(conflict.status,409);
});
test('mutations require canonical origin and malformed project writes are rejected',async()=>{
 assert.equal((await req(alice,{method:'POST',origin:'https://evil.example',body:{}})).status,403);
 assert.equal((await req(alice,{method:'POST',body:{}})).status,400);
 const data=visibleData(project,'alice');data.messages[0].text='overwrite';assert.throws(()=>mergeProjectData(project,members,alice,data));
});

test('members can create direct and group chats without adding the owner',()=>{
 const allMembers=[...members,{project_id:id,user_id:'charlie',name:'Charlie',email:charlie.email}];
 for(const kind of ['direct','group']){
  const data=visibleData(project,'bob');data.conversations.push({id:'c3',workspace:id,kind,name:'Review',members:['bob','charlie']});
  data.messages.push({id:'m3',channel:'c3',author:'bob',text:'Private review'});
  const merged=mergeProjectData(project,allMembers,bob,data);
  assert.equal(visibleData({...project,data:merged},'alice').conversations.some(c=>c.id==='c3'),false);
  assert.equal(visibleData({...project,data:merged},'charlie').messages.some(m=>m.id==='m3'),true);
 }
});
test('proposed private excerpts reach owner for review without revealing the source conversation',()=>{
 const privateProject=structuredClone(project);
 privateProject.data.conversations.push({id:'c3',workspace:id,kind:'direct',name:'Review',members:['bob','charlie']});
 privateProject.data.messages.push({id:'m3',channel:'c3',author:'bob',text:'Full private message'});
 privateProject.data.evidence.push({id:'EV3',workspace:id,kind:'message',source:'m3',channel:'c3',proposedBy:'bob',status:'pending',name:'Selected fact',content:'Selected excerpt'});
 const view=visibleData(privateProject,'alice');
 assert(view.evidence.some(e=>e.id==='EV3'));
 assert(!view.messages.some(m=>m.id==='m3'));assert(!view.conversations.some(c=>c.id==='c3'));
 const selected=view.evidence.find(e=>e.id==='EV3');Object.assign(selected,{status:'approved',approvedBy:'alice',approvedAt:'2026-11-23'});
 const merged=mergeProjectData(privateProject,members,alice,view);
 assert.equal(merged.evidence.find(e=>e.id==='EV3').status,'approved');assert(merged.messages.some(m=>m.id==='m3'));
});
test('direct chats reject extra participants and duplicate membership',()=>{
 const allMembers=[...members,{project_id:id,user_id:'charlie',email:charlie.email,name:'Charlie'}];
 for(const participants of [['bob','alice','charlie'],['bob','bob']]){
  const data=visibleData(project,'bob');data.conversations.push({id:'c3',workspace:id,kind:'direct',name:'Invalid',members:participants});
  assert.throws(()=>mergeProjectData(project,allMembers,bob,data));
 }
});

test('owner can delete approved evidence while preserving messages and historic memo versions',()=>{
 const p=structuredClone(project);p.data.evidence[0].status='approved';
 p.data.versions=[{id:'v1',number:1,reason:'Initial',date:'today',method:'Local template',sections:[{id:'facts',title:'Facts',body:'Original approved fact'}],evidenceIds:['EV1']}];
 const data=visibleData(p,'alice');data.evidence=[];
 const merged=mergeProjectData(p,members,alice,data);
 assert.deepEqual(merged.evidence,[]);assert.deepEqual(merged.versions,p.data.versions);assert.deepEqual(merged.messages,p.data.messages);
 const memberData=visibleData(p,'bob');memberData.evidence=[];assert.throws(()=>mergeProjectData(p,members,bob,memberData));
});
test('new generated drafts cannot reference deleted evidence; manual revisions can preserve historical references',()=>{
 const p=structuredClone(project);p.data.evidence=[];
 p.data.versions=[{id:'v1',number:1,reason:'Initial',date:'today',method:'Local template',sections:[{id:'facts',title:'Facts',body:'Historic fact'}],evidenceIds:['deleted-evidence']}];
 const data=visibleData(p,'alice');
 const revision={...p.data.versions[0],id:'v2',number:2,reason:'Revision'};
 data.versions.push(revision);assert.throws(()=>mergeProjectData(p,members,alice,data));
 revision.method='Human edit';assert.equal(mergeProjectData(p,members,alice,data).versions.length,2);
 revision.evidenceIds=['invented-id'];assert.throws(()=>mergeProjectData(p,members,alice,data));
});

test('chat deletion preferences are private to each participant and retain history/evidence',()=>{
 const p=structuredClone(project);p.data.conversations[1].members=['alice','bob'];
 const data=visibleData(p,'alice');data.hiddenChats=['c2'];
 const merged=mergeProjectData(p,members,alice,data);
 assert.deepEqual(visibleData({...p,data:merged},'alice').hiddenChats,['c2']);
 assert.deepEqual(visibleData({...p,data:merged},'bob').hiddenChats,[]);
 assert.equal(visibleData({...p,data:merged},'bob').hiddenChatsByUser,undefined);
 assert.deepEqual(merged.messages,p.data.messages);assert.deepEqual(merged.evidence,p.data.evidence);
 const other=visibleData({...p,data:merged},'bob');other.hiddenChats=['c2'];
 const both=mergeProjectData({...p,data:merged},members,bob,other);
 assert.deepEqual(both.hiddenChatsByUser.alice,['c2']);assert.deepEqual(both.hiddenChatsByUser.bob,['c2']);
});
test('chat deletion rejects Everyone and inaccessible conversations',()=>{
 for(const hiddenChats of [['c1'],['c2'],['unknown']]){
  const data=visibleData(project,'bob');data.hiddenChats=hiddenChats;
  assert.throws(()=>mergeProjectData(project,members,bob,data));
 }
});
