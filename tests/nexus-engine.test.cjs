const {test}=require('node:test');
const assert=require('node:assert/strict');
const e=require('../nexus-engine.js');
const keys=['Conciencia','Confianza','Energía','Compromiso','Conocimiento','Capacidad','Apropiación'];
const before=Object.fromEntries(keys.map(k=>[k,60]));
const after=Object.fromEntries(keys.map(k=>[k,62]));
const good={round:1,practices:['ADKAR'],consequence:{high:['ADKAR']},attention:{Conciencia:40,Confianza:40,Energía:20},target:'Conciencia',bets:Object.fromEntries(keys.map(k=>[k,2])),before,after,credits:20,elapsedSeconds:90};
test('Una decisión pertinente vence a una rápida pero inoportuna',()=>{
 const a=e.scoreRound(good),b=e.scoreRound({...good,consequence:{irrelevant:['ADKAR']},elapsedSeconds:1});
 assert.ok(a.totalNoDebt>b.totalNoDebt);assert.equal(b.points.speed,0);assert.ok(a.points.speed>0);
});
test('Tres intervenciones grandes saturan aunque sean pertinentes',()=>{
 const focused=e.scoreRound(good),saturated=e.scoreRound({...good,practices:['Co-creación','Aprendizaje experiencial','Coaching'],consequence:{high:['Co-creación','Aprendizaje experiencial','Coaching']},credits:110});
 assert.equal(saturated.penalties.overload,16);assert.ok(saturated.totalNoDebt<focused.totalNoDebt);
 assert.ok(saturated.feedback.some(f=>f.includes('carga')));
});
test('Energía baja agrava la carga de dos intervenciones',()=>{
 const r=e.scoreRound({...good,practices:['Co-creación','Coaching'],consequence:{high:['Co-creación','Coaching']},before:{...before,Energía:40}});
 assert.equal(r.penalties.overload,8);
});
test('La predicción cercana suma y el diagnóstico equivocado no gana rapidez',()=>{
 assert.ok(e.scoreRound(good).points.forecast>e.scoreRound({...good,bets:{Conciencia:-15}}).points.forecast);
 assert.equal(e.scoreRound({...good,attention:{Apropiación:100},target:'Apropiación'}).points.speed,0);
});
test('Velocidad solo durante decisión: el tiempo elegible suma poco y demora no cierra',()=>{
 const fast=e.scoreRound({...good,elapsedSeconds:20}),slow=e.scoreRound({...good,elapsedSeconds:900});
 assert.ok(fast.points.speed<=5);assert.equal(slow.penalties.delay,3);assert.ok(slow.totalNoDebt>=0);
});
test('Avance dirigido se bloquea en conversación y espera la apertura de la siguiente ronda',()=>{
 const room={status:'open',mode:'guided',currentRound:1,phase:'deciding'};
 assert.equal(e.canPlay({round:0,history:[]},room),true);
 assert.equal(e.canPlay({round:1,history:[{round:1}]},room),false);
 assert.equal(e.canPlay({round:0,history:[]},{...room,phase:'discussion'}),false);
 assert.equal(e.canPlay({round:0,history:[{round:1}]},room),false);
 assert.equal(e.canPlay({round:1,history:[{round:1}]},{...room,currentRound:2}),true);
 assert.equal(e.canPlay({round:4,history:[]},{...room,mode:'autonomous'}),true);
 assert.equal(e.canPlay({round:1,history:[]},null),false);
});
test('Las salas existentes conservan la modalidad autónoma',()=>assert.equal(e.roomConfig({status:'open'}).mode,'autonomous'));
test('El ranking histórico usa el cierre de la ronda y conserva empates',()=>{
 const make=(team,scores)=>({team,id:team,gameState:{history:scores.map((score,i)=>({round:i+1,score,practices:['ADKAR'],target:'Conciencia'}))}});
 const rows=[make('a',[80,10]),make('b',[60,95]),make('c',[80,40])];
 const r=e.roundRanking(rows,1);assert.deepEqual(r.map(x=>[x.team,x.place]),[['a',1],['c',1],['b',3]]);
 assert.equal(e.roundRanking(rows,2)[0].team,'b');assert.equal(e.roundRanking(rows,3).length,0);
});
test('Las preguntas responden a la evidencia de la ronda y no inventan datos históricos',()=>{
 const r={team:'NOVA',gameState:{history:[{round:1,practices:['ADKAR'],credits:85,scoring:{penalties:{overload:12}},target:'Capacidad',before:{Energía:60},after:{Energía:40}}]}};
 const a=e.analyzeRound([r],1);assert.equal(a.count,1);assert.ok(a.patterns.some(p=>p.title.includes('energía')));assert.ok(a.questions.some(q=>q.includes('saturación')));assert.equal(a.entries[0].score,null);
 assert.equal(e.analyzeRound([r],5).count,0);
});
test('El puntaje siempre se mantiene entre cero y cien',()=>{
 for(let i=0;i<=900;i+=30){const r=e.scoreRound({...good,elapsedSeconds:i,credits:i,consequence:{counterproductive:['ADKAR']}});assert.ok(r.totalNoDebt>=0&&r.totalNoDebt<=100);}
});

test('Tres acciones pequeñas caben y no reciben penalización por cantidad',()=>{
 const practices=['ADKAR','TRIZ','Reconocimiento'];
 const score=e.scoreRound({...good,practices,consequence:{high:practices},credits:60});
 assert.equal(score.exertion.load,3);assert.equal(score.penalties.overload,0);assert.equal(score.points.focus,10);
});
test('Una combinación mediana y dos pequeñas se evalúa por la suma de carga',()=>{
 const load=e.interventionLoad(['Lean Change','ADKAR','Reconocimiento'],{Energía:60,Capacidad:50});
 assert.equal(load.load,4);assert.equal(load.capacity,5);assert.equal(load.excess,0);
});
test('La misma carga puede caber con energía alta y saturar con energía baja',()=>{
 const names=['Co-creación','Aprendizaje experiencial'];
 assert.equal(e.interventionLoad(names,{Energía:75,Capacidad:50}).penalty,0);
 assert.equal(e.interventionLoad(names,{Energía:40,Capacidad:50}).penalty,8);
});
test('No deduce saturación solo por gastar créditos',()=>{
 const practices=['ADKAR','TRIZ','Reconocimiento'];
 assert.equal(e.scoreRound({...good,practices,consequence:{high:practices},credits:90}).penalties.overload,0);
});
