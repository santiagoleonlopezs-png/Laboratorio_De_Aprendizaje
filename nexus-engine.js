/* NEXUS · reglas de avance, puntaje explicable y lectura de decisiones. */
(function(root){
'use strict';
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const dimensions=['Conciencia','Confianza','Energía','Compromiso','Conocimiento','Capacidad','Apropiación'];
const critical=[['Conciencia','Confianza'],['Capacidad','Confianza'],['Confianza','Compromiso'],['Capacidad','Energía'],['Energía','Apropiación']];
function roomConfig(room){return {...room,mode:room?.mode==='guided'?'guided':'autonomous',currentRound:clamp(room?.currentRound||1,1,5),phase:room?.phase==='discussion'?'discussion':'deciding'};}
function canPlay(state,room){
 if(!state||!room||room.status!=='open')return false;
 const r=roomConfig(room),round=state.round+1;
 if((state.history||[]).some(h=>h.round===round)||round>5)return false;
 return r.mode==='autonomous'||(r.phase==='deciding'&&round<=r.currentRound);
}
function scoreRound({round,practices,consequence={},attention={},target,bets={},before={},after={},credits=0,elapsedSeconds=0}){
 const count=practices.length||1;
 const high=consequence.high?.length||0,medium=consequence.medium?.length||0,low=consequence.low?.length||0;
 const irrelevant=consequence.irrelevant?.length||0,bad=consequence.counterproductive?.length||0;
 const fit=clamp((high+medium*.65+low*.25-bad*.25)/count,0,1);
 const focus=critical[round-1]||critical[0];
 const diagnosticShare=focus.reduce((s,k)=>s+(Number(attention[k])||0),0)/100;
 const diagnosis=clamp(diagnosticShare/.65,0,1)*.75+(focus.includes(target)? .25:0);
 const error=dimensions.reduce((s,k)=>s+Math.abs((Number(bets[k])||0)-((after[k]||0)-(before[k]||0))),0)/dimensions.length;
 const delta=dimensions.reduce((s,k)=>s+(after[k]||0)-(before[k]||0),0);
 const overload=(practices.length>=3?6:0)+(credits>=70?8:0)+((before.Energía||0)<45&&practices.length>=2?6:0);
 const wrong=Math.min(20,irrelevant*7+bad*12);
 const seconds=Math.max(0,Number(elapsedSeconds)||0);
 const speedEligible=fit>=.65&&diagnosis>=.45;
 const points={relevance:Math.round(40*fit),diagnosis:Math.round(20*diagnosis),forecast:Math.round(10*clamp(1-error/15,0,1)),impact:Math.round(clamp(7.5+delta/4,0,15)),focus:practices.length<=2&&credits<=60?10:4,speed:speedEligible?Math.round(5*clamp(1-seconds/420,0,1)):0};
 const delay=speedEligible?Math.min(3,Math.floor(Math.max(0,seconds-420)/120)):0;
 const totalNoDebt=Math.round(clamp(Object.values(points).reduce((a,b)=>a+b,0)-overload-wrong-delay));
 const feedback=[];
 if(high)feedback.push(`${high} de ${count} acciones respondieron bien a las señales de la ronda.`);
 if(medium)feedback.push(`${medium} acciones aportaron de forma complementaria.`);
 if(low||irrelevant||bad)feedback.push(`${low+irrelevant+bad} acciones tuvieron poca pertinencia o efectos adversos. Prioriza antes de añadir otra.`);
 feedback.push(focus.includes(target)?`El objetivo elegido coincide con un foco crítico: ${focus.join(' y ')}.`:`El objetivo se alejó de las señales centrales: revisa ${focus.join(' y ')}.`);
 if(overload)feedback.push(`La carga de intervención restó ${overload} puntos: ${practices.length} acciones, ${credits} créditos y energía inicial de ${Math.round(before.Energía||0)}/100.`);
 if(points.speed)feedback.push(`Decidieron con agilidad y pertinencia: +${points.speed} puntos. El tiempo de conversación no se cuenta.`);
 if(!speedEligible)feedback.push('La rapidez no sumó: primero debe haber pertinencia y un diagnóstico alineado con las señales.');
 if(delay)feedback.push(`El tiempo de decisión restó ${delay} puntos; no hay cierre automático por tiempo.`);
 feedback.push(`Para la próxima: ${overload?'reduce la carga y conserva las acciones esenciales':fit<.65?'contrasta cada acción con las señales del caso':'revisa los indicadores que bajaron y ajusta tu predicción'}.`);
 return {version:2,points,penalties:{overload,wrong,delay},totalNoDebt,elapsedSeconds:Math.round(seconds),critical:focus,feedback};
}
function snapshot(row,round){
 const history=row.gameState?.history||[];
 const h=history.find(x=>x.round===round);if(!h)return null;
 const previous=history.find(x=>x.round===round-1);
 return {team:row.team,id:row.id,round,decision:h,score:Number.isFinite(h.score)?h.score:null,previousScore:Number.isFinite(previous?.score)?previous.score:null,borrowed:h.borrowed??null};
}
function roundRanking(rows,round){
 let last=null,place=0;
 return rows.map(r=>snapshot(r,round)).filter(Boolean).sort((a,b)=>(b.score??-1)-(a.score??-1)||String(a.team).localeCompare(String(b.team))).map((r,i)=>{if(r.score!==last||i===0)place=i+1;last=r.score;return {...r,place};});
}
function analyzeRound(rows,round){
 const entries=roundRanking(rows,round),n=entries.length;
 if(!n)return {count:0,patterns:[],questions:[],entries};
 const counts={};entries.forEach(e=>(e.decision.practices||[]).forEach(p=>counts[p]=(counts[p]||0)+1));
 const most=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]||['Sin acciones registradas',0];
 const overload=entries.filter(e=>e.decision.scoring?.penalties?.overload>0||e.decision.credits>=70).length;
 const fatigue=entries.filter(e=>e.decision.after?.Energía<e.decision.before?.Energía).length;
 const mismatched=entries.filter(e=>!(critical[round-1]||[]).includes(e.decision.target)).length;
 const lowfit=entries.filter(e=>(e.decision.consequence?.low?.length||0)+(e.decision.consequence?.irrelevant?.length||0)+(e.decision.consequence?.counterproductive?.length||0)>0).length;
 const patterns=[{title:'La elección más frecuente',text:`${most[0]} apareció en ${most[1]} de ${n} decisiones. Coincidir no demuestra que sea la mejor opción.`}];
 if(overload)patterns.push({title:'Carga de intervención',text:`${overload} de ${n} equipos concentraron muchas acciones o recursos en esta ronda.`});
 if(fatigue)patterns.push({title:'El costo sobre la energía',text:`La energía cayó en ${fatigue} de ${n} equipos. Conviene mirar qué mejoró a costa de ese esfuerzo.`});
 if(mismatched)patterns.push({title:'Foco de la decisión',text:`${mismatched} de ${n} equipos priorizaron una dimensión distinta de los focos del caso: ${(critical[round-1]||[]).join(' y ')}.`});
 if(lowfit)patterns.push({title:'Oportunidad de las acciones',text:`${lowfit} de ${n} equipos eligieron al menos una acción de pertinencia baja o con efectos adversos.`});
 const first=entries[0],lastEntry=entries[entries.length-1];
 const questions=[`¿Qué señal del caso les llevó a elegir ${most[0]}? ¿Qué evidencia habría cambiado esa decisión?`,overload?'Si solo pudieran mantener una acción, ¿cuál conservarían y cuál retirarían para reducir la saturación?':'¿Cuál fue la acción mínima que produjo un avance útil? ¿Cómo comprobarían su efecto?',fatigue?'¿Qué resultado mejoró mientras caía la energía? ¿Sería sostenible repetir esa estrategia?':'¿Qué costo o efecto tardío podría estar oculto detrás de la mejora?',`¿Qué anticiparon en su apuesta y qué ocurrió realmente en ${(critical[round-1]||[]).join(' y ')}?`];
 if(n>1&&first.score!==null&&lastEntry.score!==null&&first.score!==lastEntry.score)questions.push(`Comparen ${first.team} (${first.score}/100) y ${lastEntry.team} (${lastEntry.score}/100): ¿qué diferencias de foco, carga y oportunidad explican los puntajes?`);
 return {count:n,patterns,questions,entries};
}
const api={roomConfig,canPlay,scoreRound,roundRanking,analyzeRound,critical};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.NEXUS_ENGINE=api;
})(typeof window!=='undefined'?window:globalThis);
