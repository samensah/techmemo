import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/projects-client.js',import.meta.url),'utf8');
const project=(revision=1)=>({id:'p1',revision,members:[{user_id:'a'}],data:{messages:[],seq:0}});
const response=data=>({ok:true,json:async()=>data});
function client(fetch){const window={addEventListener(){},dispatchEvent(){}};vm.runInNewContext(source,{window,fetch,document:{querySelector:()=>null},structuredClone,AbortSignal,CustomEvent:class{}});return window.TechMemoProjects;}
const settle=()=>new Promise(setImmediate);
test('polls return new messages, skip unchanged projects and detect new members without a data revision',async()=>{
 let current=project();
 const cloud=client(async()=>response({projects:[structuredClone(current)]}));
 await cloud.load();assert.equal(await cloud.load({background:true}),null);
 current=project(2);current.data.messages.push({id:'m1',text:'New message'});
 const updated=await cloud.load({background:true});assert.equal(updated[0].data.messages[0].text,'New message');
 current.members.push({user_id:'b'});assert.equal((await cloud.load({background:true}))[0].members.length,2);
});
test('local sends during a background fetch prevent stale state and baseline replacement',async()=>{
 let reads=0,release,putBody;
 const cloud=client(async(_url,options)=>{
  if(options.method==='PUT'){putBody=JSON.parse(options.body);return response({revision:2});}
  reads++;if(reads===1)return response({projects:[project()]});
  return new Promise(resolve=>release=()=>resolve(response({projects:[project(9)]})));
 });
 await cloud.load();const pending=cloud.load({background:true});await settle();
 cloud.save('p1',{messages:[{id:'mine',text:'My message'}],seq:0});await cloud.flush();
 release();assert.equal(await pending,null);assert.equal(putBody.revision,1);
 // A later save uses the accepted local revision, never the stale fetched revision 9.
 cloud.save('p1',{messages:[{id:'mine',text:'My message'},{id:'mine2',text:'Next'}],seq:0});await cloud.flush();assert.equal(putBody.revision,2);
});
test('opening an editor while fetching blocks applying incoming changes and revision changes',async()=>{
 let reads=0,putBody;
 const cloud=client(async(_url,options)=>{if(options.method==='PUT'){putBody=JSON.parse(options.body);return response({revision:2});}return response({projects:[project(++reads)]});});
 await cloud.load();assert.equal(await cloud.load({background:true,canApply:()=>false}),null);
 cloud.save('p1',{messages:[{id:'draft',text:'local'}],seq:0});await cloud.flush();assert.equal(putBody.revision,1);
});
test('failed background reads leave the current revision intact for later saves',async()=>{
 let reads=0,revision;
 const cloud=client(async(_url,options)=>{if(options.method==='PUT'){revision=JSON.parse(options.body).revision;return response({revision:2});}if(++reads>1)throw new Error('network offline');return response({projects:[project()]});});
 await cloud.load();await assert.rejects(cloud.load({background:true}));
 cloud.save('p1',{messages:[{id:'m1',text:'draft'}],seq:0});await cloud.flush();assert.equal(revision,1);
});
