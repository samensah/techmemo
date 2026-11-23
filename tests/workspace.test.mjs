import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/app.js',import.meta.url),'utf8');
const account={id:'alice',name:'Alice Adams',email:'alice@example.com',provider:'google'};
async function boot({user=account,projects=[]}={}){
 const listeners={},app={innerHTML:''},toast={textContent:'',classList:{add(){},remove(){}}};let redirect,saved=[];
 const document={querySelector:s=>s==='#app'?app:s==='#toast'?toast:null,addEventListener:(type,fn)=>listeners[type]=fn};
 const cloud={status:'Saved',load:async()=>projects,save:(id,data)=>saved.push({id,data}),accept:async()=>{},flush:async()=>{}};
 const location={search:'',replace:url=>redirect=url};
 vm.runInNewContext(source,{crypto:webcrypto,document,location,window:{TechMemoProjects:cloud,matchMedia:()=>({matches:false}),addEventListener(){},dispatchEvent(){}},sessionStorage:{getItem(){return null}},fetch:async()=>({json:async()=>({user})}),Event:class {},setTimeout:()=>1,clearTimeout(){},AbortController,URLSearchParams,console});
 await new Promise(setImmediate);await new Promise(setImmediate);
 return {app,redirect:()=>redirect,saved,click:async(action,id)=>{listeners.click({target:{closest:s=>s==='[data-action]'?{dataset:{action,id}}:null},preventDefault(){}});await new Promise(setImmediate);}};
}
test('new signed-in account gets empty personal workspace, with no demo organization or seeded project',async()=>{
 const page=await boot();
 assert.match(page.app.innerHTML,/Your workspace is ready/);assert.match(page.app.innerHTML,/Alice/);
 for(const unwanted of ['Northstar','Harbor','Ava Morgan','Revenue recognition review','Accounting workspace','data-action="personas"'])assert(!page.app.innerHTML.includes(unwanted),unwanted);
 assert.match(page.app.innerHTML,/class="brandmark">tm<span>▪/);
 assert.equal(page.saved.length,0);
});
test('signed-out visitors are redirected to login without demo content',async()=>{
 const page=await boot({user:null});assert.equal(page.redirect(),'/#login');assert(!page.app.innerHTML.includes('Northstar'));
});
test('only server-returned projects render; real member identity opens the accounting issue',async()=>{
 const project={id:'p1',name:'My lease review',standard:'IFRS 16',period:'FY 2026',description:'Analyze the lease',owner_id:'alice',members:[{user_id:'alice',name:'Alice Adams',email:'alice@example.com'}],data:{conversations:[{id:'c1',workspace:'p1',kind:'general',name:'General',members:[]}],messages:[],evidence:[],files:[],versions:[],activities:[],seq:0}};
 const page=await boot({projects:[project]});assert.match(page.app.innerHTML,/My lease review/);
 await page.click('workspace','p1');assert.match(page.app.innerHTML,/Generate first draft/);assert.match(page.app.innerHTML,/Analyze the lease/);
});

test('member-name chat opens a direct conversation without inserting the project owner',async()=>{
 const project={id:'p1',name:'Lease review',standard:'IFRS 16',period:'FY 2026',description:'Lease',owner_id:'owner',members:[{user_id:'owner',name:'Project Owner',email:'owner@example.com'},{user_id:'alice',name:account.name,email:account.email},{user_id:'bob',name:'Bob Brown',email:'bob@example.com'}],data:{conversations:[{id:'c1',workspace:'p1',kind:'general',name:'General',members:[]}],messages:[],files:[],evidence:[],versions:[],activities:[],seq:0}};
 const page=await boot({projects:[project]});await page.click('workspace','p1');
 assert.match(page.app.innerHTML,/Bob Brown/);assert.match(page.app.innerHTML,/New group/);
 assert(!page.app.innerHTML.includes('Private groups'));assert(!page.app.innerHTML.includes('Shared channel'));
 await page.click('create-direct','bob');
 const direct=page.saved.at(-1).data.conversations.find(c=>c.kind==='direct');
 assert.deepEqual(Array.from(direct.members),['alice','bob']);
 assert.match(page.app.innerHTML,/aria-label="Delete chat"/);
 await page.click('delete-chat',direct.id);assert.match(page.app.innerHTML,/Other participants keep their conversation history/);
 await page.click('confirm-delete-chat');assert.deepEqual(Array.from(page.saved.at(-1).data.hiddenChats),[direct.id]);
 await page.click('create-direct','bob');assert.deepEqual(Array.from(page.saved.at(-1).data.hiddenChats),[]);
});
