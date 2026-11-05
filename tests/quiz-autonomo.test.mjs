import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../quiz-engine.mjs';

const source=fs.readFileSync(new URL('../quiz-autonomo.js',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'').replace('export function createSelfPacedQuiz','function createSelfPacedQuiz');
const questions=Array.from({length:3},(_,i)=>({title:'Pregunta',text:`Pregunta ${i}`,options:['A','B','C','D'],correct:i}));
function fixture(overrides={}){
 let now=1_000_000,serial=Promise.resolve();
 const run={mode:'self_paced',selfPacedStatus:'published',quizVersion:'v1',duration:10,totalDuration:120,selectedQuestions:[2,0],questions,...overrides};
 const store=new Map([['room',run]]),listeners=new Set();
 function snapshot(path){return {exists:()=>store.has(path),data:()=>structuredClone(store.get(path))};}
 function notify(){for(const listener of listeners)listener.callback(listener.path==='players'?{docs:[...store].filter(([p])=>p.startsWith('players/')).map(([path])=>({id:path.split('/')[1],data:()=>structuredClone(store.get(path))}))}:snapshot(listener.path));}
 function element(){return {textContent:'',disabled:false,value:'',style:{},children:[],classList:{add(){},remove(){},toggle(){}},set innerHTML(value){this.children=[];this._html=value;},get innerHTML(){return this._html||'';},appendChild(child){this.children.push(child);},querySelectorAll(){return this.children;}};}
 function client(id){
  if(!store.has('players/'+id))store.set('players/'+id,{name:id,answers:{},score:0});
  const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  let screen='',intervals=new Map(),timerId=0;
  const context={...engine,console,document:{createElement:()=>element()},window:{addEventListener(){}},
   Date:{now:()=>now},setInterval:fn=>{intervals.set(++timerId,fn);return timerId;},clearInterval:id=>intervals.delete(id),
   serverTimestamp:()=>now,
   onSnapshot:(ref,callback)=>{const listener={path:ref.path,callback};listeners.add(listener);notify();return ()=>listeners.delete(listener);},
   runTransaction:(_db,fn)=>{const task=serial.then(async()=>{const writes=[];await fn({get:async ref=>snapshot(ref.path),update:(ref,patch)=>writes.push([ref.path,patch])});for(const [path,patch]of writes)store.set(path,{...store.get(path),...structuredClone(patch)});notify();});serial=task.catch(()=>{});return task;}
  };
  vm.createContext(context);vm.runInContext(source,context);
  const controller=context.createSelfPacedQuiz({db:{},roomRef:()=>({path:'room'}),playerRef:()=>({path:'players/'+id}),playersRef:()=>({path:'players'}),getQuestions:()=>questions.map(q=>[q.title,q.text,q.options,q.correct]),getPlayerId:()=>id,getPlayerName:()=>id,$,show:id=>screen=id,escapeHtml:String});
  const api={controller,$,start:()=>$('startSelfQuiz').onclick(),next:()=>$('nextSelfQuestion').onclick(),answer:i=>$('pAnswers').children[i].onclick(),tick:()=>{for(const fn of [...intervals.values()])fn();},screen:()=>screen,player:()=>store.get('players/'+id)};
  controller.updateRun(run);return api;
 }
 return {run,store,client,advance:ms=>{now+=ms;},flush:async()=>{await serial;await new Promise(resolve=>setImmediate(resolve));},update:patch=>{Object.assign(run,patch);notify();}};
}

test('directed quiz keeps its time cap and existing scoring',()=>{
 assert.equal(engine.evaluateAnswer(1,1,0.5,10).points,10);
 assert.equal(engine.evaluateAnswer(1,1,8.5,10).points,2);
 assert.equal(engine.evaluateAnswer(1,1,10,10).points,0);
 assert.equal(engine.isSelfPaced({}),false);assert.equal(engine.questionSeconds({}),60);
});
test('autonomous correct answers never expire and speed remains part of the score',()=>{
 assert.equal(engine.evaluateSelfPacedAnswer(1,1,1).points,10);
 assert.equal(engine.evaluateSelfPacedAnswer(1,1,31).points,5);
 assert.equal(engine.evaluateSelfPacedAnswer(1,1,3600).points,1);
 assert.equal(engine.evaluateSelfPacedAnswer(1,1,3600).timedOut,false);
 assert.equal(engine.evaluateSelfPacedAnswer(0,1,1).points,0);
});
test('participants advance independently through their selected questions',async()=>{
 const f=fixture(),ana=f.client('Ana'),luis=f.client('Luis');await ana.start();
 assert.equal(ana.player().selfPaced.activeIndex,2);assert.equal(luis.screen(),'selfIntro');
 f.advance(2000);await ana.answer(2);assert.equal(ana.player().score,10);
 f.advance(50000);await ana.next();assert.equal(ana.player().selfPaced.activeIndex,0);
 await luis.start();assert.equal(luis.player().selfPaced.activeIndex,2);
});
test('waiting before Next actually lowers speed points and ranking',async()=>{
 const f=fixture(),ana=f.client('Ana');await ana.start();f.advance(1000);await ana.answer(2);
 f.advance(30000);await ana.next();f.advance(1000);await ana.answer(0);
 const luis=f.client('Luis');await luis.start();f.advance(1000);await luis.answer(2);await luis.next();f.advance(1000);await luis.answer(0);
 assert.equal(ana.player().answers[0].elapsed,31);assert.equal(ana.player().score,15);assert.equal(luis.player().score,20);
 const rows=engine.selfPacedRanking([{id:'Ana',...ana.player()},{id:'Luis',...luis.player()}],f.run,questions);
 assert.equal(rows[0].id,'Luis');
});
test('refresh before Next does not erase the wait since the last submission',async()=>{
 const f=fixture(),ana=f.client('Ana');await ana.start();f.advance(1000);await ana.answer(2);
 const last=ana.player().selfPaced.lastAnsweredAt;ana.controller.stop();f.advance(12000);
 const resumed=f.client('Ana');await resumed.next();assert.equal(resumed.player().selfPaced.questionStartedAt,last);
 f.advance(1000);await resumed.answer(0);assert.equal(resumed.player().answers[0].elapsed,13);assert.equal(resumed.player().answers[0].points,8);
});
test('refresh during a question preserves elapsed time without closing it',async()=>{
 const f=fixture(),ana=f.client('Ana');await ana.start();const started=ana.player().selfPaced.questionStartedAt;
 f.advance(6000);ana.controller.stop();const resumed=f.client('Ana');assert.equal(resumed.player().selfPaced.questionStartedAt,started);
 f.advance(5000);await resumed.answer(2);assert.equal(resumed.player().answers[2].elapsed,11);assert.equal(resumed.player().score,9);
});
test('old total and question limits no longer close autonomous attempts',async()=>{
 const f=fixture({duration:10,totalDuration:60}),ana=f.client('Ana');await ana.start();
 f.advance(3_600_000);ana.tick();await f.flush();assert.equal(ana.screen(),'playerGame');assert.equal(Object.keys(ana.player().answers).length,0);
 await ana.answer(2);assert.equal(ana.player().score,1);assert.equal(ana.player().answers[2].correct,true);
 await ana.next();f.advance(3_600_000);await ana.answer(0);assert.equal(ana.screen(),'selfResults');assert.equal(ana.player().score,2);
});
test('two tabs cannot submit or score the same question twice',async()=>{
 const f=fixture(),first=f.client('Ana');await first.start();const second=f.client('Ana');f.advance(1000);
 await Promise.all([first.answer(2),second.answer(1)]);
 assert.equal(Object.keys(first.player().answers).length,1);assert.equal(first.player().score,10);assert.equal(first.player().answers[2].option,2);
});
test('a completed quiz reopens at results instead of creating a new attempt',async()=>{
 const f=fixture(),ana=f.client('Ana');await ana.start();f.advance(500);await ana.answer(2);await ana.next();f.advance(500);await ana.answer(0);
 assert.equal(ana.screen(),'selfResults');assert.equal(ana.player().score,20);assert.equal(ana.player().correctCount,2);
 ana.controller.stop();assert.equal(f.client('Ana').screen(),'selfResults');
});
test('facilitator can still close and reopen the instrument without resetting elapsed time',async()=>{
 const f=fixture(),ana=f.client('Ana'),luis=f.client('Luis');await ana.start();const original=ana.player().selfPaced.questionStartedAt;
 f.update({selfPacedStatus:'closed'});ana.controller.updateRun(f.run);luis.controller.updateRun(f.run);await luis.start();
 assert.equal(luis.player().selfPaced,undefined);f.advance(12000);f.update({selfPacedStatus:'published'});ana.controller.updateRun(f.run);
 await ana.answer(2);assert.equal(ana.player().selfPaced.questionStartedAt,original);assert.equal(ana.player().score,8);
});
test('restarting invalidates old scores and begins a fresh attempt',async()=>{
 const f=fixture(),ana=f.client('Ana');await ana.start();await ana.answer(2);f.update({quizVersion:'v2'});ana.controller.updateRun(f.run);await ana.start();
 assert.equal(ana.player().selfPaced.version,'v2');assert.equal(ana.player().score,0);assert.deepEqual(ana.player().answers,{});
});
test('ranking breaks point ties by accuracy and accumulated time, including wrong answers',()=>{
 const make=(id,answers)=>({id,name:id,score:999999,selfPaced:{version:'v1',startedAt:100},answers});
 const run={quizVersion:'v1',selectedQuestions:[0,1]};
 const rows=[make('Slow',{0:{points:5,correct:true,elapsed:2},1:{points:0,correct:false,elapsed:30}}),
 make('Fast',{0:{points:5,correct:true,elapsed:2},1:{points:0,correct:false,elapsed:1}}),
 make('More correct',{0:{points:3,correct:true,elapsed:8},1:{points:2,correct:true,elapsed:9}})];
 assert.deepEqual(engine.selfPacedRanking(rows,run,questions).map(p=>p.id),['More correct','Fast','Slow']);
});
