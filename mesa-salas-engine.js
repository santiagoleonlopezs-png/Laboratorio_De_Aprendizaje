(function(root){
 'use strict';
 const D=root.MESA_DATA||(typeof require==='function'?require('./mesa-acuerdos-data.js'):null),E=root.MESA_ENGINE||(typeof require==='function'?require('./mesa-acuerdos-engine.js'):null);
 const initialPerson=()=>({total:0,metrics:[50,50,50],completed:0});
 const blankRound=round=>({round,offers:{},positions:{},readyClose:{},readyNext:{}});
 function distribute(members){
  if(members.length<3)throw Error('Se requieren al menos tres personas para formar una mesa.');
  const count=Math.floor(members.length/3);if(count>20)throw Error('Esta sala admite hasta veinte mesas.');
  const sizes=Array(count).fill(3);for(let i=0;i<members.length-count*3;i++)sizes[i%count]++;
  let offset=0;return sizes.flatMap((size,i)=>{const list=members.slice(offset,offset+size);offset+=size;return list.map((m,j)=>({uid:m.uid,tableId:'M'+String(i+1).padStart(2,'0'),role:D.roleIds[j<3?j:(i+j)%3]}));});
 }
 function validateAssignments(members,assignments){
  const active=members.filter(m=>m.active),ids=new Set(assignments.map(a=>a.uid));
  if(ids.size!==active.length||assignments.length!==active.length||active.some(m=>!ids.has(m.uid)))throw Error('Asigna una sola mesa y un rol a cada participante activo.');
  const groups={};for(const a of assignments){if(!/^M\d{2}$/.test(a.tableId)||!D.roleIds.includes(a.role))throw Error('Revisa las mesas y los roles de todas las personas.');(groups[a.tableId]??=[]).push(a);}
  for(const [id,list]of Object.entries(groups))if(list.length<3||list.length>5||D.roleIds.some(r=>!list.some(a=>a.role===r)))throw Error(`${id}: necesita entre tres y cinco personas y los tres roles cubiertos.`);
  return groups;
 }
 function posture(table,state,role){
  const ids=table.byRole[role],expected=role==='hr'?'review':'accept',votes={};
  for(const uid of ids){const p=state.positions[uid];if(p?.response===expected&&p.offer?.id){const id=p.offer.id;votes[id]=(votes[id]||0)+1;}}
  const id=Object.keys(votes).find(k=>votes[k]>ids.length/2)||'';
  return {id,supported:id?votes[id]:0,total:ids.length,divided:!id&&ids.some(uid=>state.positions[uid]?.response&&state.positions[uid].response!=='pending')};
 }
 function resolve(table,state){
  const g=posture(table,state,'employer'),s=posture(table,state,'union'),h=posture(table,state,'hr');
  const id=g.id&&g.id===s.id?g.id:'';
  const offer=id?Object.values(state.positions).find(p=>p.offer?.id===id)?.offer:null;
  return {agreed:!!offer,offer:offer||null,reviewed:!!offer&&h.id===id,postures:{employer:g,union:s,hr:h}};
 }
 function allReady(table,state,stage){return table.roster.length>=3&&table.roster.every(uid=>(stage==='close'?state.readyClose:state.readyNext)[uid]===true);}
 function evaluate(table,state,uid,brief){
  const role=table.roles[uid];if(!role)throw Error('No tienes un rol en esta mesa.');
  const resolution=resolve(table,state),own=state.offers[uid],p=state.positions[uid],endorsed=p&&['accept','review'].includes(p.response)?p.offer:null;
  const offers=[own,endorsed].filter(Boolean).filter((o,i,arr)=>arr.findIndex(x=>x.id===o.id)===i);
  const briefs=E.makeBriefs(()=>.5);briefs[role]=brief;
  const result=E.settle({round:table.round,offers,positions:{[role]:p?{...p,offerId:p.offer?.id||''}:null},briefs,shared:table.shared,metrics:{...E.actorInitial(),[role]:table.people[uid].metrics},totals:{[role]:table.people[uid].total},resolution});
  const actor=result.actors[role];
  if(table.byRole[role].length>1)actor.feedback.push(resolution.postures[role].id?'Las personas de tu rol consolidaron un respaldo coincidente. Tu puntaje se calcula con tu propia decisión.':'Tu rol no consolidó un respaldo mayoritario sobre una misma versión. Tu propuesta y tu posición se conservan por separado.');
  return {uid,role,round:table.round,actor,ownOffer:own||null,offer:offers.find(o=>o.id===actor.offerId)||null,position:p||null,agreement:resolution.agreed,agreedOfferId:resolution.offer?.id||'',reviewed:resolution.reviewed,sharedBefore:table.shared,sharedAfter:result.sharedAfter};
 }
 function rank(rows,field='total'){const sorted=rows.map(x=>({...x,score:Math.round(Number(x[field])||0)})).sort((a,b)=>b.score-a.score||String(a.name||a.uid).localeCompare(String(b.name||b.uid),'es'));sorted.forEach((x,i)=>x.position=i&&x.score===sorted[i-1].score?sorted[i-1].position:i+1);return sorted;}
 function tableScore(table){return Math.round(D.roleIds.reduce((sum,r)=>sum+table.byRole[r].reduce((s,uid)=>s+(table.people[uid].total-(table.scoreBaselines?.[uid]||0)),0)/table.byRole[r].length,0)/3);}
 const api={initialPerson,blankRound,distribute,validateAssignments,posture,resolve,allReady,evaluate,rank,tableScore};root.MESA_SALAS_ENGINE=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
