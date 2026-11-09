import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildQuizResponseExport} from '../quiz-export.mjs';

const questions=[['Uno','¿Qué eliges?',['A uno','B uno','C uno','D uno'],1],['Dos','Segunda pregunta',['A dos','B dos','C dos','D dos'],2]];
const run={className:'Clase CCMA',mode:'facilitated',selectedQuestions:[1,0],questionIndex:0,status:'revealed'};
function parse(csv){
 assert.ok(csv.startsWith('\uFEFFsep=;\r\n'));
 const input=csv.slice('\uFEFFsep=;\r\n'.length),records=[];
 let row=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&c===';'){row.push(cell);cell='';}
  else if(!quoted&&c==='\r'&&input[i+1]==='\n'){row.push(cell);records.push(row);row=[];cell='';i++;}
  else cell+=c;
 }
 assert.equal(quoted,false);const headers=records.shift();
 return records.map(values=>{assert.equal(values.length,headers.length);return Object.fromEntries(headers.map((h,i)=>[h,values[i]]));});
}
test('exports everyone, respects question order and includes unanswered questions',()=>{
 const players=Array.from({length:15},(_,i)=>({id:'p'+i,name:'Persona '+i,score:8,answers:{1:{option:2,correct:true,elapsed:2.5,points:8}}}));
 const result=buildQuizResponseExport({run,runId:'partida-one',questions,players});
 const rows=parse(result.csv);assert.equal(result.participantCount,15);assert.equal(result.answerCount,15);assert.equal(rows.length,30);
 assert.equal(rows[0]['Número de pregunta'],'2');assert.equal(rows[0]['Respuesta seleccionada'],'C dos');assert.equal(rows[0]['Tiempo de respuesta (s)'],'2,5');
 assert.equal(rows[1]['Estado de respuesta'],'Sin responder');assert.equal(rows[1]['Puntos registrados'],'');
 assert.equal(rows.at(-1).Nombre,'Persona 14');assert.equal(rows[0].Partida,'partida-one');
});
test('joins complete private identities, preserves document digits and labels missing historical records',()=>{
 const players=[{id:'both',name:'Ana',identityType:'both',joinedAt:Date.UTC(2026,10,9,21),answers:{}},
  {id:'doc',name:'Cédula ••••3456',identityType:'cedula',answers:{}},
  {id:'old',name:'Cédula ••••0001',identityType:'cedula',normalizedName:'digest-only',answers:{}},
  {id:'name',name:'Luis',identityType:'name',answers:{}}];
 const identities=[{id:'both',name:'Ana María',cedula:'00012345678901234567890'}, {id:'doc',name:'',cedula:'00123456'}];
 const result=buildQuizResponseExport({run:{...run,selectedQuestions:[0]},runId:'partida-one',questions,players,identities}),rows=parse(result.csv);
 assert.equal(rows[0].Nombre,'Ana María');assert.equal(rows[0]['Cédula'],'="00012345678901234567890"');assert.match(rows[0]['Fecha de ingreso (hora Colombia)'],/2026-11-09 16:00:00/);
 assert.equal(rows[1].Nombre,'');assert.equal(rows[1]['Cédula'],'="00123456"');
 assert.equal(rows[2]['Cédula'],'');assert.equal(rows[2].Nombre,'');assert.equal(rows[3].Nombre,'Luis');assert.equal(rows[3]['Cédula'],'');assert.equal(result.missingIdentityCount,1);
 assert.doesNotMatch(result.csv,/digest-only/);
});
test('CSV keeps accents, multiline text, separators and quotes intact',()=>{
 const name='Ana; María "A"\nLópez',text='¿Sí; o "no"?\nExplica.';
 const result=buildQuizResponseExport({run:{...run,selectedQuestions:[0]},runId:'partida-one',questions:[['T',text,['Sí; gracias','No','Tal vez','Otra'],0]],players:[{id:'a',name,answers:{0:{option:0,correct:true,points:10}}}]});
 const rows=parse(result.csv);assert.equal(rows[0].Nombre,name);assert.equal(rows[0].Pregunta,text);assert.equal(rows[0]['Respuesta seleccionada'],'Sí; gracias');
});
test('spreadsheet formulas are neutralized except controlled digit-only cedula literals',()=>{
 const result=buildQuizResponseExport({run:{...run,className:'@SUM(1;2)',selectedQuestions:[0]},runId:'partida-one',questions:[['T','=HYPERLINK("evil")',['+CMD','-CMD','@CMD','\tCMD'],0]],
  players:[{id:'=CMD',name:'=HYPERLINK("evil")',identityType:'both',answers:{0:{option:0,correct:true,points:10}}}],identities:[{id:'=CMD',cedula:'=HYPERLINK("evil")'}]});
 const row=parse(result.csv)[0];for(const col of ['Sala','ID participante','Nombre','Pregunta','Cédula','Respuesta seleccionada','Respuesta correcta'])assert.equal(row[col][0],"'",col);
});
test('pending directed points are exported as stored without awarding points',()=>{
 const result=buildQuizResponseExport({run:{...run,status:'closed',selectedQuestions:[0]},runId:'partida-one',questions,players:[{id:'a',name:'Ana',score:0,answers:{0:{option:1,correct:true,elapsed:1,points:0}}}]});
 const row=parse(result.csv)[0];assert.equal(row.Acierto,'Sí');assert.equal(row['Puntos registrados'],'0');assert.equal(row['Puntaje total registrado'],'0');assert.equal(row['Estado de puntuación'],'Pendiente de revelar');assert.equal(result.pendingCount,1);
});
test('saved responses outside the current selection are retained without inventing missing questions',()=>{
 const result=buildQuizResponseExport({run:{...run,selectedQuestions:[0]},runId:'partida-one',questions,players:[{id:'a',name:'Ana',score:5,answers:{9:{option:1,correct:false,elapsed:3,points:0}}}]});
 const rows=parse(result.csv);assert.equal(rows.length,2);assert.equal(rows[1]['Número de pregunta'],'10');assert.equal(rows[1].Pregunta,'Pregunta no disponible');assert.equal(rows[1]['Opción elegida'],'B');assert.equal(rows[1]['Respuesta correcta'],'');assert.equal(result.answerCount,1);
});
test('autonomous old attempts retain saved results and are not assigned current question text',()=>{
 const result=buildQuizResponseExport({run:{...run,mode:'self_paced',quizVersion:'v2',selectedQuestions:[0]},runId:'partida-one',questions,players:[{id:'a',name:'Ana',score:7,selfPaced:{version:'v1'},answers:{0:{option:1,correct:true,elapsed:8,points:7}}}]});
 const row=parse(result.csv)[0];assert.equal(row.Modalidad,'Autónoma');assert.equal(row.Pregunta,'Pregunta de un intento anterior');assert.equal(row['Respuesta seleccionada'],'');assert.equal(row['Puntos registrados'],'7');assert.equal(row['Estado de puntuación'],'Intento anterior');
});
test('filename is valid on Windows and registered people without questions are still included',()=>{
 const result=buildQuizResponseExport({run:{className:'Clase:/\\*?"<>|',mode:'facilitated'},runId:'partida-one',questions:[],players:[{id:'a',name:'Ana',answers:{}}]});
 assert.doesNotMatch(result.filename,/[<>:"/\\|?*]/);assert.equal(result.participantCount,1);assert.equal(result.answerCount,0);assert.equal(parse(result.csv)[0]['Estado de respuesta'],'Sin responder');
});
