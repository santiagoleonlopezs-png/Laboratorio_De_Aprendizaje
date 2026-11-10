// NEXUS · prueba local reproducible (no equivale a medir Firebase en producción).
// Ejecutar desde el repositorio: node tests/nexus-audit.cjs
'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const engine=require('../nexus-engine.js');
const actions=[
 'ADKAR','Plan de comunicaciones','Lean Change','Co-creación',
 'Aprendizaje experiencial','Reconocimiento','Capacitación','Redes de influencia',
 'Gestión Humana','Coaching','TRIZ','Escucha persuasiva',
 'Análisis anticipado del fracaso','Identificación de casos exitosos',
 'Coaching para líderes','Intenciones de implementación'
];
const dims=['Conciencia','Confianza','Energía','Compromiso','Conocimiento','Capacidad','Apropiación'];
const metrics=()=>({Conciencia:52,Confianza:58,Energía:72,Compromiso:44,Conocimiento:61,Capacidad:42,Apropiación:35});
let checks=0;
const check=(actual,expected)=>{assert.equal(actual,expected);checks++;};
const room=(phase,status='open',mode='guided',currentRound=1)=>({phase,status,mode,currentRound});
const state={round:0,history:[]};
check(engine.canPlay(state,room('waiting')),false);
check(engine.canPlay(state,room('deciding')),true);
check(engine.canPlay(state,room('discussion')),false);
check(engine.canPlay(state,room('waiting','resetting')),false);
check(engine.canPlay(state,room('discussion','completed')),false);
check(engine.canPlay(state,room('deciding','open','autonomous')),true);
check(engine.canPlay({...state,history:[{round:1}]},room('deciding')),false);
check(engine.canPlay({...state,round:1},room('deciding','open','guided',1)),false);
check(engine.canPlay({...state,round:1},room('deciding','open','guided',2)),true);
function score(practices,round){
 return engine.scoreRound({
  round,practices,consequence:{high:practices,medium:[],low:[],irrelevant:[],counterproductive:[]},
  before:metrics(),after:metrics(),attention:{Conciencia:50,Confianza:50},
  target:'Conciencia',bets:{},elapsedSeconds:120
 });
}
for(let round=1;round<=5;round++){
 for(let count=1;count<=actions.length;count++){
  const selected=actions.slice(0,count);
  const result=score(selected,round);
  assert.ok(Number.isInteger(result.totalNoDebt)&&result.totalNoDebt>=0&&result.totalNoDebt<=100);
  assert.ok(result.penalties.overload>=0&&result.penalties.overload<=45);
  check(result.exertion.actions.length,count);
 }
}
check(score(actions,1).penalties.overload,45);
check(score(['ADKAR'],1).penalties.overload,0);
function makeRows(n){
 return Array.from({length:n},(_,i)=>({
  id:'team-'+i,team:'Equipo '+i,score:i%101,
  gameState:{history:Array.from({length:5},(_,q)=>({
   id:i+'-'+q,round:q+1,score:(i*13+q*3)%101,borrowed:0,
   target:'Conciencia',audience:'Equipos',practices:actions.slice(0,1+(i+q)%16),
   hypothesis:'Hipótesis de la intervención',credits:20,
   before:metrics(),after:metrics(),scoring:score(actions.slice(0,1+(i+q)%16),q+1)
  }))}
 }));
}
const results=[];
for(const teams of [10,30,50,100,200,500]){
 const rows=makeRows(teams);
 const bytes=Buffer.byteLength(JSON.stringify(rows),'utf8');
 const durations=[];
 for(let n=0;n<15;n++){
  const t=performance.now();
  const report=engine.analyzeRound(rows,n%5+1);
  check(report.count,teams);
  durations.push(performance.now()-t);
 }
 durations.sort((a,b)=>a-b);
 results.push({equipos:teams,kB_JSON:Math.round(bytes/1024),analisis_ms_mediana:+durations[7].toFixed(3)});
}
console.log(JSON.stringify({correcto:true,verificaciones:checks,entorno:'motor local; sin conexión concurrente a Firestore',resultados:results},null,2));
