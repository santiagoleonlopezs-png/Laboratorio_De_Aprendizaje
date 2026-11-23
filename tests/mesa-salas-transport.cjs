'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const compat=require('firebase/compat/app');require('firebase/compat/firestore');
const D=require('../mesa-acuerdos-data.js'),E=require('../mesa-acuerdos-engine.js'),X=require('../mesa-salas-engine.js');let env;
function api(uid,host=false){
 const ctx=env.authenticatedContext(uid,host?{facilitator:true}:{firebase:{sign_in_provider:'anonymous'}}),db=ctx.firestore(),u={uid,isAnonymous:!host,getIdTokenResult:async()=>({claims:host?{facilitator:true}:{}})},auth={currentUser:u,onAuthStateChanged:f=>{queueMicrotask(()=>f(u));return ()=>{};}};
 const firebase={apps:[{}],app:()=>({}),auth:()=>auth,firestore:Object.assign(()=>db,{FieldValue:compat.firestore.FieldValue})};const w={MESA_DATA:D,MESA_ENGINE:E,MESA_SALAS_ENGINE:X,FIREBASE_CONFIG:{projectId:'demo-mesa-salas'},firebase};
 for(const file of ['mesa-acuerdos-firebase.js','mesa-salas-firebase.js'])new Function('window','firebase','crypto',fs.readFileSync(file,'utf8'))(w,firebase,webcrypto);
 return {F:w.MESA_SALAS,db,uid};
}
async function run(){
 env=await initializeTestEnvironment({projectId:'demo-mesa-salas',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
 const h=api('host-salas',true),players=Array.from({length:7},(_,i)=>api('u'+i)),outsider=api('outside');
 for(const mode of ['autonomous','guided']){
  const code=await h.F.create('Prueba de siete personas',mode),r=h.db.collection('mesa_acuerdos_sessions').doc(code);
  await Promise.all(players.map(p=>p.F.join(code,'Persona '+p.uid)));assert.equal((await r.get()).data().enrollmentRevision,7);
  const assignments=X.distribute(players.map(p=>({uid:p.uid,active:true})));await h.F.prepare(code,assignments);
  const p=(await r.get()).data();assert.deepEqual(p.tableIds,['M01','M02']);
  const roots=await Promise.all(p.tableIds.map(id=>r.collection('tables').doc(id).get()));assert.deepEqual(roots.map(t=>t.data().roster.length),[4,3]);
  const assigned=uid=>players.find(p=>p.uid===uid),tb=id=>r.collection('tables').doc(id);
  await assert.rejects(outsider.F.join(code,'Fuera de plazo'),/inscripción está cerrada/);
  await assertFails(assigned('u0').db.collection('mesa_acuerdos_sessions').doc(code).collection('tables').doc('M02').collection('rounds').doc('1').get());
  await assertFails(assigned('u0').db.collection('mesa_acuerdos_sessions').doc(code).collection('tables').doc('M01').collection('briefings').doc('union').get());
  for(let round=1;round<=6;round++){
   if(mode==='guided')await h.F.openAll(code);else for(const id of p.tableIds){const a=(await tb(id).get()).data();await assigned(a.roster[0]).F.open(code,id);}
   for(const id of p.tableIds){
    const a=(await tb(id).get()).data(),route=D.rounds[round-1].routes.find(x=>x.quality===1).id;
    for(const uid of a.roster)await assigned(uid).F.offer(code,id,{route:round===2&&uid==='u3'?'pact':route,benefits:35,operations:30,implementation:20,days:20,owner:'hr',monitor:'weekly',style:'dialogue',argument:'Registramos una propuesta individual para sostener la operación y proteger garantías.',commitment:'Revisar los compromisos con responsables cada semana.'});
    const state=(await tb(id).collection('rounds').doc(String(round)).get()).data(),chosen=state.offers[a.byRole.employer[0]].id;
    assert.equal(Object.keys(state.offers).length,a.roster.length);
    if(round===1){const other=a.roster[1];await assertFails(assigned(a.roster[0]).db.collection('mesa_acuerdos_sessions').doc(code).collection('tables').doc(id).collection('rounds').doc('1').update({offers:{...state.offers,[other]:{...state.offers[other],benefits:0}},updatedAt:compat.firestore.FieldValue.serverTimestamp()}));}
    if(round!==5)for(const uid of a.roster)await assigned(uid).F.position(code,id,chosen,round===2&&uid==='u3'?'reject':a.roles[uid]==='hr'?'review':'accept','La posición se sustenta en la ruta elegida y en compromisos verificables.');
    if(mode==='autonomous'){
     await assertFails(assigned(a.roster[0]).F.freeze(code,id));
     for(const uid of a.roster)await assigned(uid).F.ready(code,id,'close',true);
     await assigned(a.roster[0]).F.freeze(code,id);
     if(round===1){const uid=a.roster[0],player=assigned(uid),brief=(await player.db.collection('mesa_acuerdos_sessions').doc(code).collection('tables').doc(id).collection('briefings').doc(a.roles[uid]).get()).data().rounds[0],st=(await tb(id).collection('rounds').doc('1').get()).data(),actor=X.evaluate(a,st,uid,brief).actor;await assertFails(player.db.collection('mesa_acuerdos_sessions').doc(code).collection('tables').doc(id).collection('pointProofs').doc('1_'+uid).set({uid,round:1,role:a.roles[uid],points:999,total:999,breakdown:actor.breakdown,penalty:actor.penalty,offerId:actor.offerId,createdAt:compat.firestore.FieldValue.serverTimestamp()}));}
     for(const uid of a.roster)await assigned(uid).F.publishOwn(code,id);
     await assigned(a.roster[0]).F.consolidate(code,id);
    }else{await assertFails(assigned(a.roster[0]).F.close(code,id));await h.F.close(code,id);}
    const result=(await tb(id).collection('results').doc(String(round)).get()).data(),after=(await tb(id).get()).data();assert.equal(Object.keys(result.people).length,a.roster.length);assert.equal(after.phase,round===6?'finished':'review');
    for(const uid of a.roster){assert.equal(after.people[uid].completed,round);assert.ok(Number.isFinite(result.people[uid].points));}
    if(id==='M01'&&round===2){assert.equal(result.agreement,false);assert.ok(result.people.u0.points>result.people.u3.points);}
    await assertFails(assigned(a.roster[0]).db.collection('mesa_acuerdos_sessions').doc(code).collection('tables').doc(id).collection('personalResults').doc(`${round}_${a.roster[0]}`).update({'actor.points':999}));
    if(mode==='autonomous'&&round<6){await assertFails(assigned(a.roster[0]).F.open(code,id));for(const uid of a.roster)await assigned(uid).F.ready(code,id,'next',true);}
   }
   console.log(`PASS: ${mode}, ronda ${round}, dos mesas y siete decisiones individuales`);
  }
  await h.F.reset(code);assert.equal((await tb('M01').collection('personalResults').get()).size,0);assert.equal((await r.collection('attendees').get()).size,7);
 }
 // Quinta persona, mayoría 2/3 de Gerencia, y cierre sin ninguna decisión.
 for(const size of [5,3]){
  const group=players.slice(0,size),code=await h.F.create('Casos de borde','autonomous'),root=h.db.collection('mesa_acuerdos_sessions').doc(code),t=root.collection('tables').doc('M01');
  await Promise.all(group.map(p=>p.F.join(code,'Persona '+p.uid)));
  const assignments=group.map((p,i)=>({uid:p.uid,tableId:'M01',role:i===1?'union':i===2?'hr':'employer'}));await h.F.prepare(code,assignments);await group[0].F.open(code,'M01');
  if(size===5){
   for(const p of group)await p.F.offer(code,'M01',{route:'listen',benefits:35,operations:30,implementation:20,days:20,owner:'hr',monitor:'weekly',style:'dialogue',argument:'Una propuesta para respetar garantías y sostener los compromisos colectivos.',commitment:'Reunir a los responsables cada semana para verificar los avances.'});
   const chosen=(await t.collection('rounds').doc('1').get()).data().offers.u0.id;
   for(const p of group)await p.F.position(code,'M01',chosen,p.uid==='u4'?'reject':p.uid==='u2'?'review':'accept','La posición considera los intereses de los actores y las garantías del caso.');
  }
  for(const p of group.slice(0,-1))await p.F.ready(code,'M01','close',true);await assertFails(group[0].F.freeze(code,'M01'));
  await group.at(-1).F.ready(code,'M01','close',true);await group[0].F.freeze(code,'M01');
  for(const p of group)await p.F.publishOwn(code,'M01');await group[0].F.consolidate(code,'M01');
  const result=(await t.collection('results').doc('1').get()).data();assert.equal(Object.keys(result.people).length,size);assert.equal(result.agreement,size===5);
  if(size===3)assert.ok(Object.values(result.people).every(p=>p.points===0&&p.metrics.every(n=>n===47)));
  console.log('PASS: mesa de '+size+' personas, '+(size===5?'mayoría de rol repetido':'decisiones faltantes con cero puntos'));
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(env)await env.cleanup();});
