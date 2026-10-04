const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const sessions = new Map();
const PORT = Number(process.env.PORT || 3210);

function id() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function participant(socket, username) {
  return { id: socket.id, username: username || 'DJ', role: 'GUEST', assignedDeck: 'none', permissions: { deck1:'none', deck2:'none', effects:false, waveform:false, load:false, queue:false, eq:false, filter:false, crossfader:false, channelFader:false, hotcue:false, loop:false, jog:false, masterEffects:false } };
}
function publicSession(s) {
  return { id:s.id, name:s.name, master:s.master, participants:s.participants.map(p => ({id:p.id,username:p.username,role:p.role,assignedDeck:p.assignedDeck,permissions:p.permissions})), state:s.state };
}
function createState(){ return { crossfader:0, decks:{deck1:{play:false,low:0,mid:0,high:0,filter:0},deck2:{play:false,low:0,mid:0,high:0,filter:0}}, queue:[], eventLog:[] }; }
function allowed(p, control) {
  if (p.role === 'MASTER') return true;
  const perms=p.permissions||{};
  if (control === 'crossfader') return !!perms.crossfader;
  if (control.startsWith('deck1.')) return perms.deck1 === 'full' || perms.deck1 === 'control' || (control.endsWith('.low')||control.endsWith('.mid')||control.endsWith('.high')) && !!perms.eq;
  if (control.startsWith('deck2.')) return perms.deck2 === 'full' || perms.deck2 === 'control' || (control.endsWith('.low')||control.endsWith('.mid')||control.endsWith('.high')) && !!perms.eq;
  if (control === 'effects') return !!perms.effects;
  if (control === 'filter') return !!perms.filter;
  if (control === 'queueAdd' || control === 'queueClear') return !!perms.queue;
  return false;
}
function applyEvent(s,e,p) {
  if (e.type === 'control') {
    if (!allowed(p,e.control)) return false;
    if (e.control === 'crossfader') s.state.crossfader=Number(e.value)||0;
    else if (e.control.startsWith('deck1.')) s.state.decks.deck1[e.control.slice(6)]=e.value;
    else if (e.control.startsWith('deck2.')) s.state.decks.deck2[e.control.slice(6)]=e.value;
    s.state.eventLog.unshift(`${new Date().toLocaleTimeString()} — ${p.username} → ${e.control}`);
    s.state.eventLog=s.state.eventLog.slice(0,100); return true;
  }
  if (e.type === 'queueAdd' && allowed(p,'queueAdd')) { s.state.queue.push(e.value); s.state.eventLog.unshift(`${new Date().toLocaleTimeString()} — ${p.username} added ${e.value.artist||'Track'} — ${e.value.title||''}`); return true; }
  if (e.type === 'queueClear' && allowed(p,'queueClear')) { s.state.queue=[]; s.state.eventLog.unshift(`${new Date().toLocaleTimeString()} — ${p.username} cleared the queue`); return true; }
  if (e.type === 'midi') return p.role==='MASTER' || p.permissions.midi !== false;
  return false;
}

function attach(io) {
  io.on('connection', socket => {
    socket.on('createSession',(x,cb)=>{
      const sid=id(); const p=participant(socket,x.username); p.role='MASTER'; p.assignedDeck='both';
      p.permissions={deck1:'full',deck2:'full',effects:true,waveform:true,load:true,queue:true,eq:true,filter:true,crossfader:true,channelFader:true,hotcue:true,loop:true,jog:true,masterEffects:true,midi:true};
      const s={id:sid,name:x.name||'B2B Session',password:x.password||'',master:socket.id,participants:[p],state:createState()}; sessions.set(sid,s); socket.join(sid); cb({ok:true,self:p,session:publicSession(s)}); io.to(sid).emit('session',publicSession(s));
    });
    socket.on('joinSession',(x,cb)=>{
      const s=sessions.get(String(x.id||'').toUpperCase()); if(!s) return cb({ok:false,error:'Session not found.'}); if(s.password && s.password!==x.password) return cb({ok:false,error:'Incorrect password.'});
      const p=participant(socket,x.username); s.participants.push(p); socket.join(s.id); cb({ok:true,self:p,session:publicSession(s)}); io.to(s.id).emit('session',publicSession(s));
    });
    socket.on('event',e=>{
      const s=[...sessions.values()].find(v=>v.participants.some(p=>p.id===socket.id)); if(!s) return;
      const p=s.participants.find(v=>v.id===socket.id); if(!applyEvent(s,e,p)) return socket.emit('denied',{control:e.control||e.type});
      if(e.type==='midi') io.to(s.id).emit('event',{...e,from:p.username}); else io.to(s.id).emit('event',{...e,from:p.username});
      io.to(s.id).emit('session',publicSession(s));
    });
    socket.on('setPermissions',(x,cb)=>{const s=[...sessions.values()].find(v=>v.participants.some(p=>p.id===socket.id)); if(!s||s.master!==socket.id)return; const t=s.participants.find(p=>p.id===x.target); if(!t)return;
      if(x.assignedDeck!==undefined)t.assignedDeck=x.assignedDeck;
      if(x.permissions)t.permissions={...t.permissions,...x.permissions};
      if(x.role)t.role=x.role;
      io.to(s.id).emit('session',publicSession(s)); if(cb)cb({ok:true});
    });
    socket.on('kick',target=>{const s=[...sessions.values()].find(v=>v.participants.some(p=>p.id===socket.id)); if(!s||s.master!==socket.id)return; const t=s.participants.find(p=>p.id===target); if(t){io.to(t.id).emit('kicked'); const idx=s.participants.indexOf(t); if(idx>=0)s.participants.splice(idx,1); io.to(s.id).emit('session',publicSession(s));}});
    socket.on('pingTest,t',()=>{});
    socket.on('pingTest',t=>socket.emit('pongTest',t));
    socket.on('disconnect',()=>{ for(const [sid,s] of sessions){ const idx=s.participants.findIndex(p=>p.id===socket.id); if(idx<0) continue; const wasMaster=s.master===socket.id; s.participants.splice(idx,1); if(!s.participants.length){sessions.delete(sid);continue;} if(wasMaster){ const next=s.participants[0]; s.master=next.id; next.role='MASTER'; next.permissions={deck1:'full',deck2:'full',effects:true,waveform:true,load:true,queue:true,eq:true,filter:true,crossfader:true,channelFader:true,hotcue:true,loop:true,jog:true,masterEffects:true,midi:true}; next.assignedDeck='both'; } io.to(sid).emit('session',publicSession(s)); } });
  });
}
function startServer(port=PORT){return new Promise((resolve,reject)=>{const app=express(); const server=http.createServer(app); const io=new Server(server,{cors:{origin:'*'}}); app.get('/health',(req,res)=>res.json({ok:true,service:'virtual-b2b-dj-relay'})); app.get('/',(req,res)=>res.send('Virtual B2B DJ relay server is running.')); attach(io); server.once('error',reject); server.listen(port,'0.0.0.0',()=>resolve({close:()=>new Promise(r=>server.close(()=>r())),port}));});}
if(require.main===module) startServer().then(x=>console.log(`Virtual B2B DJ relay listening on ${x.port}`)).catch(e=>{console.error(e);process.exit(1)});
module.exports={startServer};
