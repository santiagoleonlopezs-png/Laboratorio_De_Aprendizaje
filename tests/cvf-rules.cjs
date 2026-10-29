const fs = require('node:fs');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, serverTimestamp } = require('firebase/firestore');

const projectId = 'demo-cvf-local';
const roomCode = 'FZAESB';
const uid = 'anon-test-abc';
const team = 'Equipo general';
const baseDoc = {gameId:'culture-cvf-team-v1',hostUid:'host-abc',className:'Prueba OCAI',teams:[team],status:'open',createdAt:new Date(),updatedAt:new Date()};
const rows = () => Array.from({length:6}, () => ({a:100,b:0,c:0,d:0}));
const payload = () => ({uid,team,version:1,current:rows(),preferred:rows(),submittedAt:serverTimestamp()});
let env;
async function check(){
 env=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
 await env.withSecurityRulesDisabled(async ctx => {
   await setDoc(doc(ctx.firestore(),'ocai_rooms',roomCode),baseDoc);
 });
 const user=env.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous'}});
 const own=doc(user.firestore(),'ocai_rooms',roomCode,'responses',uid);
 await assertSucceeds(getDoc(doc(user.firestore(),'ocai_rooms',roomCode)));
 await assertSucceeds(getDoc(own));
 console.log('PASS: lectura sala y respuesta inexistente');

 await assertSucceeds(setDoc(own,payload()));
 console.log('PASS: registro de 6 x 4 puntos para Hoy y Deseada');

 const snap=await getDoc(own);
 assert.equal(snap.data().current.length,6);
 assert.equal(snap.data().current[0].a,100);
 await assertFails(setDoc(own,payload()));
 console.log('PASS: respuesta duplicada bloqueada');

 const impostor=env.authenticatedContext('anon-other',{firebase:{sign_in_provider:'anonymous'}});
 await assertFails(setDoc(doc(impostor.firestore(),'ocai_rooms',roomCode,'responses',uid),payload()));
 console.log('PASS: otro UID no puede modificar respuestas ajenas');

 const anotherId='anon-invalid';
 const invalid=env.authenticatedContext(anotherId,{firebase:{sign_in_provider:'anonymous'}});
 const make=()=>({...payload(),uid:anotherId});
 await assertFails(setDoc(doc(invalid.firestore(),'ocai_rooms',roomCode,'responses',anotherId),{...make(),team:'Equipo extraño'}));
 const bad=make();bad.current[0]={a:99,b:0,c:0,d:0};
 await assertFails(setDoc(doc(invalid.firestore(),'ocai_rooms',roomCode,'responses',anotherId),bad));
 console.log('PASS: reglas rechazan equipo no inscrito y dimensiones que no suman 100');
}
check().then(()=>process.exitCode=0).catch(e=>{console.error('FAIL',e);process.exitCode=1}).finally(async()=>{if(env)await env.cleanup()});
