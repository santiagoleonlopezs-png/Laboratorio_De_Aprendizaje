'use strict';
// Pruebas del roster en tiempo real, sin dependencia de Firebase real ni navegador.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const script=fs.readFileSync(path.join(__dirname,'../ley-cultura.js'),'utf8');
const indicator={textContent:'',dataset:{}};
const preview={innerHTML:''};
const mockDom={
  addEventListener(){},
  getElementById(id){return id==='rosterSyncStatus'?indicator:(id==='rosterPreview'?preview:null);}
};
const context=vm.createContext({
  document:mockDom,
  console:{log(){},warn(){},error(){}},
  setInterval(){return 12;},
  clearInterval(){},
  Date,Map,Set
});
vm.runInContext(script,context,{filename:'ley-cultura.js'});
const S=vm.runInContext('S',context);
let renderCalls=0;
context.renderHost=()=>{renderCalls++;};
context.renderLive=()=>{};
const snapshots=[];
let records=[{id:'p1',name:'Ana'}];
let listeners=0,fetches=0,failFetch=false;
function fromRecords(list,fromCache=false){
  return {
    docs:list.map(r=>({id:r.id,data:()=>({uid:r.id,name:r.name})})),
    metadata:{fromCache}
  };
}
function query(){
 return {
   onSnapshot(options,success,error){
      assert.equal(options.includeMetadataChanges,true);
      const subscription={success,error,closed:false};
      snapshots.push(subscription);listeners++;
      return ()=>{subscription.closed=true;};
   },
   async get(options){
     assert.equal(options.source,'server');
     fetches++;
     if(failFetch)throw Object.assign(new Error('Sin conexión'),{code:'unavailable'});
     return fromRecords(records);
   }
 };
}
S.db={collection(name){
 assert.equal(name,'ley_cultura_rooms');
 return {doc(){return {collection(name){assert.equal(name,'participants');return query();}};}};
}};
async function check(){
  S.mode='host';S.code='SALA01';S.room={status:'waiting',round:1};
  context.startRosterSync('SALA01');
  await context.verifyRoster(true);
  assert.equal(S.participants.length,1);
  assert.equal(S.participants[0].name,'Ana');
  assert.equal(S.roster.state,'live');
  assert.match(indicator.textContent,/sincronizados/);
  assert.match(preview.innerHTML,/Ana/);
  console.log('PASS: consulta de servidor actualiza el listado inicial');
  records=[{id:'p1',name:'Ana'},{id:'p2',name:'Luis'}];
  snapshots[0].success(fromRecords(records));
  assert.equal(S.participants.length,2);
  assert.match(preview.innerHTML,/Luis/);
  console.log('PASS: ingreso nuevo visible inmediatamente sin recargar');
  snapshots[0].success(fromRecords([{id:'p1',name:'Ana'}],true));
  assert.equal(S.participants.length,2);
  console.log('PASS: cache anterior no borra los ingresos confirmados');
  records=[{id:'p1',name:'Ana'},{id:'p2',name:'Luis'},{id:'p3',name:'María'}];
  await context.verifyRoster(true);
  assert.equal(S.participants.length,3);
  assert.match(preview.innerHTML,/María/);
  console.log('PASS: respaldo de consulta recupera una escucha silenciosa');
  const first=snapshots[0];
  first.error(Object.assign(new Error('listener lost'),{code:'unavailable'}));
  assert.equal(S.roster.state,'offline');
  await context.verifyRoster(true);
  assert.ok(listeners>=2);
  assert.equal(S.roster.state,'live');
  console.log('PASS: escucha de Firebase se restaura tras interrupción');
  failFetch=true;
  await context.verifyRoster(true);
  assert.equal(S.participants.length,3);
  assert.equal(S.roster.state,'offline');
  failFetch=false;
  console.log('PASS: error transitorio no borra participantes confirmados');
  const stale=snapshots[snapshots.length-1];
  context.stopRosterSync();
  S.code='SALA02';S.room={status:'waiting',round:1};
  records=[{id:'q1',name:'Julián'}];
  context.startRosterSync('SALA02');
  await context.verifyRoster(true);
  assert.equal(S.participants.length,1);
  stale.success(fromRecords([{id:'p1',name:'Ana'}]));
  assert.equal(S.participants[0].name,'Julián');
  console.log('PASS: eventos de una sala anterior no contaminan la actual');
  context.stopRosterSync();
  assert.equal(S.rosterWatch,null);
  assert.ok(fetches>=3);
}
check().catch(err=>{console.error('FAIL:',err);process.exitCode=1;});