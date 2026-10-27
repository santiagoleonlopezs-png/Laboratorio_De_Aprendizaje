'use strict';
// Bitácora del facilitador: se construye únicamente a partir del historial
// liquidado por ronda. No se añaden escrituras ni colecciones nuevas en Firebase.
let journalView='latest';
const DISCUSSION_PROMPTS=[
 ['¿Qué sacrificaron para cumplir el plazo operativo?','¿Qué evidencia pedirías antes de autorizar a alguien para operar la máquina?'],
 ['¿Cuál fue el criterio real para asignar cupos?','¿Cómo documentarías una decisión equitativa entre sedes?'],
 ['¿Qué peso tuvo la influencia del vicepresidente frente a las competencias?','¿Cómo explicarías la decisión a las personas no elegidas?'],
 ['¿El desempeño técnico garantiza capacidad para liderar equipos?','¿Cómo retener talento sin desatender los reportes del equipo?'],
 ['¿Qué circunstancias personales deben ponderarse antes del traslado?','¿Qué alternativa equilibra continuidad y protección de derechos?'],
 ['¿Qué riesgos se generaron al modificar tareas sin preparación?','¿Qué pasos son indispensables para una movilidad responsable?'],
 ['¿En qué condiciones sería válido un acuerdo de desarrollo?','¿Qué riesgos trae asumir que una beca autoriza descuentos de nómina?'],
 ['¿Qué información es estrictamente necesaria para medir potencial?','¿Cómo evaluarías sesgos antes de decidir la inversión en formación?']
];
function journalRounds(){
 const rounds=new Set();
 for(const team of teams)for(const h of (Array.isArray(team.history)?team.history:[])){
  if(Number.isInteger(h.round)&&h.round>=0&&h.round<TOTAL)rounds.add(h.round);
 }
 return [...rounds].sort((a,b)=>a-b);
}
function journalResponse(team,index){
 return (Array.isArray(team.history)?team.history:[]).find(h=>h.round===index)||null;
}
function journalLetter(i){return Number.isInteger(i)&&i>=0&&i<3?String.fromCharCode(65+i):'—'}
function journalChoice(caseData,index){
 const choice=caseData&&Number.isInteger(index)&&index>=0&&index<3?caseData.choices[index]:null;
 return choice||null;
}
function journalLaw(question,index){
 return question&&Number.isInteger(index)&&index>=0&&index<3?question.options[index]:null;
}
function journalUnit(num){return Number.isFinite(Number(num))?Math.round(Number(num)):0}
function journalSigned(num){const n=journalUnit(num);return (n>0?'+':'')+n}
function journalEmpty(){
 return '<div class="journal-empty"><span class="minor">ESPERANDO EVIDENCIA</span><h3>La conversación comienza con las decisiones.</h3><p>Al cerrar la primera ronda, aquí aparecerán las elecciones de cada equipo, su identificación normativa y sus consecuencias. Podrás volver a consultarlas hasta reiniciar la partida.</p></div>';
}
function journalSelect(rounds){
 const available=rounds.map(i=>'<option value="r'+i+'">Ronda '+String(i+1).padStart(2,'0')+' · '+esc(CASES[i]?.title||'Caso')+'</option>').join('');
 const value=journalView==='all'||journalView==='latest'||rounds.includes(Number(journalView.slice(1)))?journalView:'latest';
 journalView=value;
 return '<div class="journal-filter"><label for="journalRoundSelect">QUÉ QUIERES REVISAR</label><select id="journalRoundSelect" class="journal-select"><option value="latest">Última ronda cerrada</option><option value="all">Consolidado de todas las rondas</option>'+available+'</select><span>'+rounds.length+' de '+TOTAL+' rondas con resultados</span></div>';
}
function journalDistribution(index){
 const c=CASES[index], records=teams.map(t=>journalResponse(t,index)),present=records.filter(Boolean),total=present.length;
 let out='<div class="journal-dist"><h3>¿Qué alternativas eligieron?</h3>';
 for(let i=0;i<3;i++){
  const count=present.filter(h=>h.choice===i).length,pct=total?Math.round(100*count/total):0;
  out+='<div class="journal-dist-row"><div><span><b>'+journalLetter(i)+'</b> '+esc(c.choices[i].title)+'</span><strong>'+count+' equipo'+(count===1?'':'s')+' · '+pct+'%</strong></div><div class="journal-track"><span style="width:'+pct+'%"></span></div></div>';
 }
 const missing=present.filter(h=>!(Number.isInteger(h.choice)&&h.choice>=0&&h.choice<3)).length;
 if(missing)out+='<p class="journal-missing">Sin respuesta: '+missing+' equipo'+(missing===1?'':'s')+'.</p>';
 return out+'</div>';
}
function journalInsights(index){
 const c=CASES[index],h=teams.map(t=>journalResponse(t,index)).filter(Boolean),total=h.length;
 const selected=[0,1,2].map(i=>h.filter(v=>v.choice===i).length);
 const top=Math.max(...selected),tied=selected.filter(x=>x===top).length>1;
 const dominant=top>0&&!tied?journalChoice(c,selected.indexOf(top)).title:null;
 const risky=h.filter(v=>v.choice>=0&&c.choices[v.choice]?.d?.[4]>0).length;
 const badLaw=h.filter(v=>v.legalChoice>=0&&!v.legalCorrect).length;
 let items=[];
 if(dominant)items.push('<b>Decisión dominante:</b> '+esc(dominant)+' ('+top+' de '+total+' equipos). ¿Qué supuestos compartieron?');
 else items.push('<b>Respuestas divididas:</b> no hubo una elección dominante. Contrasta los criterios detrás de las alternativas.');
 if(risky)items.push('<b>Exposición:</b> '+risky+' equipo'+(risky===1?' eligió':'s eligieron')+' opciones que elevaron el riesgo jurídico estratégico.');
 if(badLaw)items.push('<b>Interpretación normativa:</b> '+badLaw+' equipo'+(badLaw===1?' identificó':'s identificaron')+' otra referencia como la más pertinente.');
 return '<div class="journal-insights"><h3>Lecturas para conducir el debate</h3>'+items.map(x=>'<p>'+x+'</p>').join('')+'</div>';
}
function journalTeamCard(team,index){
 const h=journalResponse(team,index),c=CASES[index],q=LAWS[index],opt=journalChoice(c,h?.choice),law=journalLaw(q,h?.legalChoice);
 if(!h)return '';
 const lawStatus=h.legalChoice===undefined?'Sin registro histórico':h.legalCorrect?'Acertó':'Revisar fundamento';
 const points=journalSigned(h.points),risk=opt?.d?.[4]??0;
 return '<details class="journal-team" data-entry="r'+index+'_'+esc(team.id)+'"><summary><span class="journal-team-name">'+teamName(team)+'</span><span class="journal-team-brief">'+(opt?journalLetter(h.choice)+' · '+esc(opt.title):'No envió estrategia')+'</span><span class="journal-points">'+points+' pts</span></summary>'+
 '<div class="journal-team-detail"><div class="journal-two-col">'+
 '<div><span class="minor">ESTRATEGIA ELEGIDA</span><h4>'+esc(opt?.title||'Sin respuesta')+'</h4><p>'+esc(opt?.text||'No se recibió una decisión dentro del plazo.')+'</p><span class="minor">EFECTO OBSERVADO</span><p>'+esc(opt?.effect||'La inacción genera consecuencias en capacidad y continuidad.')+'</p><p class="journal-small">Cambio de riesgo por estrategia: '+journalSigned(risk)+' · Costo: '+journalUnit(h.cost)+' cr</p></div>'+
 '<div><span class="minor">REFERENCIA NORMATIVA SELECCIONADA</span><h4>'+esc(law?.[0]||'Sin respuesta')+'</h4><p>'+esc(law?.[1]||'El equipo no registró una referencia normativa.')+'</p><span class="journal-law-status '+(h.legalCorrect?'correct':'wrong')+'">'+esc(lawStatus)+' · '+journalSigned(h.legalPoints)+' pts</span><p class="journal-small">Norma más pertinente: '+esc(q?.options[q.correct]?.[0]||'Sin referencia')+'</p></div></div>'+
 '<div class="journal-reflection"><b>¿Por qué importa esta decisión?</b><p>'+esc(opt?.why||'No hubo evidencia suficiente para justificar una decisión.')+'</p>'+(h.late?.length?'<p><b>Consecuencia diferida:</b> '+esc(h.late.join(' · '))+'</p>':'')+'</div></div></details>';
}
function journalRound(index){
 const c=CASES[index],q=LAWS[index],histories=teams.map(t=>journalResponse(t,index)).filter(Boolean);
 const n=histories.length,valid=histories.filter(h=>h.choice>=0).length,correct=histories.filter(h=>h.legalCorrect===true).length,noAnswer=histories.filter(h=>h.choice<0).length;
 const values=[['Equipos evaluados',n],['Decisiones enviadas',valid],['Aciertos normativos',correct],['Sin respuesta',noAnswer]];
 const prompts=DISCUSSION_PROMPTS[index]||['¿Qué motivó las elecciones?','¿Qué cambiarían luego de conocer las consecuencias?'];
 const cards=teams.map(t=>journalTeamCard(t,index)).join('');
 return '<div class="journal-round"><div class="journal-kicker">RONDA '+String(index+1).padStart(2,'0')+' / '+esc(c.area)+'</div><h3 class="journal-case-title">'+esc(c.title)+'</h3><p class="journal-case-story">'+esc(c.story)+'</p>'+
 '<div class="journal-metrics">'+values.map(v=>'<div class="journal-metric"><span>'+esc(v[0])+'</span><strong>'+v[1]+'</strong></div>').join('')+'</div>'+
 '<div class="journal-columns">'+journalDistribution(index)+journalInsights(index)+'</div>'+
 '<div class="journal-debrief"><h3>Preguntas para conversar</h3><ol>'+prompts.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ol><div class="journal-official"><b>Marco para contextualizar:</b> '+esc(q?.options[q.correct]?.[0]||'Sin referencia')+' · '+esc(q?.explain||'')+(q?.source?' <a href="'+esc(q.source)+'" target="_blank" rel="noopener noreferrer">Consultar norma ↗</a>':'')+'</div></div>'+
 '<div class="journal-detail-heading"><h3>Decisiones por equipo</h3><span>Abre cada equipo para revisar sus razones y consecuencias</span></div>'+
 (cards||'<p class="muted">No se conservan equipos con historial de esta ronda.</p>')+'</div>';
}
function journalConsolidated(rounds){
 const records=teams.map(t=>{
  const history=(Array.isArray(t.history)?t.history:[]).filter(h=>rounds.includes(h.round));
  return {team:t,history,correct:history.filter(h=>h.legalCorrect).length,omissions:history.filter(h=>h.choice<0).length,points:history.reduce((sum,h)=>sum+journalUnit(h.points),0)};
 }).sort((a,b)=>b.points-a.points);
 let table='<div class="journal-table-wrap"><table class="journal-table"><thead><tr><th>Equipo</th><th>Rondas</th><th>Puntos en rondas</th><th>Aciertos legales</th><th>Sin respuesta</th><th>Riesgo actual</th></tr></thead><tbody>';
 for(const r of records)table+='<tr><td><b>'+teamName(r.team)+'</b></td><td>'+r.history.length+'</td><td>'+journalSigned(r.points)+'</td><td>'+r.correct+'</td><td>'+r.omissions+'</td><td>'+journalUnit(r.team.stats?.risk??INITIAL.risk)+'%</td></tr>';
 table+='</tbody></table></div>';
 let sections='<h3 class="journal-section-title">Trayectoria de los equipos</h3><p class="muted">Consulta cada ronda para recuperar la discusión y los cambios de decisión.</p>';
 for(const r of records){
  sections+='<details class="journal-team" data-entry="all_'+esc(r.team.id)+'"><summary><span class="journal-team-name">'+teamName(r.team)+'</span><span class="journal-team-brief">'+r.history.length+' rondas · '+r.correct+' aciertos jurídicos</span><span class="journal-points">'+journalSigned(r.points)+' pts</span></summary><div class="journal-team-detail">';
  for(const h of r.history.sort((a,b)=>a.round-b.round)){
   const c=CASES[h.round],q=LAWS[h.round],option=journalChoice(c,h.choice),law=journalLaw(q,h.legalChoice);
   sections+='<div class="journal-history-item"><b>R'+(h.round+1)+' · '+esc(c?.title||'Caso')+'</b><p><strong>Estrategia:</strong> '+esc(option?.title||'Sin respuesta')+' · <strong>Norma:</strong> '+esc(law?.[0]||'Sin respuesta')+' '+(h.legalCorrect?'✓':'')+'</p><p>'+journalSigned(h.points)+' pts · '+esc(option?.effect||'Sin decisión')+'</p></div>';
  }
  sections+='</div></details>';
 }
 const questions='<div class="journal-debrief"><h3>Preguntas de cierre</h3><ol><li>¿En qué momentos la mayoría priorizó la operación sobre la equidad y la seguridad?</li><li>¿Qué decisiones fueron favorables de inmediato, pero generaron consecuencias posteriores?</li><li>¿Qué patrones jurídicos de error se repitieron y qué cambiarían en una segunda partida?</li></ol></div>';
 return '<div class="journal-round"><div class="journal-kicker">BALANCE DEL SISTEMA</div><h3 class="journal-case-title">Consolidado de decisiones</h3><p class="journal-case-story">Comparación pedagógica de las rondas cerradas. Los puntos por ronda no siempre coinciden con el marcador por posibles límites de puntuación acumulada.</p>'+table+questions+sections+'</div>';
}
function renderDecisionJournal(){
 const journal=$('decisionJournal'),shortcut=$('journalShortcut');
 const visible=host()&&!localDemo;
 if(journal)journal.classList.toggle('hidden',!visible);
 if(shortcut)shortcut.classList.toggle('hidden',!visible);
 if(!visible||!journal)return;
 const target=$('journalContent'),rounds=journalRounds();
 if(!target)return;
 const opened=[...target.querySelectorAll('details[open]')].map(el=>el.dataset.entry);
 if(!rounds.length){target.innerHTML=journalEmpty();const exportButton=$('journalExport');if(exportButton)exportButton.disabled=true;return;}
 const picker=journalSelect(rounds),selected=journalView==='all'?'all':journalView==='latest'?rounds[rounds.length-1]:Number(journalView.slice(1));
 target.innerHTML=picker+(selected==='all'?journalConsolidated(rounds):journalRound(selected));
 const select=$('journalRoundSelect');
 if(select){select.value=journalView;select.onchange=()=>{journalView=select.value;renderDecisionJournal();};}
 for(const details of target.querySelectorAll('details[data-entry]'))if(opened.includes(details.dataset.entry))details.open=true;
 const button=$('journalExport');if(button){button.disabled=false;button.onclick=exportDecisionJournal;}
}
function exportDecisionJournal(){
 if(!host())return;
 const rounds=journalRounds();
 if(!rounds.length)return toast('Todavía no hay rondas cerradas para exportar.',true);
 const header=['sala','clase','ronda','tema','equipo','opcion','estrategia','fundamento','efecto','norma_seleccionada','descripcion_norma','norma_correcta','acierto_normativo','puntos_normativos','puntos_ronda','coste_creditos','consecuencias_diferidas'];
 const rows=[header],quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 for(const i of rounds)for(const team of teams){
  const h=journalResponse(team,i);if(!h)continue;
  const c=CASES[i],q=LAWS[i],opt=journalChoice(c,h.choice),law=journalLaw(q,h.legalChoice);
  rows.push([code,room.className||'',i+1,c.title,team.name,journalLetter(h.choice),opt?.title||'Sin respuesta',opt?.why||'',opt?.effect||'',law?.[0]||'',law?.[1]||'',q?.options[q.correct]?.[0]||'',h.legalCorrect?'Sí':'No',h.legalPoints??'',h.points??'',h.cost??'',(h.late||[]).join(' | ')]);
 }
 const csv='\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download='bitacora-talento-riesgo-'+code+'.csv';document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}
