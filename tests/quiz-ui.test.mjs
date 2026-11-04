import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../quiz-engine.mjs';

const html=fs.readFileSync(new URL('../knowledge.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\n/gm,'');
function page(search=''){
 const elements=new Map(),store=new Map(),observers=[];let autoId=0;
 function element(id){return {id,value:'',textContent:'',dataset:{},style:{},disabled:false,classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],scrollIntoView(){},appendChild(){},set innerHTML(s){this._html=s;this.textContent=s;},get innerHTML(){return this._html||'';}};}
 const $=id=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);};
 const ref=(...parts)=>{const path=parts.slice(parts[0]?.kind==='db'?1:0).map(p=>p?.path||p).join('/');return {path,id:path.split('/').at(-1)};};
 const getDoc=async r=>({exists:()=>store.has(r.path),data:()=>structuredClone(store.get(r.path))});
 const put=async(r,data,options)=>{store.set(r.path,options?.merge?{...store.get(r.path),...structuredClone(data)}:structuredClone(data));};
 const context={...engine,console,URL,URLSearchParams,crypto:{randomUUID:()=>`version-${++autoId}`},location:{href:'https://example.test/knowledge.html'+search,search},navigator:{onLine:true,clipboard:{writeText:async()=>{}}},
  document:{getElementById:$,querySelectorAll:()=>[],createElement:()=>element('generated'),activeElement:null},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},
  setTimeout:()=>{},setInterval:()=>0,clearInterval(){},confirm:()=>true,alert(){},prompt:()=>null,
  initializeApp:()=>({}),getFirestore:()=>({kind:'db'}),getAuth:()=>({}),signInWithEmailAndPassword:async()=>({user:{}}),getIdTokenResult:async()=>({claims:{facilitator:true}}),
  doc:(...parts)=>parts.length===1?ref(parts[0],`id${++autoId}`):ref(...parts),collection:ref,getDoc,
  setDoc:put,updateDoc:(r,data)=>put(r,data,{merge:true}),deleteDoc:async r=>store.delete(r.path),serverTimestamp:()=>1000,
  getDocs:async r=>({docs:[...store].filter(([path])=>path.startsWith(r.path+'/')&&path.split('/').length===r.path.split('/').length+1).map(([path,data])=>({id:path.split('/').at(-1),ref:{path},data:()=>structuredClone(data)})),forEach(fn){this.docs.forEach(fn);}}),
  onSnapshot:(r,cb)=>{observers.push({r,cb});return()=>{};},
  writeBatch:()=>{const writes=[];return {set:(...a)=>writes.push(()=>put(...a)),update:(r,data)=>writes.push(()=>put(r,data,{merge:true})),delete:r=>writes.push(()=>store.delete(r.path)),commit:async()=>{for(const write of writes)await write();}};},
  createSelfPacedQuiz:()=>({updateRun(){},stop(){}})
 };
 vm.createContext(context);vm.runInContext(script,context);
 $('newTotalDuration').value='20';$('totalDuration').value='20';
 return {$,store,context,run:code=>vm.runInContext(code,context),observers};
}
test('page has unique ids and all direct DOM lookups exist',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const [,id]of html.matchAll(/\$\("([^"]+)"\)/g))assert.ok(ids.includes(id),id);
});
test('facilitator creates autonomous run with the selected time, then publishes a bound link',async()=>{
 const p=page();p.$('className').value='Estrategia';p.$('newQuizMode').value='self_paced';p.$('newQuestionDuration').value='30';
 await p.$('createRoom').onclick();const runEntry=[...p.store].find(([,d])=>d.recordType==='run');assert.ok(runEntry,p.$('roomManagerMsg').textContent);
 const [path,data]=runEntry;assert.equal(data.mode,'self_paced');assert.equal(data.duration,30);assert.equal(data.totalDuration,1200);assert.equal(data.selfPacedStatus,'draft');
 await p.$('publishSelfQuiz').onclick();const published=p.store.get(path);assert.equal(published.selfPacedStatus,'published');assert.ok(published.quizVersion);assert.equal(published.questions.length,20);
 p.run('state='+JSON.stringify(published)+';renderHost();');assert.ok(p.$('quizShareLink').value.includes('partida='+path.split('/')[1]));assert.equal(p.$('questionDuration').disabled,true);assert.equal(p.$('totalDuration').disabled,true);
});
test('a new run defaults to directed and maximum time validation rejects invalid setup',async()=>{
 const p=page();p.$('className').value='Clase';p.$('newQuestionDuration').value='0';await p.$('createRoom').onclick();assert.equal(p.store.size,0);
 p.$('newQuestionDuration').value='60';p.$('newQuizMode').value='facilitated';await p.$('createRoom').onclick();assert.equal([...p.store.values()].find(d=>d.recordType==='run').mode,'facilitated');
});
test('changing settings and banks preserves the configured time and clears obsolete selections',async()=>{
 const p=page();p.run("room='partida-test';state={mode:'facilitated',duration:45,selectedQuestions:[8],status:'lobby'};selectedQuestions=[8]");
 p.store.set('gc_quiz_banks/otro',{name:'Otro',questions:[{text:'Nueva',options:['A','B','C','D'],correct:0}]});p.store.set('gc_quiz_live/partida-test',{duration:45});
 await p.run("selectBank('otro',true)");const run=p.store.get('gc_quiz_live/partida-test');assert.equal(run.duration,45);assert.equal(run.selectedQuestions,null);assert.equal(run.questions.length,1);
});
test('published instruments reject edits and retain their question snapshot when the bank changes',async()=>{
 const p=page();p.run("room='partida-test';state={mode:'self_paced',selfPacedStatus:'published',questions:[],quizVersion:'v1'}");
 assert.throws(()=>p.run('assertInstrumentEditable()'),/nueva partida/);
 p.store.set('gc_quiz_banks/agilismo',{name:'Actualizado',questions:[{text:'No debe sustituir',options:['A','B','C','D'],correct:0}]});
 const before=p.run('Q[0][1]');await p.run("selectBank('agilismo',false)");assert.equal(p.run('Q[0][1]'),before);
});
test('reset preserves class identity, snapshot, modality and duration while invalidating attempts',async()=>{
 const p=page(),path='gc_quiz_live/partida-test';p.run("room='partida-test'");p.store.set(path,{recordType:'run',className:'CLASE',mode:'self_paced',duration:45,questions:[{text:'Conservada'}],quizVersion:'old'});
 p.store.set(path+'/players/ana',{name:'Ana',score:8,answers:{0:{points:8}},selfPaced:{version:'old'}});await p.$('resetGame').onclick();
 const data=p.store.get(path);assert.equal(data.className,'CLASE');assert.equal(data.recordType,'run');assert.equal(data.duration,45);assert.equal(data.mode,'self_paced');assert.equal(data.questions[0].text,'Conservada');assert.notEqual(data.quizVersion,'old');assert.equal(data.selfPacedStatus,'draft');assert.equal(p.store.get(path+'/players/ana').selfPaced,null);
});
test('invitation joins the exact instrument even when the class alias points to another run',async()=>{
 const p=page('?partida=partida-original');p.store.set('gc_quiz_live/partida-original',{recordType:'run',mode:'self_paced'});p.store.set('gc_quiz_live/CLASE',{activeRun:'partida-new'});
 await p.run("recoverOrJoin('Ana','CLASE')");assert.equal(p.run('room'),'partida-original');assert.ok([...p.store.keys()].some(path=>path.startsWith('gc_quiz_live/partida-original/players/')));
});
test('facilitator saves an independent total in minutes and rejects an empty total',async()=>{
 const p=page();p.run("room='partida-test';state={mode:'self_paced',selfPacedStatus:'draft',status:'lobby',duration:60}");
 p.$('quizMode').value='self_paced';p.$('questionDuration').value='45';p.$('totalDuration').value='8';
 await p.$('saveQuizSettings').onclick();let data=p.store.get('gc_quiz_live/partida-test');assert.equal(data.duration,45);assert.equal(data.totalDuration,480);
 p.$('questionDuration').value='45';p.$('totalDuration').value='';await p.$('saveQuizSettings').onclick();data=p.store.get('gc_quiz_live/partida-test');assert.equal(data.totalDuration,480);assert.match(p.$('hostError').textContent,/tiempo total/);
});
