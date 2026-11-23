(function(root){
 'use strict';
 const D=root.MESA_DATA||(typeof require==='function'?require('./mesa-acuerdos-data.js'):null);
 const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
 const initial=()=>({trust:50,rights:65,operation:60});
 const actorInitial=()=>Object.fromEntries(D.roleIds.map(r=>[r,[50,50,50]]));
 function readiness(members,seats){
  const active=members.filter(m=>m.active&&D.roleIds.includes(m.role));
  const ids=D.roleIds.map(r=>seats[r]?.uid);
  const missing=D.roleIds.filter(r=>!active.some(m=>m.role===r&&m.uid===seats[r]?.uid));
  return {ready:active.length>=3&&new Set(ids).size===3&&missing.length===0,count:active.length,missing};
 }
 function validOffer(o,round){
  return !!o&&o.round===round&&D.roleIds.includes(o.role)&&D.rounds[round-1]?.routes.some(r=>r.id===o.route)
   &&['benefits','operations','implementation'].every(k=>Number.isInteger(o[k])&&o[k]>=0&&o[k]<=100)
   &&o.benefits+o.operations+o.implementation<=100&&o.benefits+o.operations+o.implementation>0
   &&Number.isInteger(o.days)&&o.days>=1&&o.days<=60&&D.roleIds.includes(o.owner)
   &&['weekly','monthly','none'].includes(o.monitor)&&['dialogue','conditional','pressure'].includes(o.style)
   &&typeof o.argument==='string'&&o.argument.trim().length>=20&&o.argument.length<=600
   &&typeof o.commitment==='string'&&o.commitment.trim().length>=12&&o.commitment.length<=350;
 }
 function agreement(round,offers,positions){
  const e=positions.employer,u=positions.union;
  const chosen=e&&u&&e.response==='accept'&&u.response==='accept'&&e.offerId===u.offerId
   ?offers.find(o=>o.id===e.offerId&&o.round===round&&validOffer(o,round)):null;
  return {agreed:!!chosen,offer:chosen||null,reviewed:!!chosen&&positions.hr?.response==='review'&&positions.hr.offerId===chosen.id};
 }
 function rank(values){
  const rows=D.roleIds.map(role=>({role,score:Math.round(Number(values[role])||0)})).sort((a,b)=>b.score-a.score||D.roleIds.indexOf(a.role)-D.roleIds.indexOf(b.role));
  rows.forEach((r,i)=>r.position=i&&r.score===rows[i-1].score?rows[i-1].position:i+1);return rows;
 }
 function settle({round,offers,positions={},briefs,shared=initial(),metrics=actorInitial(),totals={}}){
  const c=D.rounds[round-1];if(!c)throw Error('Ronda inválida.');
  const valid=offers.filter(o=>validOffer(o,round));
  const a=agreement(round,valid,positions),actors={};
  const latest=role=>valid.filter(o=>o.role===role).sort((x,y)=>y.revision-x.revision)[0];
  const quality=o=>c.routes.find(r=>r.id===o?.route)?.quality??0;
  const adopted=a.offer,adoptedQuality=quality(adopted);
  const sharedAfter={
   trust:Math.round(clamp(shared.trust+(a.agreed?(adoptedQuality===1?7:adoptedQuality>0?-3:-11):0)+(a.reviewed?2:0))),
   rights:Math.round(clamp(shared.rights+(a.agreed?(adoptedQuality===1?5:adoptedQuality>0?-4:-18):0))),
   operation:Math.round(clamp(shared.operation+(a.agreed?adopted.operations>=20?5:-6:-2)))
  };
  for(const role of D.roleIds){
   const own=latest(role),p=positions[role];
   const endorsed=p&&['accept','review'].includes(p.response)?valid.find(o=>o.id===p.offerId):null;
   const choice=endorsed||own,b=briefs[role];if(!b)throw Error('Falta la información del actor.');
   const q=quality(choice),cost=choice?choice.benefits+choice.operations+choice.implementation:0;
   const cooperation=choice?(choice.style==='dialogue'?15:choice.style==='conditional'?10:0):0;
   const feasible=choice?cost<=b.ceiling?15:5:0;
   const implementation=choice?(choice.days<=30?5:2)+(choice.monitor==='weekly'?5:choice.monitor==='monthly'?3:0)+(choice.implementation>=b.execution?5:1):0;
   const objectiveFit=choice?(role==='employer'?(choice.operations>=b.operations?1:.35)*.55+(cost<=b.ceiling?1:.2)*.45
    :role==='union'?(choice.benefits>=b.benefits?1:.35)*.65+q*.35
    :(choice.implementation>=b.execution?1:.25)*.5+(choice.days<=b.deadline?1:.4)*.25+q*.25):0;
   const achieved=a.agreed&&q===1&&endorsed?.id===adopted?.id;
   const objective=Math.round(20*objectiveFit*(achieved?1:.7));
   const breakdown={legal:Math.round(35*q),objective,cooperation,feasibility:feasible,implementation};
   const gross=Object.values(breakdown).reduce((s,v)=>s+v,0);
   const points=choice?Math.round(q===0?Math.min(20,gross):clamp(gross)):0;
   const penalty=gross-points;
   const route=c.routes.find(r=>r.id===choice?.route);
   const feedback=[];
   if(!choice)feedback.push('No quedó una propuesta propia ni un respaldo registrado. La ronda se conserva con 0 puntos para este actor.');
   else{
    feedback.push(route.feedback);
    feedback.push(`Decisiones jurídicas: ${breakdown.legal}/35. Cooperación: ${cooperation}/15 según el estilo de negociación registrado.`);
    feedback.push(cost<=b.ceiling?`La propuesta usa ${cost} créditos y respeta el límite de ${b.ceiling} conocido por tu actor.`:`La propuesta usa ${cost} créditos y supera el límite de ${b.ceiling} de tu información reservada.`);
    feedback.push(achieved?'El acuerdo respaldado permite reconocer el logro de tus objetivos de esta ronda.':'Se reconoce la preparación de tus objetivos; las mejoras aún no se consideran materializadas para tu actor.');
    if(!a.agreed&&q===1)feedback.push('El desacuerdo conserva los puntos de una ruta fundada, cooperativa y viable. No se exige aceptar una propuesta perjudicial.');
    if(p?.response==='reject')feedback.push('Tu desacuerdo y su motivo quedaron registrados para la conversación.');
    if(penalty)feedback.push(`La ruta que vulnera garantías limita el puntaje a 20: se descontaron ${penalty} puntos.`);
    if(a.agreed&&!a.reviewed)feedback.push('Empleador y sindicato coincidieron; falta revisión favorable de Gestión Humana sobre esa misma versión.');
   }
   const previous=metrics[role]||[50,50,50];
   const delta=choice?role==='employer'?[cost<=b.ceiling?6:-9,a.agreed?(choice.operations>=b.operations?6:-5):0,a.agreed?(implementation>=12?5:-4):0]
    :role==='union'?[cooperation>=10?5:-7,achieved&&choice.benefits>=b.benefits?8:0,q===1?6:q===0?-15:-3]
    :[cooperation>=10?6:-7,q===1?6:q===0?-14:-3,implementation>=12?7:-5]:[-3,-3,-3];
   if(q===0&&choice)delta[2]-=5;
   const next=previous.map((v,i)=>Math.round(clamp(v+delta[i])));
   actors[role]={points,total:(Number(totals[role])||0)+points,breakdown,penalty,before:previous,metrics:next,feedback,offerId:choice?.id||'',next:!choice?'Registra una propuesta y tu posición antes del cierre.':q<1?'Revisa el fundamento de la ruta antes de volver a respaldarla.':implementation<12?'Asigna capacidad suficiente, un plazo realista y seguimiento al compromiso.':'Pregunta qué prioridad de la contraparte puede atenderse sin afectar las garantías.'};
  }
  return {round,agreement:a.agreed,agreedOfferId:a.offer?.id||'',reviewed:a.reviewed,sharedBefore:shared,sharedAfter,actors,ranking:rank(Object.fromEntries(D.roleIds.map(r=>[r,actors[r].points]))),cumulativeRanking:rank(Object.fromEntries(D.roleIds.map(r=>[r,actors[r].total])))};
 }
 function makeBriefs(random=Math.random){
  const n=(min,max)=>min+Math.floor(random()*(max-min+1));
  return Object.fromEntries(D.roleIds.map(role=>[role,{role,ceiling:role==='employer'?n(80,95):100,benefits:role==='union'?n(30,42):25,execution:role==='hr'?n(16,22):12,operations:role==='employer'?n(24,34):20,deadline:role==='hr'?n(18,28):30}]));
 }
 const api={clamp,initial,actorInitial,readiness,validOffer,agreement,rank,settle,makeBriefs};root.MESA_ENGINE=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
