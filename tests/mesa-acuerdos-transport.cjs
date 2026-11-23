'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const compat=require('firebase/compat/app');require('firebase/compat/firestore');
const E=require('../mesa-acuerdos-engine.js'),D=require('../mesa-acuerdos-data.js');
let env;
function api(uid,host=false){
 const ctx=env.authenticatedContext(uid,host?{facilitator:true}:{firebase:{sign_in_provider:'anonymous'}}),db=ctx.firestore();
 const user={uid,isAnonymous:!host,getIdTokenResult:async()=>({claims:host?{facilitator:true}:{}})};
 const auth={currentUser:user,onAuthStateChanged:cb=>{queueMicrotask(()=>cb(user));return ()=>{};}};
 const firebase={apps:[{}],app:()=>({}),auth:()=>auth,firestore:Object.assign(()=>db,{FieldValue:compat.firestore.FieldValue})};
 const w={MESA_DATA:D,MESA_ENGINE:E,FIREBASE_CONFIG:{projectId:'demo-mesa-acuerdos'},firebase};
 new Function('window','firebase','crypto',fs.readFileSync('mesa-acuerdos-firebase.js','utf8'))(w,firebase,webcrypto);
 return {F:w.MESA_FIREBASE,db,uid};
}
async function run(){
 env=await initializeTestEnvironment({projectId:'demo-mesa-acuerdos',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
 const host=api('host-flow',true),players={employer:api('employer-player'),union:api('union-player'),hr:api('hr-player')};
 const code=await host.F.create('Negociación autónoma de prueba','autonomous'),root=host.db.collection('mesa_acuerdos_rooms').doc(code);
 for(const role of D.roleIds)await players[role].F.join(code,'Persona '+role);
 await host.F.assign(code,D.roleIds.map(role=>({uid:players[role].uid,role})));
 await players.employer.F.openRound(code);
 for(let round=1;round<=6;round++){
  const route=round===2?'pact':round===3?'announce':D.rounds[round-1].routes.find(x=>x.quality===1).id;
  if(round!==5){for(const role of D.roleIds){await players[role].F.offer(code,{round,role,revision:1,route,benefits:35,operations:30,implementation:20,days:20,owner:'hr',monitor:'weekly',style:round===3?'conditional':'dialogue',argument:'Esta propuesta establece compromisos verificables y una ruta para las partes.',commitment:'Reunión semanal con acta y seguimiento de compromisos.'});}
   for(const role of D.roleIds)await players[role].F.position(code,{round,role,response:round===4?'reject':role==='hr'?'review':'accept',offerId:round===4?`${round}_${role}_1`:`${round}_employer_1`,reason:'La decisión se fundamenta en nuestras prioridades y en la información disponible.'});
  }
  await assertFails(players.employer.F.freezeAutonomous(code));
  for(const role of D.roleIds)await players[role].F.ready(code,round,role,'close');
  await assertFails(players.union.F.position(code,{round,role:'union',response:'reject',offerId:round===5?'':`${round}_employer_1`,reason:'Intento de cambiar después de confirmar el cierre de mi actor.'}));
  await players.union.F.freezeAutonomous(code);
  if(round===1)await assertFails(players.employer.db.collection('mesa_acuerdos_rooms').doc(code).collection('scorechecks').doc('1_employer').set({round:1,role:'employer',uid:players.employer.uid,breakdown:{legal:0,objective:0,cooperation:0,feasibility:0,implementation:0},points:100,total:100,penalty:0,offerId:'1_employer_1',createdAt:compat.firestore.FieldValue.serverTimestamp()}));
  for(const role of D.roleIds){const b=(await players[role].db.collection('mesa_acuerdos_rooms').doc(code).collection('briefings').doc(role).get()).data().rounds[round-1];await players[role].F.evaluateOwn(code,role,b);}
  const evaluation=players.union.db.collection('mesa_acuerdos_rooms').doc(code).collection('evaluations').doc(`${round}_union`);
  await assertFails(evaluation.update({'actor.points':999}));
  await players.hr.F.finishAutonomous(code);
  const summary=(await root.get()).data(),result=(await root.collection('results').doc(String(round)).get()).data();
  assert.equal(summary.phase,round===6?'finished':'review');assert.equal(result.round,round);
  for(const role of D.roleIds){const recorded=(await root.collection('evaluations').doc(`${round}_${role}`).get()).data();assert.deepEqual(result.actors[role],recorded.actor);assert.equal(summary.totals[role],recorded.actor.total);if(round===2)assert.ok(recorded.actor.points<=20);if(round===5)assert.equal(recorded.actor.points,0);}
  if(round<6){await assertFails(players.employer.F.openRound(code));for(const role of D.roleIds)await players[role].F.ready(code,round,role,'next');await players.hr.F.openRound(code);}
  console.log(`PASS: ciclo autónomo ronda ${round}, puntuación verificada y avance sin el facilitador`);
 }
 // El facilitador retoma el historial sin ser necesario para conducir las rondas.
 const loaded=await host.F.loadHost(code);assert.equal(loaded.phase,'finished');
 await host.F.reset(code);assert.equal((await root.get()).data().phase,'lobby');assert.equal((await root.collection('results').get()).size,0);assert.equal((await root.collection('members').get()).size,3);
 console.log('PASS: tablero del propietario y reinicio conservan participantes');
 const guided=await host.F.create('Negociación dirigida de prueba','guided');
 for(const role of D.roleIds)await players[role].F.join(guided,'Persona '+role);
 await host.F.assign(guided,D.roleIds.map(role=>({uid:players[role].uid,role})));
 await assertFails(players.employer.F.openRound(guided));
 for(let round=1;round<=6;round++){
  await host.F.openRound(guided);
  for(const role of D.roleIds)await players[role].F.offer(guided,{round,role,revision:1,route:D.rounds[round-1].routes.find(x=>x.quality===1).id,benefits:35,operations:30,implementation:20,days:20,owner:'hr',monitor:'weekly',style:'dialogue',argument:'Una propuesta con criterios claros para proteger garantías y hacer seguimiento.',commitment:'Registrar los avances de los compromisos cada semana.'});
  for(const role of D.roleIds)await players[role].F.position(guided,{round,role,response:role==='hr'?'review':'accept',offerId:`${round}_employer_1`,reason:'La propuesta permite un acuerdo verificable entre las partes y protege las garantías.'});
  await assertFails(players.union.F.closeRound(guided));
  await host.F.closeRound(guided);
  const r=(await host.db.collection('mesa_acuerdos_rooms').doc(guided).get()).data();
  assert.equal(r.phase,round===6?'finished':'review');
  console.log(`PASS: ciclo dirigido ronda ${round}, cierre y avance exclusivos del facilitador`);
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(env)await env.cleanup();});
