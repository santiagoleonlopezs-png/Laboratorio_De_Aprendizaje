'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../mesa-acuerdos-data.js'),E=require('../mesa-acuerdos-engine.js'),X=require('../mesa-salas-engine.js');
const members=n=>Array.from({length:n},(_,i)=>({uid:'u'+i,name:'Persona '+i,active:true}));
function setup(n){const ms=members(n),a=X.distribute(ms),list=Object.values(X.validateAssignments(ms,a))[0],roster=list.map(x=>x.uid),roles=Object.fromEntries(list.map(x=>[x.uid,x.role]));return {roster,roles,byRole:Object.fromEntries(D.roleIds.map(r=>[r,roster.filter(uid=>roles[uid]===r)])),people:Object.fromEntries(roster.map(uid=>[uid,X.initialPerson()])),round:1,shared:E.initial()};}
const offer=(uid,role,route='listen')=>({id:'1_'+uid+'_1',uid,role,round:1,revision:1,route,benefits:35,operations:30,implementation:20,days:20,owner:'hr',monitor:'weekly',style:'dialogue',argument:'Una propuesta fundada que protege garantías y permite verificar compromisos.',commitment:'Revisar semanalmente los compromisos en una reunión.'});
test('distribuye a todos sin dejar observadores, con tres roles y grupos de 3 a 5',()=>{
 for(let n=3;n<=60;n++){const a=X.distribute(members(n)),groups=X.validateAssignments(members(n),a);assert.equal(a.length,n);assert.equal(new Set(a.map(x=>x.uid)).size,n);assert.ok(Object.values(groups).every(g=>g.length>=3&&g.length<=5&&D.roleIds.every(r=>g.some(a=>a.role===r))));}
 const sizes=n=>Object.values(X.validateAssignments(members(n),X.distribute(members(n)))).map(x=>x.length);
 assert.deepEqual(sizes(7),[4,3]);assert.deepEqual(sizes(8),[4,4]);assert.deepEqual(sizes(5),[5]);assert.throws(()=>X.distribute(members(2)));
 assert.equal(D.roles.employer.name,'Gerencia');
});
test('un rol repetido requiere respaldo coincidente y conserva la divergencia',()=>{
 const t=setup(4),s=X.blankRound(1),o=offer(t.roster[0],'employer');
 for(const uid of t.roster)s.positions[uid]={response:t.roles[uid]==='hr'?'review':'accept',offer:o};
 assert.equal(X.resolve(t,s).agreed,true);assert.equal(X.resolve(t,s).reviewed,true);
 const other=t.byRole.employer[1];s.positions[other]={response:'reject',offer:o};assert.equal(X.resolve(t,s).agreed,false);assert.equal(X.posture(t,s,'employer').divided,true);
 s.positions[other]={response:'accept',offer:{...o,id:o.id+'-otra',revision:2}};assert.equal(X.resolve(t,s).agreed,false,'una ruta igual en otra versión no es el mismo acuerdo');
});
test('cinco personas: la mayoría de tres que comparten rol no borra la decisión disidente',()=>{
 const t=setup(5);t.roles.u4='employer';t.byRole=Object.fromEntries(D.roleIds.map(r=>[r,t.roster.filter(uid=>t.roles[uid]===r)]));const s=X.blankRound(1),o=offer('u0','employer');
 for(const uid of t.roster)s.positions[uid]={response:t.roles[uid]==='hr'?'review':'accept',offer:o};
 s.positions.u4={response:'reject',offer:o};s.offers.u4=offer('u4','employer','condition');
 assert.equal(X.resolve(t,s).agreed,true);assert.equal(X.posture(t,s,'employer').supported,2);
 assert.ok(X.evaluate(t,s,'u4',E.makeBriefs(()=>.5).employer).actor.points<=20);
});
test('dos personas del mismo rol obtienen resultados propios en la misma ronda',()=>{
 const t=setup(4),s=X.blankRound(1),[a,b]=t.byRole.employer;
 s.offers[a]=offer(a,'employer','listen');s.offers[b]=offer(b,'employer','condition');
 const brief=E.makeBriefs(()=>.5).employer,good=X.evaluate(t,s,a,brief),bad=X.evaluate(t,s,b,brief);
 assert.ok(good.actor.points>bad.actor.points);assert.ok(bad.actor.points<=20);assert.notDeepEqual(good.actor.metrics,bad.actor.metrics);
 assert.equal(X.evaluate(t,s,t.byRole.hr[0],E.makeBriefs(()=>.5).hr).actor.points,0);
});
test('el cierre autónomo incluye a la cuarta persona y los empates comparten puesto',()=>{
 const t=setup(4),s=X.blankRound(1);t.roster.slice(0,3).forEach(uid=>s.readyClose[uid]=true);assert.equal(X.allReady(t,s,'close'),false);s.readyClose[t.roster[3]]=true;assert.equal(X.allReady(t,s,'close'),true);
 assert.deepEqual(X.rank([{uid:'a',total:40},{uid:'b',total:40},{uid:'c',total:10}]).map(x=>x.position),[1,1,3]);
});
