import { isDeepStrictEqual } from 'node:util';
const same = isDeepStrictEqual;
const fail = () => { const error = new Error('This change is not permitted. Refresh the project and try again.'); error.status = 403; throw error; };
export function visibleData(project, userId) {
  const data = structuredClone(project.data);
  data.conversations = data.conversations.filter(c => c.kind === 'general' || c.members.includes(userId));
  const channels = new Set(data.conversations.map(c => c.id));
  data.messages = data.messages.filter(m => channels.has(m.channel));
  data.files = data.files.filter(f => channels.has(f.channel));
  data.evidence = data.evidence.filter(e => e.status === 'approved' || (project.owner_id === userId && e.status === 'pending') || channels.has(e.channel));
  data.hiddenChats = data.hiddenChatsByUser?.[userId] || [];
  delete data.hiddenChatsByUser;
  // Activities are shared; they must never contain private message/file contents.
  return data;
}
function appendOnly(original, submitted, validate, max) {
  if (!Array.isArray(submitted) || submitted.length > max) fail();
  const seen = new Set();
  for (const item of submitted) {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(item.id) || seen.has(item.id)) fail();
    seen.add(item.id);
    const old = original.find(x => x.id === item.id);
    if (old ? !same(old,item) : !validate(item)) fail();
  }
  if (original.some(item => !seen.has(item.id))) fail();
  return submitted.filter(item => !original.some(old => old.id === item.id));
}
export function mergeProjectData(project, members, user, incoming) {
  if (!incoming || Buffer.byteLength(JSON.stringify(incoming)) > 2_000_000) fail();
  const old = project.data, view = visibleData(project,user.id), next = structuredClone(old);
  const memberIds = new Set(members.map(m=>m.user_id));
  const owner = project.owner_id === user.id;
  const addedChannels = appendOnly(view.conversations, incoming.conversations, c => c.workspace === project.id && ['direct','group'].includes(c.kind)
    && typeof c.name === 'string' && c.name.length <= 100 && Array.isArray(c.members) && c.members.includes(user.id)
    && new Set(c.members).size===c.members.length && c.members.length>=2 && (c.kind!=='direct'||c.members.length===2) && c.members.every(id=>memberIds.has(id)), 200);
  if (addedChannels.some(c=>old.conversations.some(o=>o.id===c.id))) fail();
  next.conversations.push(...addedChannels);
  const hidden = incoming.hiddenChats || [];
  if (!Array.isArray(hidden) || hidden.length > 200 || new Set(hidden).size !== hidden.length || hidden.some(id => !next.conversations.some(c => c.id === id && c.kind !== 'general' && c.members.includes(user.id)))) fail();
  next.hiddenChatsByUser = { ...old.hiddenChatsByUser, [user.id]: hidden };
  const accessible = new Set([...view.conversations,...addedChannels].map(c=>c.id));
  const messages = appendOnly(view.messages,incoming.messages,m=>m.author===user.id && accessible.has(m.channel) && typeof m.text==='string' && m.text.length<=16000,5000);
  if(messages.some(m=>old.messages.some(o=>o.id===m.id))) fail();
  next.messages.push(...messages);
  const files = appendOnly(view.files,incoming.files,f=>f.workspace===project.id && f.addedBy===user.id && accessible.has(f.channel)
    && typeof f.name==='string' && f.name.length<=300 && typeof f.extracted==='string' && f.extracted.length<=16000,500);
  if(files.some(f=>old.files.some(o=>o.id===f.id))) fail();
  next.files.push(...files);
  if(!Array.isArray(incoming.evidence)||incoming.evidence.length>1000) fail();
  const seen=new Set();
  for(const e of incoming.evidence){
    if(!e || typeof e.id!=='string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(e.id) || seen.has(e.id))fail(); seen.add(e.id);
    const previous=old.evidence.find(x=>x.id===e.id);
    if(previous){
      if(!view.evidence.some(x=>x.id===e.id))fail();
      if(!same(previous,e)){
        const allowed={...previous,status:'approved',approvedBy:user.id,approvedAt:e.approvedAt};
        if(!owner || previous.status!=='pending' || !same(allowed,e))fail();
        next.evidence[next.evidence.findIndex(x=>x.id===e.id)]=e;
      }
    }else{
      const source=e.kind==='message'?next.messages.find(m=>m.id===e.source && m.channel===e.channel):next.files.find(f=>f.id===e.source && f.channel===e.channel);
      if(!['message','file'].includes(e.kind) || !source || !accessible.has(e.channel) || e.workspace!==project.id || e.proposedBy!==user.id || e.status!=='pending'
        || typeof e.name!=='string' || e.name.length>300 || typeof e.content!=='string' || e.content.length>16000 || e.approvedBy)fail();
      next.evidence.push(e);
    }
  }
  for(const e of view.evidence)if(!seen.has(e.id)){
    if(!(owner&&e.status==='approved') && !(e.status==='pending'&&e.proposedBy===user.id))fail();
    next.evidence=next.evidence.filter(x=>x.id!==e.id);
  }
  const versions=appendOnly(view.versions,incoming.versions,v=>owner && Number.isInteger(v.number) && v.number>0 && v.number<=100 && typeof v.reason==='string' && v.reason.length<=300 && typeof v.date==='string' && v.date.length<=100 && typeof v.method==='string' && v.method.length<=100 && Array.isArray(v.sections) && v.sections.length<=30
    && v.sections.every(s=>typeof s.id==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(s.id) && typeof s.title==='string' && s.title.length<=200 && typeof s.body==='string' && s.body.length<=50000)
    && Array.isArray(v.evidenceIds) && (v.evidenceIds.every(id=>next.evidence.some(e=>e.id===id&&e.status==='approved')) || (v.method==='Human edit' && old.versions.some(previous=>same(previous.evidenceIds,v.evidenceIds)))),100);
  next.versions.push(...versions);
  // Activity messages are derived server-side, never trusted as an audit record from clients.
  const changes=addedChannels.length+messages.length+files.length+versions.length;
  if(changes || !same(old.evidence,next.evidence)) next.activities.push({workspace:project.id,type:'history',text:`${user.name} updated the project`,when:new Date().toISOString().slice(0,10)});
  next.activities=next.activities.slice(-500);
  next.seq=Math.max(old.seq,Number.isSafeInteger(incoming.seq)&&incoming.seq<1e9?incoming.seq:old.seq);
  if(Buffer.byteLength(JSON.stringify(next))>2_000_000)fail();
  return next;
}
