const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../nexus-engine.js');
function fixture(config={}){
 const docs=new Map([['nexus_rooms/QA',{status:'open',gameId:'nexus-v1',hostUid:'host',mode:'guided',phase:'deciding',currentRound:1,...config}]]);
 const copy=v=>JSON.parse(JSON.stringify(v));
 const snap=path=>({exists:docs.has(path),data:()=>docs.has(path)?copy(docs.get(path)):undefined});
 const ref=path=>({path,get:async()=>snap(path),collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)}),set:async data=>docs.set(path,copy(data))});
 const batch=()=>{const ops=[];return {set:(r,data)=>ops.push([r.path,copy(data),false]),update:(r,data)=>ops.push([r.path,copy(data),true]),commit:async()=>{for(const [p,d,merge]of ops)docs.set(p,merge?{...docs.get(p),...d}:d);}};};
 const db={collection:name=>({doc:id=>ref(name+'/'+id)}),batch,runTransaction:async fn=>{const b=batch();await fn({...b,get:async r=>snap(r.path)});await b.commit();}};
 const user={uid:'team1',isAnonymous:true,getIdTokenResult:async()=>({claims:{}})};
 const auth={currentUser:user,onAuthStateChanged(fn){queueMicrotask(fn);return ()=>{};},async signOut(){this.currentUser=null;},async signInAnonymously(){this.currentUser=user;},async signInWithEmailAndPassword(){return {user:this.currentUser};}};
 const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>'<server-time>'};
 const ctx={window:{FIREBASE_CONFIG:{apiKey:'qa',projectId:'qa'},NEXUS_ENGINE:engine},firebase:{apps:[{}],app:()=>({}),auth:()=>auth,firestore},console};ctx.window.firebase=ctx.firebase;
 vm.runInNewContext(fs.readFileSync(require.resolve('../nexus-firebase.js'),'utf8'),ctx);
 return {api:ctx.window.NEXUS_FIREBASE,docs,auth,host(){auth.currentUser={uid:'host',isAnonymous:false,getIdTokenResult:async()=>({claims:{facilitator:true}})};}};
}
const state=(history=[])=>({round:Math.max(0,history.length-1),score:70,baseScore:70,spent:history.length*20,borrowed:0,business:60,metrics:{Apropiación:60},history});
test('Guarda equipo e historial privado y ranking sin hipótesis',async()=>{
 const f=fixture();await f.api.join('QA','NOVA',state());
 const h={id:'one',round:1,hypothesis:'Hipótesis privada'};await f.api.save('QA','NOVA',state([h]));
 assert.equal(f.docs.get('nexus_rooms/QA/teams/team1').gameState.history[0].hypothesis,'Hipótesis privada');
 assert.deepEqual(Object.keys(f.docs.get('nexus_rooms/QA/ranking/team1')).sort(),['borrowed','ownerUid','round','score','team','updatedAt']);
});
test('La transacción rechaza un envío cuando el facilitador ya abrió conversación',async()=>{
 const f=fixture();await f.api.join('QA','NOVA',state());f.docs.get('nexus_rooms/QA').phase='discussion';
 await assert.rejects(f.api.save('QA','NOVA',state([{id:'one',round:1}])),/habilitado/);
 assert.equal(f.docs.get('nexus_rooms/QA/teams/team1').gameState.history.length,0);
});
test('Reintentar la misma decisión no duplica; otra pestaña no la sobrescribe',async()=>{
 const f=fixture();await f.api.join('QA','NOVA',state());const s=state([{id:'one',round:1}]);
 await f.api.save('QA','NOVA',s);await f.api.save('QA','NOVA',s);
 await assert.rejects(f.api.save('QA','NOVA',state([{id:'two',round:1}])),/Otra pestaña/);
 await assert.rejects(f.api.save('QA','NOVA',state()),/avance más reciente/);
});
test('No permite saltos de ronda y una sala autónoma admite el siguiente envío',async()=>{
 const f=fixture({mode:'autonomous'});await f.api.join('QA','NOVA',state());
 await assert.rejects(f.api.save('QA','NOVA',state([{id:'two',round:2}])),/siguiente ronda/);
 await f.api.save('QA','NOVA',state([{id:'one',round:1}]));
 await f.api.save('QA','NOVA',state([{id:'one',round:1},{id:'two',round:2}]));
 assert.equal(f.docs.get('nexus_rooms/QA/teams/team1').gameState.history.length,2);
});
test('Solo el dueño controla la sala y un doble clic no abre dos rondas',async()=>{
 const f=fixture();await assert.rejects(f.api.controlRoom('QA','discussion'),/Inicia sesión/);f.host();
 await assert.rejects(f.api.controlRoom('QA','next'),/ranking/);
 await f.api.controlRoom('QA','discussion');await f.api.controlRoom('QA','next');
 assert.equal(f.docs.get('nexus_rooms/QA').currentRound,2);
 await assert.rejects(f.api.controlRoom('QA','next'),/ranking/);
 f.auth.currentUser.uid='otro';await assert.rejects(f.api.controlRoom('QA','discussion'),/acceso/);
});
test('Nuevas salas guardan modalidad; las existentes no se reinician',async()=>{
 const f=fixture();f.host();await f.api.createRoom('NUEVA','guided');
 assert.equal(f.docs.get('nexus_rooms/NUEVA').mode,'guided');
 assert.equal(await f.api.createRoom('QA','autonomous'),false);assert.equal(f.docs.get('nexus_rooms/QA').mode,'guided');
});
