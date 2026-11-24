(function(root){
 'use strict';
 const D=root.MESA_DATA,E=root.MESA_ENGINE,X=root.MESA_SALAS_ENGINE,A=root.MESA_FIREBASE;
 let db;const init=()=>{if(!db){A.init();db=firebase.firestore();}};
 const stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
 const room=code=>{init();return db.collection('mesa_acuerdos_sessions').doc(code);};
 const table=(code,id)=>room(code).collection('tables').doc(id);
 const user=()=>A.user();
 async function exists(code){await A.signed();return (await room(code).get()).exists;}
 async function create(title,mode){
  if(!await A.hostSession())throw Error('Ingresa con tu cuenta de facilitador.');
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let i=0;i<5;i++){
   const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>chars[n%chars.length]).join('');
   const r=room(code),created=await db.runTransaction(async tx=>{
    const [a,b]=await Promise.all([tx.get(r),tx.get(db.collection('mesa_acuerdos_rooms').doc(code))]);if(a.exists||b.exists)return false;
    tx.set(r,{gameId:'mesa-salas-v2',hostUid:user().uid,title,mode,phase:'lobby',tableIds:[],enrollmentRevision:0,createdAt:stamp(),updatedAt:stamp()});return true;
   });if(created)return code;
  }throw Error('No fue posible reservar un código. Vuelve a crear la sala.');
 }
 async function join(code,name){
  const u=await A.signed(),r=room(code),profile=r.collection('attendees').doc(u.uid);
  await db.runTransaction(async tx=>{const [s,p]=await Promise.all([tx.get(r),tx.get(profile)]);if(!s.exists)throw Error('No encontramos esa sala.');if(p.exists){if(!p.data().active)throw Error('Tu acceso fue retirado por el facilitador.');return;}if(s.data().phase!=='lobby')throw Error('La inscripción está cerrada. Consulta al facilitador.');tx.set(profile,{uid:u.uid,name,active:true,role:'',tableId:'',joinedAt:stamp()});tx.update(r,{enrollmentRevision:firebase.firestore.FieldValue.increment(1),updatedAt:stamp()});},{maxAttempts:12});return u.uid;
 }
 async function load(code){if(!await A.hostSession())throw Error('Ingresa con tu cuenta de facilitador.');const s=await room(code).get();if(!s.exists||s.data().hostUid!==user().uid)throw Error('La sala no existe o pertenece a otro facilitador.');return s.data();}
 async function prepare(code,assignments){
  const r=room(code),enrollment=await r.get(),profiles=await r.collection('attendees').get(),members=profiles.docs.map(d=>d.data()).filter(m=>m.active),groups=X.validateAssignments(members,assignments);
  await db.runTransaction(async tx=>{
   const parent=await tx.get(r);if(parent.data()?.enrollmentRevision!==enrollment.data()?.enrollmentRevision)throw Error('La inscripción cambió. Vuelve a organizar las mesas para incluir a todos.');if(!['lobby','ready'].includes(parent.data()?.phase))throw Error('La sala ya comenzó. Reinicia antes de cambiar la asignación.');
   const ids=[...new Set([...(parent.data().tableIds||[]),...Object.keys(groups)])];
   const previous=await Promise.all(ids.map(id=>tx.get(table(code,id))));if(previous.some(s=>s.exists&&s.data().phase!=='lobby'))throw Error('Hay una mesa que ya comenzó. Conserva su asignación.');
   const firstRounds=new Map(await Promise.all(Object.keys(groups).map(async id=>[id,await tx.get(table(code,id).collection('rounds').doc('1'))])));
   if([...firstRounds.values()].some(s=>s.exists&&(s.data().round!==1||['offers','positions','readyClose','readyNext'].some(k=>Object.keys(s.data()[k]||{}).length))))throw Error('Hay una ronda con actividad registrada. Conserva la asignación o reinicia la experiencia de forma explícita.');
   const snapshots=await Promise.all(members.map(m=>tx.get(r.collection('attendees').doc(m.uid))));if(snapshots.some(s=>!s.data()?.active))throw Error('La inscripción cambió. Actualiza antes de organizar las mesas.');
   for(const [id,list]of Object.entries(groups)){
    const roster=list.map(a=>a.uid),roles=Object.fromEntries(list.map(a=>[a.uid,a.role])),names=Object.fromEntries(roster.map(uid=>[uid,members.find(m=>m.uid===uid).name])),byRole=Object.fromEntries(D.roleIds.map(role=>[role,roster.filter(uid=>roles[uid]===role)]));
    const t=table(code,id);tx.set(t,{tableId:id,sessionCode:code,title:'Mesa '+Number(id.slice(1)),phase:'lobby',round:1,roster,roles,names,byRole,people:Object.fromEntries(roster.map(uid=>[uid,X.initialPerson()])),shared:E.initial(),roundStartedAt:null,updatedAt:stamp()});
    if(!firstRounds.get(id).exists)tx.set(t.collection('rounds').doc('1'),{...X.blankRound(1),updatedAt:stamp()});
    const sets=Array.from({length:6},()=>E.makeBriefs(()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296));
    for(const role of D.roleIds)tx.set(t.collection('briefings').doc(role),{role,rounds:sets.map(s=>s[role])});
    for(const a of list)tx.update(r.collection('attendees').doc(a.uid),{role:a.role,tableId:id});
   }
   tx.update(r,{phase:'ready',tableIds:Object.keys(groups).sort(),updatedAt:stamp()});
  });
 }
 async function createLateTable(code,assignments){
  if(!await A.hostSession())throw Error('Ingresa con tu cuenta de facilitador.');
  if(!Array.isArray(assignments)||assignments.length!==3||new Set(assignments.map(a=>a.uid)).size!==3||D.roleIds.some(role=>assignments.filter(a=>a.role===role).length!==1))throw Error('Selecciona tres personas distintas y los tres roles.');
  const r=room(code);
  return db.runTransaction(async tx=>{
   const p=(await tx.get(r)).data();
   if(!p||p.hostUid!==user().uid||p.mode!=='guided'||p.phase==='resetting'||p.phase==='lobby')throw Error('Esta función está disponible en salas dirigidas entre rondas.');
   const oldIds=p.tableIds||[],old=await Promise.all(oldIds.map(id=>tx.get(table(code,id)))),ts=old.map(s=>s.data());
   if(!ts.length||ts.some(t=>!t||t.phase!=='review'||t.round!==ts[0].round||t.round>=6))throw Error('Cierra todas las mesas en la misma ronda antes de crear otra.');
   if(oldIds.length>=20)throw Error('La sala admite hasta veinte mesas.');
   let number=1;while(oldIds.includes('M'+String(number).padStart(2,'0')))number++;
   const id='M'+String(number).padStart(2,'0'),target=table(code,id),unused=await tx.get(target);
   if(unused.exists)throw Error('El identificador de mesa ya existe. No se sobrescribió información.');
   const members=await Promise.all(assignments.map(a=>tx.get(r.collection('attendees').doc(a.uid))));
   const moved={},roster=[],roles={},names={},people={},startedRounds={},scoreBaselines={},startRound=ts[0].round+1;
   for(let i=0;i<assignments.length;i++){
    const {uid,role}=assignments[i],m=members[i].data();
    if(!m?.active||m.uid!==uid)throw Error('Una persona ya no está disponible.');
    roster.push(uid);roles[uid]=role;names[uid]=m.name;
    if(m.tableId){
     const a=ts.find(t=>t.tableId===m.tableId);
     if(!a||!a.roster.includes(uid)||a.roles[uid]!==role||m.role!==role)throw Error('La persona trasladada debe conservar su rol actual.');
     (moved[m.tableId]??=[]).push(uid);
     people[uid]=a.people[uid];startedRounds[uid]=a.startedRounds?.[uid]||1;scoreBaselines[uid]=a.people[uid].total;
    }else{
     if(m.role)throw Error('La inscripción pendiente tiene un rol inconsistente.');
     people[uid]=X.initialPerson();startedRounds[uid]=startRound;scoreBaselines[uid]=0;
    }
   }
   for(const [from,ids] of Object.entries(moved)){
    const a=ts.find(t=>t.tableId===from),remaining=a.roster.filter(uid=>!ids.includes(uid)),byRole=Object.fromEntries(D.roleIds.map(role=>[role,a.byRole[role].filter(uid=>!ids.includes(uid))]));
    if(remaining.length<3||D.roleIds.some(role=>!byRole[role].length))throw Error('La mesa de origen debe conservar al menos tres personas y los tres roles.');
    // Preserve historical names, roles and scores for the facilitator's existing reports.
    tx.update(table(code,from),{roster:remaining,byRole,updatedAt:stamp()});
   }
   const byRole=Object.fromEntries(D.roleIds.map(role=>[role,roster.filter(uid=>roles[uid]===role)]));
   // Existing security rules require creation in lobby, round 1. Host opens the actual startRound.
   tx.set(target,{tableId:id,sessionCode:code,title:'Mesa '+number,phase:'lobby',round:1,startRound,roster,roles,names,byRole,people,startedRounds,scoreBaselines,shared:E.initial(),roundStartedAt:null,updatedAt:stamp()});
   const sets=Array.from({length:6},()=>E.makeBriefs(()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296));
   for(const role of D.roleIds)tx.set(target.collection('briefings').doc(role),{role,rounds:sets.map(s=>s[role])});
   for(const {uid,role} of assignments)tx.update(r.collection('attendees').doc(uid),{tableId:id,role});
   tx.update(r,{tableIds:[...oldIds,id].sort(),updatedAt:stamp()});
   return id;
  });
 }
 async function assignLate(code,uid,id,role){
  if(!await A.hostSession())throw Error('Ingresa con tu cuenta de facilitador.');
  if(!D.roleIds.includes(role))throw Error('Selecciona un rol válido.');
  const r=room(code),t=table(code,id),member=r.collection('attendees').doc(uid);
  await db.runTransaction(async tx=>{
   const [ps,ts,ms]=await Promise.all([tx.get(r),tx.get(t),tx.get(member)]);
   const p=ps.data(),a=ts.data(),m=ms.data();
   if(!p||p.hostUid!==user().uid||!p.tableIds.includes(id))throw Error('Selecciona una mesa existente de tu sala.');
   if(!a||a.phase!=='review'||a.round>=6)throw Error('La mesa debe estar entre rondas. Espera el cierre y asigna antes de avanzar.');
   if(!m?.active||m.uid!==uid||m.tableId||m.role||a.roster.includes(uid))throw Error('La persona ya no está pendiente de asignación.');
   if(a.roster.length>=5)throw Error('La mesa ya tiene cinco participantes.');
   tx.update(t,{roster:[...a.roster,uid],roles:{...a.roles,[uid]:role},names:{...a.names,[uid]:m.name},byRole:{...a.byRole,[role]:[...a.byRole[role],uid]},people:{...a.people,[uid]:X.initialPerson()},startedRounds:{...(a.startedRounds||{}),[uid]:a.round+1},updatedAt:stamp()});
   tx.update(member,{tableId:id,role});
  });
 }
 async function reopenEnrollment(code){
  const r=room(code);await db.runTransaction(async tx=>{const p=await tx.get(r),ts=await Promise.all(p.data().tableIds.map(id=>tx.get(table(code,id))));if(ts.some(t=>t.data()?.phase!=='lobby'))throw Error('Una mesa ya comenzó. La inscripción permanece cerrada.');tx.update(r,{phase:'lobby',updatedAt:stamp()});});
 }
 async function remove(code,uid){
  const r=room(code);await db.runTransaction(async tx=>{const p=await tx.get(r),ts=await Promise.all(p.data().tableIds.map(id=>tx.get(table(code,id))));if(ts.some(t=>t.data()?.phase!=='lobby'))throw Error('Durante la partida se conserva el registro de las personas. Puedes cerrar una ronda con respuestas faltantes.');tx.update(r.collection('attendees').doc(uid),{active:false});tx.update(r,{phase:'lobby',updatedAt:stamp()});});
 }
 async function open(code,id){
  const t=table(code,id);await db.runTransaction(async tx=>{
   const [p,s]=await Promise.all([tx.get(room(code)),tx.get(t)]);const a=s.data();if(p.data()?.phase==='lobby')throw Error('El facilitador debe guardar la organización de las mesas.');if(!a||!['lobby','review'].includes(a.phase))throw Error('La mesa no está lista para avanzar.');
   const n=a.phase==='lobby'?(a.startRound||1):a.round+1;if(n>6)throw Error('La mesa ya terminó.');const next=t.collection('rounds').doc(String(n)),existing=await tx.get(next);
   if(!existing.exists)tx.set(next,{...X.blankRound(n),updatedAt:stamp()});tx.update(t,{phase:'negotiating',round:n,roundStartedAt:stamp(),updatedAt:stamp()});
  });
 }
 async function openAll(code){
  const p=(await room(code).get()).data(),tables=await Promise.all(p.tableIds.map(id=>table(code,id).get()));
  if(!tables.length||tables.some(t=>!['lobby','review','negotiating'].includes(t.data().phase)))throw Error('Cierra y conversa sobre todas las mesas antes de avanzar.');
  const targets=tables.map(t=>t.data().phase==='lobby'?(t.data().startRound||1):t.data().round+(t.data().phase==='review'?1:0));
  if(new Set(targets).size!==1)throw Error('Las mesas están en rondas diferentes. Revisa cada mesa antes de avanzar.');
  for(const t of tables)if(t.data().phase!=='negotiating')await open(code,t.id);
 }
 async function offer(code,id,values){
  const u=await A.signed(),t=table(code,id);await db.runTransaction(async tx=>{
   const a=(await tx.get(t)).data(),ref=t.collection('rounds').doc(String(a.round)),s=await tx.get(ref),state=s.data();
   if(a.phase!=='negotiating'||!a.roster.includes(u.uid)||state.readyClose[u.uid])throw Error('La ronda está cerrada para tu participación.');
   const revision=(state.offers[u.uid]?.revision||0)+1;if(revision>20)throw Error('Se alcanzó el límite de veinte versiones por persona.');
   const o={...values,uid:u.uid,role:a.roles[u.uid],round:a.round,revision,id:`${a.round}_${u.uid}_${revision}`};if(!E.validOffer(o,a.round))throw Error('Completa la propuesta y verifica el reparto de créditos.');
   tx.set(t.collection('history').doc(o.id),{...o,createdAt:stamp()});tx.update(ref,{offers:{...state.offers,[u.uid]:o},updatedAt:stamp()});
  });
 }
 async function position(code,id,offerId,response,reason){
  const u=await A.signed(),t=table(code,id);await db.runTransaction(async tx=>{
   const [a,o]=await Promise.all([tx.get(t),tx.get(t.collection('history').doc(offerId))]);const v=a.data();if(v.phase!=='negotiating'||!o.exists)throw Error('La propuesta ya no está disponible para esta ronda.');const ref=t.collection('rounds').doc(String(v.round)),s=await tx.get(ref),state=s.data();
   const {createdAt,...snapshot}=o.data();if(snapshot.round!==v.round||state.readyClose[u.uid])throw Error('La ronda está cerrada para tu participación.');
   tx.update(ref,{positions:{...state.positions,[u.uid]:{uid:u.uid,role:v.roles[u.uid],round:v.round,response,reason,offer:snapshot}},updatedAt:stamp()});
  });
 }
 async function ready(code,id,stage,value){
  const u=await A.signed(),t=table(code,id);await db.runTransaction(async tx=>{const a=(await tx.get(t)).data(),ref=t.collection('rounds').doc(String(a.round)),s=(await tx.get(ref)).data();const field=stage==='next'?'readyNext':'readyClose';tx.update(ref,{[field]:{...s[field],[u.uid]:value},updatedAt:stamp()});});
 }
 async function freeze(code,id){const t=table(code,id);await db.runTransaction(async tx=>{const a=(await tx.get(t)).data();if(a.phase==='settling')return;if(a.phase!=='negotiating')throw Error('La mesa ya no está negociando.');tx.update(t,{phase:'settling',updatedAt:stamp()});});}
 async function publishOwn(code,id){
  const u=await A.signed(),t=table(code,id),a=(await t.get()).data();if(a.phase!=='settling'||!a.roster.includes(u.uid))return;
  const key=`${a.round}_${u.uid}`,target=t.collection('personalResults').doc(key);if((await target.get()).exists)return;
  const [s,b]=await Promise.all([t.collection('rounds').doc(String(a.round)).get(),t.collection('briefings').doc(a.roles[u.uid]).get()]);
  const result=X.evaluate(a,s.data(),u.uid,b.data().rounds[a.round-1]),actor=result.actor;
  const proof=t.collection('pointProofs').doc(key);if(!(await proof.get()).exists)await proof.set({uid:u.uid,round:a.round,role:a.roles[u.uid],points:actor.points,total:actor.total,breakdown:actor.breakdown,penalty:actor.penalty,offerId:actor.offerId,createdAt:stamp()});
  const effects=t.collection('effectProofs').doc(key);if(!(await effects.get()).exists)await effects.set({uid:u.uid,round:a.round,before:actor.before,metrics:actor.metrics,createdAt:stamp()});
  const resolution=t.collection('resolutionProofs').doc(String(a.round));await db.runTransaction(async tx=>{if(!(await tx.get(resolution)).exists)tx.set(resolution,{round:a.round,agreement:result.agreement,agreedOfferId:result.agreedOfferId,reviewed:result.reviewed,sharedBefore:result.sharedBefore,sharedAfter:result.sharedAfter,createdAt:stamp()});});
  await target.set({...result,createdAt:stamp()});
 }
 async function consolidate(code,id){
  const t=table(code,id),a=(await t.get()).data();if(a.phase!=='settling')return;const docs=await Promise.all(a.roster.map(uid=>t.collection('personalResults').doc(`${a.round}_${uid}`).get()));if(docs.some(d=>!d.exists))return;
  const people=Object.fromEntries(docs.map(d=>[d.data().uid,d.data().actor])),first=docs[0].data(),result={round:a.round,people,agreement:first.agreement,agreedOfferId:first.agreedOfferId,reviewed:first.reviewed,sharedBefore:first.sharedBefore,sharedAfter:first.sharedAfter,createdAt:stamp()};
  await db.runTransaction(async tx=>{const current=await tx.get(t),old=await tx.get(t.collection('results').doc(String(a.round)));if(old.exists||current.data().phase!=='settling')return;
   tx.set(t.collection('results').doc(String(a.round)),result);tx.update(t,{phase:a.round===6?'finished':'review',people:Object.fromEntries(a.roster.map(uid=>[uid,{total:people[uid].total,metrics:people[uid].metrics,completed:a.round}])),shared:first.sharedAfter,updatedAt:stamp()});
  });
 }
 async function close(code,id){
  await freeze(code,id);const t=table(code,id),a=(await t.get()).data(),[s,bs]=await Promise.all([t.collection('rounds').doc(String(a.round)).get(),t.collection('briefings').get()]);const b=Object.fromEntries(bs.docs.map(d=>[d.id,d.data()]));
  for(const uid of a.roster){const target=t.collection('personalResults').doc(`${a.round}_${uid}`);if(!(await target.get()).exists)await target.set({...X.evaluate(a,s.data(),uid,b[a.roles[uid]].rounds[a.round-1]),createdAt:stamp()});}
  await consolidate(code,id);
 }
 async function closeAll(code){const p=(await room(code).get()).data();for(const id of p.tableIds){const a=(await table(code,id).get()).data();if(['negotiating','settling'].includes(a.phase))await close(code,id);}}
 async function reset(code){
  const r=room(code),p=(await r.get()).data();await r.update({phase:'resetting',updatedAt:stamp()});
  for(const id of p.tableIds){const t=table(code,id);await t.update({phase:'resetting',updatedAt:stamp()});for(const name of ['rounds','history','personalResults','results','pointProofs','effectProofs','resolutionProofs'])for(;;){const rows=await t.collection(name).limit(150).get();if(rows.empty)break;const batch=db.batch();rows.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}
   const a=(await t.get()).data(),batch=db.batch();batch.set(t.collection('rounds').doc('1'),{...X.blankRound(1),updatedAt:stamp()});batch.update(t,{phase:'lobby',round:1,people:Object.fromEntries(a.roster.map(uid=>[uid,X.initialPerson()])),shared:E.initial(),startedRounds:{},scoreBaselines:{},startRound:1,roundStartedAt:null,updatedAt:stamp()});await batch.commit();
  }await r.update({phase:'ready',updatedAt:stamp()});
 }
 function watch(code,handlers){
  const r=room(code),rows=s=>s.docs.map(d=>({...d.data(),id:d.id}));
  const stops=[r.onSnapshot(s=>handlers.session(s.data()),handlers.error),r.collection('attendees').onSnapshot(s=>handlers.members(rows(s)),handlers.error),r.collection('tables').onSnapshot(s=>handlers.tables(rows(s)),handlers.error)];return ()=>stops.forEach(f=>f());
 }
 function watchTable(code,id,host,uid,handlers){
  const t=table(code,id),stops=[];let round=0,role='',roundStops=[],briefStop=null;
  stops.push(t.onSnapshot(s=>{const a=s.data();if(!a)return;handlers.table(a);if(a.round!==round){round=a.round;roundStops.forEach(f=>f());handlers.state(null);handlers.history([]);roundStops=[t.collection('rounds').doc(String(round)).onSnapshot(s=>handlers.state(s.data()),handlers.error),t.collection('history').where('round','==',round).onSnapshot(s=>handlers.history(s.docs.map(d=>({...d.data(),id:d.id}))),handlers.error)];}
   if(!host&&role!==a.roles[uid]){role=a.roles[uid];if(briefStop)briefStop();handlers.briefs({});if(role)briefStop=t.collection('briefings').doc(role).onSnapshot(s=>handlers.briefs({[role]:s.data()}),handlers.error);}
  },handlers.error));
  stops.push(t.collection('personalResults').onSnapshot(s=>handlers.personal(s.docs.map(d=>d.data())),handlers.error));stops.push(t.collection('results').onSnapshot(s=>handlers.results(s.docs.map(d=>d.data()).sort((a,b)=>a.round-b.round)),handlers.error));
  if(host)stops.push(t.collection('briefings').onSnapshot(s=>handlers.briefs(Object.fromEntries(s.docs.map(d=>[d.id,d.data()]))),handlers.error));return ()=>{stops.forEach(f=>f());roundStops.forEach(f=>f());if(briefStop)briefStop();};
 }
 async function report(code){const p=(await room(code).get()).data();const data=[];for(const id of p.tableIds){const t=table(code,id),a=(await t.get()).data(),rows=await t.collection('personalResults').get();data.push({table:a,rows:rows.docs.map(d=>d.data())});}return data;}
 root.MESA_SALAS={create,join,exists,load,prepare,assignLate,createLateTable,reopenEnrollment,remove,open,openAll,offer,position,ready,freeze,publishOwn,consolidate,close,closeAll,reset,watch,watchTable,report};
})(window);
