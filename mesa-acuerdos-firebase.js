(function(root){
 'use strict';
 const D=root.MESA_DATA,E=root.MESA_ENGINE,ROOT='mesa_acuerdos_rooms';
 let auth,db;
 function init(){
  if(db)return;
  if(!root.firebase||!root.FIREBASE_CONFIG?.projectId)throw Error('No se cargó la conexión del Laboratorio. Actualiza la página y verifica tu red.');
  const app=firebase.apps.length?firebase.app():firebase.initializeApp(root.FIREBASE_CONFIG);
  auth=firebase.auth(app);db=firebase.firestore(app);
 }
 const stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
 const ref=code=>db.collection(ROOT).doc(code);
 async function restored(){init();await new Promise(resolve=>{const stop=auth.onAuthStateChanged(()=>{stop();resolve();});});}
 async function signed(){await restored();if(!auth.currentUser)await auth.signInAnonymously();return auth.currentUser;}
 async function hostLogin(email,password){init();await auth.signInWithEmailAndPassword(email,password);const token=await auth.currentUser.getIdTokenResult(true);if(token.claims.facilitator!==true)throw Error('Esta cuenta necesita el rol de facilitador del Laboratorio.');return auth.currentUser;}
 async function hostSession(){await restored();if(!auth.currentUser||auth.currentUser.isAnonymous)return false;const token=await auth.currentUser.getIdTokenResult();return token.claims.facilitator===true;}
 async function logout(){init();await auth.signOut();}
 function randomCode(){const bytes=crypto.getRandomValues(new Uint8Array(6)),chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(bytes,n=>chars[n%chars.length]).join('');}
 function random(){return crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;}
 async function create(title,mode='guided'){
  if(!await hostSession())throw Error('Ingresa con una cuenta de facilitador.');
  const uid=auth.currentUser.uid;
  for(let i=0;i<5;i++){
   const code=randomCode(),r=ref(code),sets=Array.from({length:6},()=>E.makeBriefs(random));
   const created=await db.runTransaction(async tx=>{
    if((await tx.get(r)).exists)return false;
    tx.set(r,{gameId:'mesa-acuerdos-v1',hostUid:uid,title,mode,phase:'lobby',round:1,totals:{employer:0,union:0,hr:0},metrics:E.actorInitial(),shared:E.initial(),createdAt:stamp(),updatedAt:stamp(),roundStartedAt:null});
    for(const role of D.roleIds){tx.set(r.collection('seats').doc(role),{role,uid:''});tx.set(r.collection('briefings').doc(role),{role,rounds:sets.map(x=>x[role])});}
    return true;
   });if(created)return code;
  }throw Error('No se pudo reservar un código. Vuelve a crear la sala.');
 }
 async function join(code,name){
  const user=await signed(),r=ref(code),m=r.collection('members').doc(user.uid);
  await db.runTransaction(async tx=>{
   const room=await tx.get(r),member=await tx.get(m);
   if(!room.exists)throw Error('No encontramos esa sala. Revisa el código.');
   if(member.exists){if(!member.data().active)throw Error('El facilitador retiró tu acceso a esta sala.');return;}
   if(room.data().phase!=='lobby')throw Error('La simulación ya comenzó. Puedes ingresar si ya estabas inscrito desde este navegador.');
   tx.set(m,{uid:user.uid,name,role:'',active:true,joinedAt:stamp()});
  });return user.uid;
 }
 async function loadHost(code){
  if(!await hostSession())throw Error('Ingresa con una cuenta de facilitador.');
  const s=await ref(code).get();if(!s.exists)throw Error('No encontramos esa sala.');if(s.data().hostUid!==auth.currentUser.uid)throw Error('La sala pertenece a otro facilitador.');return s.data();
 }
 async function assign(code,assignments){
  const r=ref(code);await db.runTransaction(async tx=>{
   const room=await tx.get(r);if(room.data()?.phase!=='lobby')throw Error('Los roles se asignan antes de comenzar.');
   const docs=await Promise.all(assignments.map(a=>tx.get(r.collection('members').doc(a.uid))));
   assignments.forEach((a,i)=>{if(!docs[i].exists||!docs[i].data().active)throw Error('Un participante ya no está disponible.');});
   assignments.forEach(a=>tx.update(r.collection('members').doc(a.uid),{role:a.role}));
   D.roleIds.forEach(role=>tx.set(r.collection('seats').doc(role),{role,uid:assignments.find(a=>a.role===role)?.uid||''}));
   tx.update(r,{updatedAt:stamp()});
  });
 }
 async function remove(code,uid){
  const r=ref(code),members=await r.collection('members').get();
  await db.runTransaction(async tx=>{
   const room=await tx.get(r),seats=await Promise.all(D.roleIds.map(role=>tx.get(r.collection('seats').doc(role))));
   if(!room.exists)throw Error('La sala ya no existe.');
   tx.update(r.collection('members').doc(uid),{active:false});
   D.roleIds.forEach((role,i)=>{if(seats[i].data()?.uid===uid){const next=members.docs.find(d=>d.id!==uid&&d.data().active&&d.data().role===role);tx.update(r.collection('seats').doc(role),{uid:next?.id||''});}});
  });
 }
 async function spokesperson(code,role,uid){const r=ref(code);await db.runTransaction(async tx=>{const m=await tx.get(r.collection('members').doc(uid));if(!m.exists||!m.data().active||m.data().role!==role)throw Error('Selecciona una persona activa del actor.');tx.update(r.collection('seats').doc(role),{uid});});}
 async function openRound(code){
  const r=ref(code);await db.runTransaction(async tx=>{
   const s=await tx.get(r),room=s.data();if(!room||!['lobby','review'].includes(room.phase))throw Error('La ronda no está lista para abrirse.');
   const seats=await Promise.all(D.roleIds.map(role=>tx.get(r.collection('seats').doc(role))));
   const ids=seats.map(s=>s.data()?.uid||'');if(new Set(ids).size!==3||ids.some(x=>!x))throw Error('Se requieren tres personas distintas y los tres actores cubiertos.');
   const members=await Promise.all(ids.map(uid=>tx.get(r.collection('members').doc(uid))));
   if(members.some((m,i)=>!m.exists||!m.data().active||m.data().role!==D.roleIds[i]))throw Error('Revisa los portavoces y los roles antes de iniciar.');
   const round=room.phase==='lobby'?1:room.round+1;if(round>6)throw Error('Las seis rondas ya terminaron.');
   tx.update(r,{round,phase:'negotiating',roundStartedAt:stamp(),updatedAt:stamp()});
  });
 }
 async function offer(code,values){
  const user=await signed(),r=ref(code),id=`${values.round}_${values.role}_${values.revision}`;
  await db.runTransaction(async tx=>{
   const [room,seat,existing]=await Promise.all([tx.get(r),tx.get(r.collection('seats').doc(values.role)),tx.get(r.collection('offers').doc(id))]);
   if(room.data()?.phase!=='negotiating'||room.data()?.round!==values.round)throw Error('La ronda ya no está abierta.');
   if(seat.data()?.uid!==user.uid)throw Error('Solo el portavoz de tu actor puede registrar la propuesta.');
   if(existing.exists)throw Error('Se recibió otra versión. Espera la actualización y vuelve a enviar.');
   if(!E.validOffer(values,values.round))throw Error('Completa una propuesta válida antes de enviarla.');
   tx.set(r.collection('offers').doc(id),{...values,uid:user.uid,createdAt:stamp()});
   tx.set(r.collection('cursors').doc(`${values.round}_${values.role}`),{uid:user.uid,role:values.role,round:values.round,revision:values.revision,offerId:id});
  });return id;
 }
 async function position(code,values){
  const user=await signed(),r=ref(code);await db.runTransaction(async tx=>{
   const [room,seat]=await Promise.all([tx.get(r),tx.get(r.collection('seats').doc(values.role))]);
   if(room.data()?.phase!=='negotiating'||room.data()?.round!==values.round)throw Error('La ronda ya no está abierta.');
   if(seat.data()?.uid!==user.uid)throw Error('Solo el portavoz puede confirmar la posición de su actor.');
   if(values.offerId){const o=await tx.get(r.collection('offers').doc(values.offerId));if(!o.exists||o.data().round!==values.round)throw Error('La propuesta no corresponde a esta ronda.');}
   tx.set(r.collection('positions').doc(`${values.round}_${values.role}`),{...values,uid:user.uid,updatedAt:stamp()});
  });
 }
 async function closeRound(code){
  const r=ref(code);await db.runTransaction(async tx=>{
   const s=await tx.get(r);if(!s.exists||!['negotiating','settling'].includes(s.data().phase))throw Error('No hay una ronda abierta para cerrar.');
   if(s.data().phase==='negotiating')tx.update(r,{phase:'settling',updatedAt:stamp()});
  });
  const room=(await r.get()).data(),round=room.round;
  const [offers,positions,briefings]=await Promise.all([r.collection('offers').where('round','==',round).get(),r.collection('positions').where('round','==',round).get(),r.collection('briefings').get()]);
  const os=offers.docs.map(d=>({...d.data(),id:d.id})),ps=Object.fromEntries(positions.docs.map(d=>[d.data().role,d.data()])),bs=Object.fromEntries(briefings.docs.map(d=>[d.id,d.data().rounds[round-1]]));
  const result=E.settle({round,offers:os,positions:ps,briefs:bs,shared:room.shared,metrics:room.metrics,totals:room.totals});
  result.positions=ps;result.offers=Object.fromEntries(D.roleIds.map(role=>[role,os.find(o=>o.id===result.actors[role].offerId)||null]));
  await db.runTransaction(async tx=>{
   const fresh=await tx.get(r),previous=await tx.get(r.collection('results').doc(String(round)));
   if(previous.exists)return;
   if(fresh.data()?.phase!=='settling'||fresh.data()?.round!==round)throw Error('El estado de la sala cambió. Recarga antes de continuar.');
   tx.set(r.collection('results').doc(String(round)),{...result,settledAt:stamp()});
   tx.update(r,{phase:round===6?'finished':'review',totals:Object.fromEntries(D.roleIds.map(role=>[role,result.actors[role].total])),metrics:Object.fromEntries(D.roleIds.map(role=>[role,result.actors[role].metrics])),shared:result.sharedAfter,updatedAt:stamp()});
  });return result;
 }
 async function reset(code){
  const r=ref(code);await r.update({phase:'resetting',updatedAt:stamp()});
  for(const collection of ['offers','positions','results','cursors','readiness','scorechecks','effects','evaluations']){
   for(;;){const s=await r.collection(collection).limit(200).get();if(s.empty)break;const batch=db.batch();s.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}
  }
  await r.update({phase:'lobby',round:1,totals:{employer:0,union:0,hr:0},metrics:E.actorInitial(),shared:E.initial(),roundStartedAt:null,updatedAt:stamp()});
 }
 function subscribe(code,isHost,handlers){
  init();const r=ref(code),stops=[];let round=-1,roundStops=[],briefStop=null,briefRole=null;
  const error=e=>handlers.error(e);
  const rows=s=>s.docs.map(d=>({...d.data(),id:d.id}));
  const brief=role=>{if(isHost||role===briefRole)return;briefRole=role;if(briefStop)briefStop();handlers.briefs({});if(role)briefStop=r.collection('briefings').doc(role).onSnapshot(s=>{if(s.exists)handlers.briefs({[role]:s.data()});},error);};
  stops.push(r.onSnapshot({includeMetadataChanges:true},s=>{
   if(!s.exists){error(Error('La sala ya no está disponible.'));return;}
   const room=s.data();handlers.network(s.metadata.fromCache);handlers.room(room);
   if(room.round!==round){round=room.round;roundStops.forEach(f=>f());handlers.offers([]);handlers.positions({});
    roundStops=[r.collection('offers').where('round','==',round).onSnapshot(s=>handlers.offers(rows(s)),error),r.collection('positions').where('round','==',round).onSnapshot(s=>handlers.positions(Object.fromEntries(rows(s).map(p=>[p.role,p]))),error)];
   }
  },error));
  stops.push(r.collection('members').onSnapshot(s=>{const all=rows(s);handlers.members(all);if(!isHost)brief(all.find(m=>m.uid===auth.currentUser?.uid&&m.active)?.role||'');},error));
  stops.push(r.collection('seats').onSnapshot(s=>handlers.seats(Object.fromEntries(rows(s).map(x=>[x.role,x]))),error));
  stops.push(r.collection('results').onSnapshot(s=>handlers.results(rows(s).sort((a,b)=>a.round-b.round)),error));
  stops.push(r.collection('readiness').onSnapshot(s=>handlers.readiness?.(Object.fromEntries(rows(s).map(x=>[x.id,x]))),error));
  stops.push(r.collection('evaluations').onSnapshot(s=>handlers.evaluations?.(rows(s)),error));
  if(isHost)stops.push(r.collection('briefings').onSnapshot(s=>handlers.briefs(Object.fromEntries(rows(s).map(x=>[x.role,x]))),error));
  return ()=>{stops.forEach(f=>f());roundStops.forEach(f=>f());if(briefStop)briefStop();};
 }
 function error(e){const s=String(e?.code||e?.message||e);if(/permission-denied|insufficient permissions/i.test(s))return 'Las reglas de acceso de Mesa de Acuerdos aún no permiten esta operación. El facilitador debe publicar firestore.rules actualizado y verificar su rol.';if(/auth\/invalid-credential|auth\/wrong-password|auth\/invalid-email/.test(s))return 'Revisa el correo y la contraseña de tu cuenta.';if(/auth\/operation-not-allowed/.test(s))return 'El acceso del Laboratorio requiere habilitar los proveedores Anónimo y Correo/Contraseña.';if(/network-request-failed|unavailable|failed to fetch/.test(s))return 'Se interrumpió la conexión. Comprueba tu red y vuelve a intentar; no cierres tu navegador.';return String(e?.message||e);}
 async function ready(code,round,role,stage,value=true){
  const user=await signed(),r=ref(code);
  await db.runTransaction(async tx=>{
   if(stage==='close'&&value){
    const p=r.collection('positions').doc(`${round}_${role}`),c=r.collection('cursors').doc(`${round}_${role}`);
    const [ps,cs]=await Promise.all([tx.get(p),tx.get(c)]);
    if(!ps.exists)tx.set(p,{round,role,uid:user.uid,offerId:'',response:'pending',reason:'',updatedAt:stamp()});
    if(!cs.exists)tx.set(c,{round,role,uid:user.uid,revision:0,offerId:''});
   }
   tx.set(r.collection('readiness').doc(`${round}_${stage}_${role}`),{round,role,stage,ready:value,uid:user.uid,updatedAt:stamp()});
  });
 }
 async function freezeAutonomous(code){
  const r=ref(code);await db.runTransaction(async tx=>{const s=await tx.get(r);if(s.data()?.phase!=='negotiating')return;tx.update(r,{phase:'settling',updatedAt:stamp()});});
 }
 async function evaluateOwn(code,role,brief){
  const user=await signed(),r=ref(code),room=(await r.get()).data();if(room.phase!=='settling')return;
  const target=r.collection('evaluations').doc(`${room.round}_${role}`);if((await target.get()).exists)return;
  const [os,ps]=await Promise.all([r.collection('offers').where('round','==',room.round).get(),r.collection('positions').where('round','==',room.round).get()]);
  const offers=os.docs.map(d=>({...d.data(),id:d.id})),positions=Object.fromEntries(ps.docs.map(d=>[d.data().role,d.data()]));
  const b=E.makeBriefs(()=>.5);b[role]=brief;
  const result=E.settle({round:room.round,offers,positions,briefs:b,shared:room.shared,metrics:room.metrics,totals:room.totals});
  const actor=result.actors[role],scoreRef=r.collection('scorechecks').doc(`${room.round}_${role}`);
  if(!(await scoreRef.get()).exists)await scoreRef.set({round:room.round,role,uid:user.uid,breakdown:actor.breakdown,points:actor.points,total:actor.total,penalty:actor.penalty,offerId:actor.offerId,createdAt:stamp()});
  const effectRef=r.collection('effects').doc(`${room.round}_${role}`);
  if(!(await effectRef.get()).exists)await effectRef.set({round:room.round,role,uid:user.uid,before:actor.before,metrics:actor.metrics,createdAt:stamp()});
  await target.set({round:room.round,role,uid:user.uid,actor,offer:offers.find(o=>o.id===actor.offerId)||null,position:positions[role]||null,agreement:result.agreement,agreedOfferId:result.agreedOfferId,reviewed:result.reviewed,sharedBefore:result.sharedBefore,sharedAfter:result.sharedAfter,createdAt:stamp()});
 }
 async function finishAutonomous(code){
  const r=ref(code),room=(await r.get()).data(),round=room.round;if(room.phase!=='settling')return;
  const snapshots=await Promise.all(D.roleIds.map(role=>r.collection('evaluations').doc(`${round}_${role}`).get()));if(snapshots.some(s=>!s.exists))return;
  const es=Object.fromEntries(snapshots.map(s=>[s.data().role,s.data()])),first=es.employer,actors=Object.fromEntries(D.roleIds.map(role=>[role,es[role].actor]));
  const result={round,agreement:first.agreement,agreedOfferId:first.agreedOfferId,reviewed:first.reviewed,sharedBefore:first.sharedBefore,sharedAfter:first.sharedAfter,actors,offers:Object.fromEntries(D.roleIds.map(role=>[role,es[role].offer])),positions:Object.fromEntries(D.roleIds.map(role=>[role,es[role].position])),ranking:E.rank(Object.fromEntries(D.roleIds.map(role=>[role,actors[role].points]))),cumulativeRanking:E.rank(Object.fromEntries(D.roleIds.map(role=>[role,actors[role].total])))};
  await db.runTransaction(async tx=>{const current=await tx.get(r),old=await tx.get(r.collection('results').doc(String(round)));if(old.exists)return;if(current.data()?.phase!=='settling'||current.data().round!==round)return;
   tx.set(r.collection('results').doc(String(round)),{...result,settledAt:stamp()});
   tx.update(r,{phase:round===6?'finished':'review',totals:Object.fromEntries(D.roleIds.map(role=>[role,actors[role].total])),metrics:Object.fromEntries(D.roleIds.map(role=>[role,actors[role].metrics])),shared:result.sharedAfter,updatedAt:stamp()});
  });
 }
 root.MESA_FIREBASE={init,signed,hostLogin,hostSession,logout,create,join,loadHost,assign,remove,spokesperson,openRound,offer,position,closeRound,reset,subscribe,error,ready,freezeAutonomous,evaluateOwn,finishAutonomous,user:()=>auth?.currentUser};
})(window);
