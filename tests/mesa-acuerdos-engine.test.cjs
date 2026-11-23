'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../mesa-acuerdos-engine.js'),D=require('../mesa-acuerdos-data.js');
const briefs=()=>E.makeBriefs(()=>.5);
const offer=(round=1,role='employer',patch={})=>({id:`${round}_${role}_1`,round,role,revision:1,route:D.rounds[round-1].routes.find(r=>r.quality===1).id,benefits:36,operations:30,implementation:20,days:20,owner:'hr',monitor:'weekly',style:'dialogue',argument:'Propuesta que protege garantías y permite verificar sus compromisos.',commitment:'Revisar los registros con la representación cada semana.',...patch});
const positions=id=>({employer:{response:'accept',offerId:id},union:{response:'accept',offerId:id},hr:{response:'review',offerId:id}});
test('el inicio exige tres personas distintas, activas y tres roles representados',()=>{
 const members=D.roleIds.map((role,i)=>({role,uid:'u'+i,active:true}));const seats=Object.fromEntries(members.map(m=>[m.role,{uid:m.uid}]));
 assert.equal(E.readiness(members,seats).ready,true);
 assert.equal(E.readiness(members.slice(0,2),seats).ready,false);
 assert.equal(E.readiness(members,{...seats,hr:{uid:'u0'}}).ready,false);
 assert.equal(E.readiness(members.map(m=>m.role==='hr'?{...m,active:false}:m),seats).ready,false);
 assert.equal(E.readiness([...members.slice(0,2),{uid:'u3',role:'union',active:true}],seats).ready,false);
});
test('un acuerdo requiere firmas sobre la misma versión; GH no sustituye a una parte',()=>{
 const a=offer(),b=offer(1,'union');
 assert.equal(E.agreement(1,[a,b],positions(a.id)).agreed,true);
 assert.equal(E.agreement(1,[a,b],{...positions(a.id),union:{response:'accept',offerId:b.id}}).agreed,false);
 assert.equal(E.agreement(1,[a],{employer:positions(a.id).employer,hr:positions(a.id).hr}).agreed,false);
 assert.equal(E.agreement(2,[a],positions(a.id)).agreed,false);
 assert.equal(E.agreement(1,[a],{...positions(a.id),hr:{response:'review',offerId:'old'}}).reviewed,false);
});
test('rechaza propuestas con presupuesto inválido y exige una elección del caso',()=>{
 assert.equal(E.validOffer(offer(),1),true);
 for(const patch of [{benefits:90},{days:0},{argument:''},{implementation:-1},{benefits:35.5},{route:'unrelated'},{operations:NaN}])assert.equal(E.validOffer(offer(1,'employer',patch),1),false);
});
test('el desacuerdo fundado recibe puntos; acordar una ruta lesiva no permite compensarlos con cooperación',()=>{
 const good=offer(),bad=offer(1,'union',{route:'condition'});
 const dissent=E.settle({round:1,offers:[good,bad],positions:{employer:{response:'reject',offerId:bad.id}},briefs:briefs()});
 assert.equal(dissent.agreement,false);assert.ok(dissent.actors.employer.points>=80);
 assert.equal(dissent.actors.employer.breakdown.legal,35);assert.equal(dissent.actors.union.points<=20,true);
 const agreed=E.settle({round:1,offers:[bad],positions:positions(bad.id),briefs:briefs()});
 assert.equal(agreed.agreement,true);assert.ok(D.roleIds.every(r=>agreed.actors[r].points<=20));assert.ok(agreed.sharedAfter.rights<agreed.sharedBefore.rights);
});
test('falta de intervención queda registrada con cero puntos y feedback',()=>{
 const x=E.settle({round:1,offers:[],positions:{},briefs:briefs()});
 assert.ok(D.roleIds.every(r=>x.actors[r].points===0&&x.actors[r].feedback.length));
});
test('los empates comparten posición; el acumulado se conserva durante seis rondas',()=>{
 assert.deepEqual(E.rank({employer:90,union:90,hr:70}).map(x=>x.position),[1,1,3]);
 let shared=E.initial(),metrics=E.actorInitial(),totals={};
 for(let round=1;round<=6;round++){
  const o=offer(round),x=E.settle({round,offers:[o],positions:positions(o.id),briefs:briefs(),shared,metrics,totals});
  for(const r of D.roleIds){assert.ok(Number.isFinite(x.actors[r].points));assert.ok(x.actors[r].points>=0&&x.actors[r].points<=100);assert.equal(x.actors[r].total,(totals[r]||0)+x.actors[r].points);assert.ok(x.actors[r].metrics.every(n=>n>=0&&n<=100));}
  shared=x.sharedAfter;metrics=Object.fromEntries(D.roleIds.map(r=>[r,x.actors[r].metrics]));totals=Object.fromEntries(D.roleIds.map(r=>[r,x.actors[r].total]));
 }
 assert.ok(D.roleIds.every(r=>totals[r]<=600));
});
test('todas las rutas se evalúan sin valores no finitos, con indicadores y límites consistentes',()=>{
 for(const c of D.rounds)for(const route of c.routes)for(const style of ['dialogue','conditional','pressure']){
  const o=offer(c.id,'employer',{route:route.id,style});const x=E.settle({round:c.id,offers:[o],positions:positions(o.id),briefs:briefs()});
  assert.ok(Object.values(x.sharedAfter).every(n=>Number.isFinite(n)&&n>=0&&n<=100));
  for(const r of D.roleIds){const a=x.actors[r];assert.equal(a.points,Object.values(a.breakdown).reduce((s,n)=>s+n,0)-a.penalty);if(route.quality===0)assert.ok(a.points<=20);}
 }
});
