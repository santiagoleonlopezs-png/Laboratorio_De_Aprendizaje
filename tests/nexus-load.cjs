'use strict';
// Prueba aislada de concurrencia. Se niega a usar proyectos reales o hosts remotos.
// NODE_PATH debe incluir firebase y @firebase/rules-unit-testing.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {performance,monitorEventLoopDelay}=require('node:perf_hooks');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const firebase=require('firebase/compat/app');require('firebase/compat/firestore');
const engine=require('../nexus-engine.js');
const root=path.join(__dirname,'..');
const projectId='demo-nexus-load',host='127.0.0.1',port=8080;
if(!projectId.startsWith('demo-')||host!=='127.0.0.1')throw Error('Solo se permite un emulador local con proyecto demo.');
const transport=fs.readFileSync(path.join(root,'nexus-firebase.js'),'utf8');
const player=fs.readFileSync(path.join(root,'nexus-player.js'),'utf8');
const modelScope={window:{CHANGE_LAB_CONFIG:{},NEXUS_ENGINE:engine}};
vm.runInNewContext(player.slice(0,player.indexOf('async function enterGame'))+'\nglobalThis.model={vars,practices,practiceCosts,rounds,freshState};',modelScope);
const model=modelScope.model;
const effectBody=player.slice(player.indexOf('function effects(){'),player.indexOf('async function execute(){'));
const effect=new Function('state','selected','practices','selectedCost','$','document','vars','engine',effectBody+'return effects();');
const args=process.argv.slice(2);
const sizes=(args.find(a=>a.startsWith('--sizes='))?.split('=')[1]||'10,25,50,100').split(',').map(Number);
const output=path.resolve(args.find(a=>a.startsWith('--out='))?.slice(6)||'nexus-load-results.json');
const timeout=Number(args.find(a=>a.startsWith('--timeout='))?.slice(10)||60000);
const mark=()=>performance.now();
const percentile=(a,p)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.ceil(a.length*p)-1)]:null;
const stats=a=>({n:a.length,p50_ms:round(percentile(a,.5)),p95_ms:round(percentile(a,.95)),max_ms:round(a.length?Math.max(...a):null)});
const round=n=>n===null?null:Math.round(n*100)/100;
const waitUntil=async(fn,label)=>{const start=mark();while(!fn()){if(mark()-start>timeout)throw Error('Timeout: '+label);await new Promise(r=>setTimeout(r,15));}return mark()-start;};
const clone=v=>JSON.parse(JSON.stringify(v));
function client(env,uid,facilitator=false){
 const db=env.authenticatedContext(uid,facilitator?{facilitator:true}:{firebase:{sign_in_provider:'anonymous'}}).firestore();
 const user={uid,isAnonymous:!facilitator,getIdTokenResult:async()=>({claims:{facilitator}})};
 const auth={currentUser:user,onAuthStateChanged(callback){queueMicrotask(callback);return ()=>{};}};
 const firestore=()=>db;firestore.FieldValue=firebase.firestore.FieldValue;
 const sdk={apps:[{}],app:()=>({}),auth:()=>auth,firestore};
 const scope={window:{FIREBASE_CONFIG:{apiKey:'emulator-only',projectId},NEXUS_ENGINE:engine,firebase:sdk},firebase:sdk,console};
 new Function('window','firebase',transport)(scope.window,sdk);
 return {api:scope.window.NEXUS_FIREBASE,db,uid,state:{...model.freshState(),evolution:[]}};
}
function decision(state,index,r){
 const sets=[['ADKAR','TRIZ'],['Lean Change','Aprendizaje experiencial'],['Escucha persuasiva','Gestión Humana'],['Lean Change','Intenciones de implementación'],['Reconocimiento','Identificación de casos exitosos']];
 const names=index%5===4?sets[r-1].concat('Co-creación').slice(0,3):sets[r-1];
 const selected=names.map(n=>model.practices.findIndex(p=>p[0]===n));
 const credits=names.reduce((s,n)=>s+model.practiceCosts[n],0);
 const focus=engine.critical[r-1],attention=Object.fromEntries(model.vars.map(k=>[k,0]));
 focus.forEach(k=>attention[k]=40);attention[model.vars.find(k=>!focus.includes(k))]=20;
 const target=index%4===0?'Conocimiento':focus[0];
 const before={...state.metrics};
 const effects=effect(state,selected,model.practices,()=>credits,()=>({value:target}),{querySelectorAll:()=>Object.entries(attention).map(([key,value])=>({dataset:{diag:key},value}))},model.vars,engine);
 const consequence=effects.__consequence;delete effects.__consequence;
 for(const v of model.vars)state.metrics[v]=Math.max(0,Math.min(100,state.metrics[v]+effects[v]));
 const afterDecision=state.metrics.Apropiación;
 const emerg=state.metrics.Conciencia*.18+state.metrics.Compromiso*.27+state.metrics.Conocimiento*.12+state.metrics.Capacidad*.27+state.metrics.Confianza*.16;
 const emergent=afterDecision*.78+emerg*.22;
 const bad=consequence.irrelevant.length||consequence.counterproductive.length||consequence.opportunity;
 state.metrics.Apropiación=Math.max(0,Math.min(100,bad?Math.min(afterDecision,emergent):emergent));
 state.business=Math.max(0,Math.min(100,state.business+(state.metrics.Apropiación-45)*.1+(state.metrics.Capacidad-45)*.06));
 const needed=Math.max(0,state.spent+credits-120-state.borrowed);
 if(needed){const amount=Math.ceil(needed/20)*20;state.borrowed+=amount;state.loans.push({round:r,credits:amount});}
 const bets=Object.fromEntries(model.vars.map(k=>[k,(index+r)%4]));
 const scoring=engine.scoreRound({round:r,practices:names,consequence,attention,target,bets,before,after:state.metrics,credits,elapsedSeconds:90+index%80});
 const previous=state.history.map(h=>h.scoring.totalNoDebt);
 state.baseScore=Math.round((previous.reduce((a,b)=>a+b,0)+scoring.totalNoDebt)/(previous.length+1));
 state.score=Math.max(0,state.baseScore-Math.min(50,Math.round(state.borrowed*.4)));
 state.spent+=credits;
 const h={id:`load-${index}-${r}`,round:r,target,audience:index%2?'Equipos':'Líderes',practices:names,credits,hypothesis:'Si priorizamos estas intervenciones según las señales del caso, esperamos mejorar el comportamiento sin sobrecargar la organización.',consequence,before,after:{...state.metrics},attention,bets,scoring,score:state.score,baseScore:state.baseScore,borrowed:state.borrowed,business:state.business,spent:state.spent,decidedAt:new Date().toISOString()};
 state.history.push(h);state.evolution.push({label:'R'+r,metrics:{...state.metrics},business:state.business});
 return h;
}
async function scenario(size){
 const result={teams:size,mode:'guided',rounds:5,errors:[],roundResults:[],startedAt:new Date().toISOString()};
 let env,stops=[];
 const lag=monitorEventLoopDelay({resolution:20});lag.enable();
 try{
 env=await initializeTestEnvironment({projectId,firestore:{host,port,rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')}});
 const roomCode='LOAD-'+size+'-'+Date.now(),hostClient=client(env,'host-'+roomCode,true);
 await hostClient.api.createRoom(roomCode,'guided');
 const clients=Array.from({length:size},(_,i)=>client(env,'team-'+size+'-'+i));
 let hostRows=[],hostSeen=0,hostEvents=0,rankingEvents=0,roomEvents=0,docRowsDelivered=0;
 let expected=null,burstAt=null,hostAt=null,rankDone=new Map(),hostSnapshotLatency=[],latestRankings=new Map();
 const fail=e=>result.errors.push(String(e?.message||e));
 stops.push(await hostClient.api.subscribeRoom(roomCode,(rows)=>{
   hostEvents++;hostRows=rows;
   if(expected&&rows.length===size&&rows.every(r=>r.gameState?.history?.at(-1)?.id===expected.get(r.id)?.id)){
     hostSeen=expected.round;
     if(hostAt===null){hostAt=mark();hostSnapshotLatency.push(hostAt-burstAt);}
   }
 },fail));
 const joinTimes=[];
 const start=mark();
 const joined=await Promise.allSettled(clients.map(async(c,i)=>{const t=mark();await c.api.join(roomCode,'Equipo '+String(i+1).padStart(3,'0'),c.state);joinTimes.push(mark()-t);}));
 joined.forEach(r=>{if(r.status==='rejected')fail(r.reason);});
 result.join={...stats(joinTimes),total_ms:round(mark()-start)};
 if(result.errors.length)throw Error('Fallo de ingreso; se cancela este escenario.');
 clients.forEach(c=>{
   c.api.ranking(roomCode,rows=>{
     rankingEvents++;docRowsDelivered+=rows.length;latestRankings.set(c.uid,rows);
     if(expected&&rows.length===size&&rows.every(r=>r.score===expected.get(r.id)?.score&&r.round===expected.round)&&!rankDone.has(c.uid))rankDone.set(c.uid,mark()-burstAt);
   },fail);
   stops.push(()=>c.api.stopRanking());
   stops.push(c.api.watchRoom(roomCode,()=>{roomEvents++;},fail));
 });
 await waitUntil(()=>hostRows.length===size&&latestRankings.size===size,'conexión de listeners');
 for(let r=1;r<=5;r++){
   const states=clients.map((c,i)=>{c.state.round=r-1;decision(c.state,i,r);return clone(c.state);});
   expected=new Map(clients.map((c,i)=>[c.uid,{id:states[i].history.at(-1).id,score:states[i].score}]));expected.round=r;
   rankDone=new Map();hostAt=null;hostSeen=0;burstAt=mark();
   const latencies=[];
   const saves=await Promise.allSettled(clients.map(async(c,i)=>{const t=mark();await c.api.save(roomCode,'Equipo '+String(i+1).padStart(3,'0'),states[i]);latencies.push(mark()-t);}));
   const rejected=saves.filter(x=>x.status==='rejected');rejected.forEach(x=>fail(x.reason));
   if(rejected.length)throw Error('Fallo en guardado concurrente.');
   await waitUntil(()=>rankDone.size===size&&hostSeen===r,'convergencia de ranking y facilitador en R'+r);
   const entry={round:r,saved:latencies.length,save:stats(latencies),rankingFanout:stats([...rankDone.values()]),facilitator_ms:round(hostAt-burstAt),allObserved_ms:round(mark()-burstAt)};
   result.roundResults.push(entry);console.log(JSON.stringify({type:'round',teams:size,...entry}));
   await hostClient.api.controlRoom(roomCode,'discussion');
   // Comprobar que se conserva el cierre antes de habilitar otra ronda.
   if(r<5)await hostClient.api.controlRoom(roomCode,'next');
 }
 // Lectura confirmada desde el servidor y comprobación íntegra al terminar.
 const final=await hostClient.db.collection('nexus_rooms').doc(roomCode).collection('teams').get({source:'server'});
 const ranking=await hostClient.db.collection('nexus_rooms').doc(roomCode).collection('ranking').get({source:'server'});
 result.integrity={teams:final.size,decisions:final.docs.reduce((sum,d)=>sum+d.data().gameState.history.length,0),allHaveFiveRounds:final.docs.every(d=>d.data().gameState.history.length===5),rankingConsistent:ranking.docs.every(d=>d.data().score===final.docs.find(x=>x.id===d.id).data().score)};
 result.events={rankingCallbacks:rankingEvents,roomCallbacks:roomEvents,facilitatorCallbacks:hostEvents,rankingRowsDelivered:docRowsDelivered};
 result.payloadBytes={teamDocumentMax:Math.max(...final.docs.map(d=>Buffer.byteLength(JSON.stringify(d.data())))),totalTeamDocuments:final.docs.reduce((n,d)=>n+Buffer.byteLength(JSON.stringify(d.data())),0)};
 result.ok=result.errors.length===0&&result.integrity.allHaveFiveRounds&&result.integrity.rankingConsistent;
 result.roomCode=roomCode;
 }catch(e){result.ok=false;result.errors.push(String(e?.message||e));}
 finally{
   for(const stop of stops)try{stop();}catch{}
   if(env)await env.cleanup();lag.disable();
   result.eventLoop={p95_ms:round(lag.percentile(95)/1e6),max_ms:round(lag.max/1e6)};
   result.memoryRSS_mb=round(process.memoryUsage().rss/1024/1024);result.finishedAt=new Date().toISOString();
 }
 return result;
}
async function main(){
 const report={test:'NEXUS isolated concurrency',projectId,emulator:`${host}:${port}`,sourceCommit:process.env.NEXUS_SOURCE_COMMIT||null,node:process.version,firebase:require('firebase/package.json').version,rulesUnitTesting:require('@firebase/rules-unit-testing/package.json').version,environment:{cpus:os.cpus().length,totalMemoryGB:round(os.totalmem()/1024**3)},limitations:['Local Firestore emulator, not the production service.','One Node process creates independent authenticated SDK clients; not separate physical browsers.','Authentication provider throughput, Internet latency and rendering are outside this test.'],scenarios:[]};
 for(const size of sizes){
   console.log(JSON.stringify({type:'start',teams:size}));
   const result=await scenario(size);report.scenarios.push(result);fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({type:'scenario',...result}));
   if(!result.ok)break;
 }
 console.log(JSON.stringify({type:'complete',output,results:report.scenarios.map(s=>({teams:s.teams,ok:s.ok,errors:s.errors}))}));
 if(report.scenarios.some(s=>!s.ok))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={decision,model};
