import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as engine from '../quiz-engine.mjs';

const html=fs.readFileSync(new URL('../knowledge.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\n/gm,'');
function page(search='', saved=null){
 const elements=new Map(),store=new Map(),observers=[],startup=[],savedValues=new Map(),errors=[];let autoId=0;
 if(saved)savedValues.set('gc_quiz_session_v7',JSON.stringify(saved));
 function element(id){
  const tag=html.match(new RegExp('<[^>]+\\bid="'+id+'"[^>]*>'))?.[0]||'';
  const classes=new Set((tag.match(/class="([^"]*)"/)?.[1]||'').split(/\s+/).filter(Boolean)),attributes={};
  return {id,value:'',textContent:'',dataset:{},style:{},disabled:false,
   classList:{toggle(name,force){const on=force===undefined?!classes.has(name):force;if(on)classes.add(name);else classes.delete(name);},add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},
   addEventListener(){},querySelectorAll:()=>[],scrollIntoView(){},appendChild(){},focus(){},setAttribute:(key,value)=>attributes[key]=value,getAttribute:key=>attributes[key],
   set innerHTML(s){this._html=s;this.textContent=s;},get innerHTML(){return this._html||String(this.textContent||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}};
 }
 const $=id=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);};
 const backButtons=Array.from({length:[...html.matchAll(/class="[^"]*\bback\b[^"]*"/g)].length},(_,i)=>element('back-'+i));
 const ref=(...parts)=>{const path=parts.slice(parts[0]?.kind==='db'?1:0).map(p=>p?.path||p).join('/');return {path,id:path.split('/').at(-1)};};
 const getDoc=async r=>({exists:()=>store.has(r.path),data:()=>structuredClone(store.get(r.path))});
 const put=async(r,data,options)=>{store.set(r.path,options?.merge?{...store.get(r.path),...structuredClone(data)}:structuredClone(data));};
 const context={...engine,console:{...console,error:error=>errors.push(error)},URL,URLSearchParams,TextEncoder,crypto:{randomUUID:()=>`version-${++autoId}`,subtle:webcrypto.subtle},location:{href:'https://example.test/knowledge.html'+search,search},navigator:{onLine:true,clipboard:{writeText:async()=>{}}},
  document:{getElementById:$,querySelectorAll:selector=>selector==='.back'?backButtons:[],createElement:()=>element('generated'),activeElement:null},window:{addEventListener(){}},
  localStorage:{getItem:key=>savedValues.get(key)||null,setItem:(key,value)=>savedValues.set(key,value)},
  setTimeout:fn=>{startup.push(fn);},setInterval:()=>0,clearInterval(){},confirm:()=>true,alert(){},prompt:()=>null,
  initializeApp:()=>({}),getFirestore:()=>({kind:'db'}),getAuth:()=>({}),signInWithEmailAndPassword:async()=>({user:{}}),getIdTokenResult:async()=>({claims:{facilitator:true}}),
  doc:(...parts)=>parts.length===1?ref(parts[0],`id${++autoId}`):ref(...parts),collection:ref,getDoc,
  setDoc:put,updateDoc:(r,data)=>put(r,data,{merge:true}),deleteDoc:async r=>store.delete(r.path),serverTimestamp:()=>1000,
  getDocs:async r=>({docs:[...store].filter(([path])=>path.startsWith(r.path+'/')&&path.split('/').length===r.path.split('/').length+1).map(([path,data])=>({id:path.split('/').at(-1),ref:{path},data:()=>structuredClone(data)})),forEach(fn){this.docs.forEach(fn);}}),
  onSnapshot:(r,cb)=>{const entry={r,cb,active:true};observers.push(entry);return()=>{entry.active=false;};},
  writeBatch:()=>{const writes=[];return {set:(...a)=>writes.push(()=>put(...a)),update:(r,data)=>writes.push(()=>put(r,data,{merge:true})),delete:r=>writes.push(()=>store.delete(r.path)),commit:async()=>{for(const write of writes)await write();}};},
  createSelfPacedQuiz:()=>({updateRun(){},stop(){}})
 };
 vm.createContext(context);vm.runInContext(script,context);
 return {$,store,context,run:code=>vm.runInContext(code,context),observers,backButtons,errors,
  emit:async(path,data)=>{store.set(path,data);for(const o of [...observers])if(o.active&&o.r.path===path)await o.cb({exists:()=>true,data:()=>structuredClone(data)});},
  boot:async()=>{for(const fn of startup)await fn();},isShown:id=>!$(id).classList.contains('hidden')};
}
test('page has unique ids and all direct DOM lookups exist',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const [,id]of html.matchAll(/\$\("([^"]+)"\)/g))assert.ok(ids.includes(id),id);
});
test('facilitator creates an untimed autonomous run and publishes a bound link',async()=>{
 const p=page();p.$('className').value='Estrategia';p.$('newQuizMode').value='self_paced';p.$('newQuestionDuration').value='30';
 await p.$('createRoom').onclick();const runEntry=[...p.store].find(([,d])=>d.recordType==='run');assert.ok(runEntry,p.$('roomManagerMsg').textContent);
 const [path,data]=runEntry;assert.equal(data.mode,'self_paced');assert.equal(data.duration,60);assert.equal(data.totalDuration,undefined);assert.equal(data.selfPacedStatus,'draft');
 await p.$('publishSelfQuiz').onclick();const published=p.store.get(path);assert.equal(published.selfPacedStatus,'published');assert.ok(published.quizVersion);assert.equal(published.questions.length,20);
 p.run('state='+JSON.stringify(published)+';renderHost();');assert.ok(p.$('quizShareLink').value.includes('partida='+path.split('/')[1]));assert.equal(p.$('questionDuration').disabled,true);
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
test('autonomous settings do not require a question limit or a total limit',async()=>{
 const p=page();p.run("room='partida-test';state={mode:'self_paced',selfPacedStatus:'draft',status:'lobby'}");
 p.$('quizMode').value='self_paced';p.$('questionDuration').value='';await p.$('saveQuizSettings').onclick();
 const data=p.store.get('gc_quiz_live/partida-test');assert.equal(data.mode,'self_paced');assert.equal(data.totalDuration,undefined);
 assert.ok(!html.includes('id="totalDuration"'));assert.ok(!html.includes('id="selfTotalTimer"'));
});
test('opening the quiz with a saved session keeps Home and facilitator access available',async()=>{
 const saved={room:'partida-old',playerId:'ana',playerName:'Ana'},p=page('',saved);
 p.store.set('gc_quiz_live/partida-old',{recordType:'run',mode:'self_paced'});p.store.set('gc_quiz_live/partida-old/players/ana',{name:'Ana'});
 await p.boot();assert.equal(p.isShown('home'),true);assert.equal(p.isShown('playerJoin'),false);assert.equal(p.observers.length,0);
 assert.equal(p.$('resumeQuiz').classList.contains('hidden'),false);p.$('goHost').onclick();assert.equal(p.isShown('hostLogin'),true);assert.equal(p.observers.length,0);
});
test('an invitation also lands at Home, with both role choices',async()=>{
 const saved={room:'partida-original',playerId:'ana',playerName:'Ana'},p=page('?partida=partida-original',saved);
 p.store.set('gc_quiz_live/partida-original',{recordType:'run',mode:'self_paced',className:'CLASE'});await p.boot();
 assert.equal(p.isShown('home'),true);assert.equal(p.isShown('playerJoin'),false);assert.equal(p.observers.length,0);
 p.$('goPlayer').onclick();assert.equal(p.isShown('playerJoin'),true);assert.equal(p.$('roomCode').value,'CLASE');
 p.$('goHost').onclick();assert.equal(p.isShown('hostLogin'),true);
});
test('resuming requires a click and choosing facilitator detaches the participant listener',async()=>{
 const saved={room:'partida-old',playerId:'ana',playerName:'Ana'},p=page('',saved);
 p.store.set('gc_quiz_live/partida-old',{recordType:'run',mode:'self_paced'});p.store.set('gc_quiz_live/partida-old/players/ana',{name:'Ana'});
 await p.boot();assert.equal(p.observers.length,0);await p.$('resumeQuiz').onclick();assert.equal(p.isShown('waiting'),true);assert.ok(p.observers.some(o=>o.active));
 p.$('goHost').onclick();assert.equal(p.isShown('hostLogin'),true);assert.equal(p.observers.some(o=>o.active),false);
});
test('Volver al inicio cancels participant listeners and exposes the facilitator button',async()=>{
 const p=page('',{room:'partida-old',playerId:'ana',playerName:'Ana'});p.store.set('gc_quiz_live/partida-old',{recordType:'run',mode:'self_paced'});p.store.set('gc_quiz_live/partida-old/players/ana',{name:'Ana'});
 await p.boot();await p.$('resumeQuiz').onclick();p.backButtons[0].onclick();assert.equal(p.isShown('home'),true);assert.equal(p.observers.some(o=>o.active),false);
 p.$('goHost').onclick();assert.equal(p.isShown('hostLogin'),true);
});
test('a delayed resume cannot steal the screen after switching to facilitator',async()=>{
 const p=page('',{room:'partida-old',playerId:'ana',playerName:'Ana'});p.store.set('gc_quiz_live/partida-old',{recordType:'run',mode:'self_paced'});p.store.set('gc_quiz_live/partida-old/players/ana',{name:'Ana'});
 await p.boot();const original=p.context.getDoc;let release;
 p.context.getDoc=ref=>new Promise(resolve=>{release=async()=>resolve(await original(ref));});
 const pending=p.$('resumeQuiz').onclick();p.$('goHost').onclick();await release();await pending;
 assert.equal(p.isShown('hostLogin'),true);assert.equal(p.observers.some(o=>o.active),false);
});
test('an invalid shared link never blocks facilitator access',async()=>{
 const p=page('?partida=partida-missing');await p.boot();assert.equal(p.isShown('home'),true);assert.equal(p.$('joinBtn').disabled,true);
 p.$('goHost').onclick();assert.equal(p.isShown('hostLogin'),true);
});

test('new directed and autonomous runs persist ranking and identity choices',async()=>{
 for(const mode of ['facilitated','self_paced']){
  const p=page();p.$('className').value='Reto';p.$('newQuizMode').value=mode;p.$('newQuestionDuration').value='60';p.$('newRankingVisibility').value='final';p.$('newParticipantIdentity').value='cedula';
  await p.$('createRoom').onclick();const run=[...p.store.values()].find(r=>r.recordType==='run');
  assert.equal(run.rankingVisibility,'final');assert.equal(run.participantIdentity,'cedula');
  assert.ok(p.$('quizShareLink').value.includes('partida='));assert.equal(p.$('copyQuizLink').disabled,mode==='self_paced');
 }
});
test('shared links hide the room field and load the correct identity for both modes',async()=>{
 for(const mode of ['facilitated','self_paced']){
  const p=page('?partida=partida-fixed');p.store.set('gc_quiz_live/partida-fixed',{recordType:'run',className:'SALA UNO',mode,participantIdentity:'cedula'});
  await p.boot();assert.equal(p.isShown('home'),true);assert.equal(p.$('roomCodeField').classList.contains('hidden'),true);
  assert.equal(p.$('playerIdentityLabel').textContent,'Cédula');assert.equal(p.$('playerName').inputMode,'numeric');assert.equal(p.$('joinRoomSummary').textContent,'Sala · SALA UNO');
  await p.run("recoverOrJoin('0010203040','')");const player=[...p.store.entries()].find(([path])=>path.includes('/players/'))?.[1];
  assert.equal(player.name,'Cédula ••••3040');assert.equal(player.identityType,'cedula');assert.equal(player.normalizedName.length,64);
  assert.equal(JSON.stringify(player).includes('0010203040'),false);assert.equal(JSON.stringify(p.run('loadSession()')).includes('0010203040'),false);
 }
});
test('manual room lookup determines identity before the participant supplies it',async()=>{
 const p=page();p.store.set('gc_quiz_live/CLASE',{activeRun:'partida-class'});p.store.set('gc_quiz_live/partida-class',{recordType:'run',participantIdentity:'cedula',className:'CLASE'});
 p.$('roomCode').value='clase';await p.run('loadJoinRoom()');assert.equal(p.$('playerIdentityLabel').textContent,'Cédula');assert.equal(p.$('identityField').classList.contains('hidden'),false);
 p.$('roomCode').oninput();assert.equal(p.$('identityField').classList.contains('hidden'),true);assert.equal(p.$('joinBtn').disabled,true);
});
test('cedula validation rejects spaces, dots and non-digits without creating or recovering a player',async()=>{
 const p=page('?partida=partida-fixed');p.store.set('gc_quiz_live/partida-fixed',{recordType:'run',participantIdentity:'cedula'});
 for(const value of ['','123 456','123.456',' 123456','123456 ','123\t456','123\n456','123-456','1e6','+123456','123abc']){
  await p.run('recoverOrJoin('+JSON.stringify(value)+',"")');
  assert.equal([...p.store.keys()].filter(path=>path.includes('/players/')).length,0,value);
  assert.match(p.$('joinMsg').textContent,/sin puntos ni espacios/);assert.equal(p.$('playerName').getAttribute('aria-invalid'),'true');
 }
 await p.run('recoverOrJoin("123456","")');const id=p.run('playerId');await p.run('recoverOrJoin("123456","")');assert.equal(p.run('playerId'),id);
 assert.equal([...p.store.keys()].filter(path=>path.includes('/players/')).length,1);
});
test('ordinary names keep spaces and recover the same participant',async()=>{
 const p=page('?partida=partida-fixed');p.store.set('gc_quiz_live/partida-fixed',{recordType:'run'});
 await p.run('recoverOrJoin(" Ana María ","")');const id=p.run('playerId');await p.run('recoverOrJoin("ana maria","")');
 assert.equal(p.run('playerId'),id);assert.equal(p.run('playerName'),'Ana María');
});
test('ranking visibility remains editable after publication without changing questions or scoring',async()=>{
 const p=page(),path='gc_quiz_live/partida-fixed';p.store.set(path,{recordType:'run',mode:'self_paced',selfPacedStatus:'published',quizVersion:'keep',participantIdentity:'cedula',selectedQuestions:[1]});
 p.store.set(path+'/players/ana',{name:'123',identityType:'cedula',score:10});p.run("room='partida-fixed';state="+JSON.stringify(p.store.get(path)));
 p.$('rankingVisibility').value='hidden';p.$('participantIdentity').value='cedula';await p.$('saveParticipantSettings').onclick();
 const run=p.store.get(path);assert.equal(run.rankingVisibility,'hidden');assert.equal(run.quizVersion,'keep');assert.deepEqual(run.selectedQuestions,[1]);assert.equal(p.store.get(path+'/players/ana').score,10);
 p.$('participantIdentity').value='name';await p.$('saveParticipantSettings').onclick();assert.equal(p.store.get(path).participantIdentity,'cedula');assert.match(p.$('participantSettingsMsg').textContent,/Ya hay personas/);
});
test('directed hidden ranking is absent and does not subscribe to the scoreboard',async()=>{
 const p=page();p.run("room='partida-fixed';playerId='ana';listenPlayer()");
 for(const status of ['lobby','open','closed','revealed'])await p.emit('gc_quiz_live/partida-fixed',{mode:'facilitated',rankingVisibility:'hidden',status,questionIndex:0});
 assert.equal(p.$('playerRankingBox').classList.contains('hidden'),true);assert.equal(p.$('directedRankingBox').classList.contains('hidden'),true);
 assert.equal(p.$('playerRanking').innerHTML,'');assert.equal(p.observers.filter(o=>o.active&&o.r.path.endsWith('/scoreboard')).length,0);
});
test('directed final ranking waits for the last selected question and respects live changes',async()=>{
 const p=page();p.run("room='partida-fixed';playerId='ana';listenPlayer()");
 const base={mode:'facilitated',rankingVisibility:'final',selectedQuestions:[3,1],status:'revealed'};
 await p.emit('gc_quiz_live/partida-fixed',{...base,questionIndex:3});assert.equal(p.$('playerRankingBox').classList.contains('hidden'),true);
 await p.emit('gc_quiz_live/partida-fixed',{...base,questionIndex:1,lastResults:{questionIndex:1,top:[{name:'Ana',score:8}]}});
 assert.equal(p.$('playerRankingBox').classList.contains('hidden'),false);assert.match(p.$('playerRanking').innerHTML,/Ana/);
 await p.emit('gc_quiz_live/partida-fixed',{...base,questionIndex:1,rankingVisibility:'hidden'});
 assert.equal(p.$('playerRanking').innerHTML,'');assert.equal(p.observers.filter(o=>o.active&&o.r.path.endsWith('/scoreboard')).length,0);
 await p.emit('gc_quiz_live/partida-fixed',{...base,questionIndex:3,status:'open',rankingVisibility:'live'});
 assert.equal(p.$('directedRankingBox').classList.contains('hidden'),false);assert.equal(p.observers.filter(o=>o.active&&o.r.path.endsWith('/scoreboard')).length,1);
});
test('public participant labels mask cedulas while names remain intact',()=>{
 assert.equal(engine.participantLabel({name:'1020304050',identityType:'cedula'}),'Cédula ••••4050');
 assert.equal(engine.participantLabel({name:'Ana María'}),'Ana María');
});
