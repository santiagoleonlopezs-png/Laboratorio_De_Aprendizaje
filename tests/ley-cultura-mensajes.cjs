'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const script=fs.readFileSync('ley-cultura.js','utf8');
const ctx=vm.createContext({
  document:{addEventListener(){}},
  sessionStorage:{getItem(){return null;}},
  crypto:crypto.webcrypto,
  console,
  Date
});
vm.runInContext(script,ctx,{filename:'ley-cultura.js'});
const S=vm.runInContext('S',ctx);
const rounds=vm.runInContext('LC_ROUNDS',ctx);
const show=(r,cond)=>vm.runInContext('messageForCondition('+r+',"'+cond+'")',ctx);
assert.notEqual(rounds[1].A,rounds[1].B,'Round 2 must contain distinct messages');
assert.match(rounds[1].A,/internamente/);
assert.match(rounds[1].B,/comunican los problemas/);
assert.equal(show(2,'A'),rounds[1].A);
assert.equal(show(2,'B'),rounds[1].B);
assert.notEqual(show(1,'A'),show(1,'B'));
assert.equal(show(2,'unknown'),null);
console.log('PASS: cada condición muestra un mensaje cultural diferente en rondas 1 y 2');

S.code='PRUEBA';S.mode='student';S.auth={currentUser:{uid:'estudiante-1'}};
S.myResponses={};
S.myAssignment={condition:'A'};
const htmlA=vm.runInContext('decisionFormHtml(2)',ctx);
S.myAssignment={condition:'B'};
const htmlB=vm.runInContext('decisionFormHtml(2)',ctx);
assert.ok(htmlA.includes(rounds[1].A) && !htmlA.includes(rounds[1].B));
assert.ok(htmlB.includes(rounds[1].B) && !htmlB.includes(rounds[1].A));
console.log('PASS: formulario de la ronda 2 presenta exclusivamente el mensaje A o B asignado');

const plan=(n,existing={})=>{
 const persons=Array.from({length:n},(_,i)=>({uid:'persona-'+i,name:'Persona '+i}));
 return vm.runInContext('planBalancedConditions',ctx)(persons,existing);
};
for(const n of [2,3,4,6,7,11,20]){
 const result=plan(n);
 assert.equal(result.plan.length,n);
 assert.equal(result.counts.A+result.counts.B,n);
 assert.ok(result.counts.A>=1&&result.counts.B>=1);
 assert.ok(Math.abs(result.counts.A-result.counts.B)<=1,'assignment imbalance for '+n);
 assert.equal(new Set(result.plan.map(x=>x.uid)).size,n);
}
const existing={'persona-0':{condition:'A'},'persona-1':{condition:'B'}};
const later=plan(5,existing);
assert.equal(later.plan.length,3);
assert.ok(later.plan.every(p=>p.uid!=='persona-0'&&p.uid!=='persona-1'));
assert.ok(Math.abs(later.counts.A-later.counts.B)<=1);
console.log('PASS: asignación balanceada y estable con participantes nuevos');

S.mode='host';
S.participants=[{uid:'persona-0',name:'Ana'},{uid:'persona-1',name:'Luis'}];
S.assignments={'persona-0':{condition:'A'},'persona-1':{condition:'B'}};
const audit=vm.runInContext('liveMessageAssignments(2)',ctx);
assert.ok(audit.includes('Ana')&&audit.includes('Luis'));
assert.ok(audit.includes(rounds[1].A)&&audit.includes(rounds[1].B));
console.log('PASS: el facilitador ve a quién se asignó cada mensaje de la ronda 2');