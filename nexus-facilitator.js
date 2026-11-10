/* NEXUS · Sala del facilitador y conversaciones basadas en las decisiones. */
(() => {
'use strict';
const $f=id=>document.getElementById(id),engine=window.NEXUS_ENGINE,esc=nexusEscape;
let facUnsub=null,facSerial=0,rowsCache=[],room=null,loadedCode='',reviewRound=1,loggingIn=false,busy=false;
const fmt=d=>{const x=new Date(d);return !d||isNaN(x)?'—':x.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});};
const mode=()=>document.querySelector('[name="facMode"]:checked').value;
const medal=n=>n===1?'🥇':n===2?'🥈':n===3?'🥉':String(n);
function openFac(){
 if(state)pauseClock();
 $f('facOverlay').classList.add('show');setLayer('facOverlay');$f('facLogin').style.display='block';$f('facDashboard').style.display='none';
 $f('facPassword').value='';$f('facLoginError').textContent='';$f('facEmail').focus();
}
function closeFac(){
 $f('facOverlay').classList.remove('show');setLayer($f('joinOverlay').style.display==='none'?'':'joinOverlay');facSerial++;
 if(facUnsub){facUnsub();facUnsub=null;}
 room=null;loadedCode='';rowsCache=[];
}
function selectedRows(){const q=$f('facSearch').value.trim().toLocaleLowerCase();return rowsCache.filter(r=>!q||String(r.team).toLocaleLowerCase().includes(q));}
async function loadFac(){
 const code=$f('facClassCode').value.trim().toUpperCase();
 if(!/^[A-Z0-9-]{3,30}$/.test(code)){$f('facError').textContent='Ingresa un código válido (3–30 caracteres).';return;}
 const serial=++facSerial;
 if(facUnsub){facUnsub();facUnsub=null;}
 room=null;loadedCode='';rowsCache=[];$f('facRoomControl').hidden=true;renderFac();$f('facError').textContent='';
 try{
   const stopTeams=await window.NEXUS_FIREBASE.subscribeRoom(code,(rows)=>{
     if(serial!==facSerial)return;
     rowsCache=rows;renderFac();
   },e=>{if(serial===facSerial)$f('facError').textContent=e;});
   if(serial!==facSerial){stopTeams();return;}
   loadedCode=code;
   const stopRoom=window.NEXUS_FIREBASE.watchRoom(code,data=>{
     if(serial!==facSerial)return;
     if(!data){room=null;renderFac();$f('facError').textContent='La sala ya no está disponible.';return;}
     const oldRound=room?.currentRound;
     room=engine.roomConfig(data);
     if(oldRound!==room.currentRound)reviewRound=room.currentRound;
     document.querySelector(`[name="facMode"][value="${room.mode}"]`).checked=true;
     renderFac();
   },e=>{if(serial===facSerial)$f('facError').textContent=e;});
   facUnsub=()=>{stopTeams();stopRoom();};
 }catch(e){if(serial===facSerial)$f('facError').textContent='No se pudo cargar la sala: '+nexusError(e);}
}
function renderFac(){
 const rows=selectedRows();
 $f('facTeams').textContent=rowsCache.length;
 $f('facAvg').textContent=rowsCache.length?Math.round(rowsCache.reduce((a,r)=>a+(r.score||0),0)/rowsCache.length):0;
 $f('facRound').textContent=rowsCache.length?Math.max(...rowsCache.map(r=>(r.gameState?.history||[]).length)):0;
 $f('facUpdated').textContent=rowsCache.length?fmt(new Date()):'—';
 let place=0,prev=null;
 // Calcular posiciones antes del filtro conserva el puesto real de cada equipo.
 const positions=new Map(rowsCache.map((r,i)=>{if(i===0||r.score!==prev)place=i+1;prev=r.score;return [r.id,place];}));
 $f('facRows').innerHTML=rows.length?rows.map(r=>`<tr><td>${medal(positions.get(r.id))}</td><td><b>${esc(r.team)}</b></td><td><b>${Math.round(r.score||0)}<small> /100</small></b></td><td class="${r.borrowed?'debtLabel':'facMuted'}">${r.borrowed||0} créditos</td><td>${(r.gameState?.history||[]).length}/5 decididas</td><td>${Math.round(r.business||0)}/100</td><td>${Math.round(r.appropriation||0)}/100</td><td class="facMuted">${fmt(r.updated_at)}</td><td><button type="button" class="facRemove" data-remove-team="${esc(r.id)}" ${busy?'disabled':''} aria-label="Retirar a ${esc(r.team)}">Retirar</button></td></tr>`).join(''):'<tr><td colspan="9" class="facMuted">'+(rowsCache.length?'Ningún equipo coincide con la búsqueda.':'Los equipos aparecerán aquí al ingresar a la sala.')+'</td></tr>';
 $f('facRoomControl').hidden=!room;
 if(room){
   const guided=room.mode==='guided',discuss=room.phase==='discussion',waiting=room.phase==='waiting',deciding=room.phase==='deciding',completed=room.status==='completed',resetting=room.status==='resetting';
   $f('facModeLabel').textContent=guided?'SALA DIRIGIDA · '+loadedCode:'SALA AUTÓNOMA · '+loadedCode;
   $f('facPhaseTitle').textContent=resetting?'Reiniciando sala…':completed?'Experiencia finalizada':guided?`Ronda ${room.currentRound} · ${waiting?'preparada':discuss?'cerrada para conversar':'recibiendo decisiones'}`:'Cinco rondas, al ritmo de cada equipo';
   $f('facPhaseDescription').textContent=resetting?'No se admiten envíos hasta terminar el reinicio.':completed?'Puedes revisar los resultados históricos o reiniciar la experiencia.':guided?(waiting?'La ronda aún no está disponible para los equipos. Presiona «Abrir ronda» cuando quieras comenzar.':discuss?'La recepción está cerrada. Reabre solo para recibir respuestas pendientes o avanza a la siguiente ronda.':'Los equipos pueden decidir. Cuando estén listos, cierra la ronda para conversar.'):'Cada equipo avanza a su propio ritmo. Consulta sus resultados y gestiona participantes desde este panel.';
   const n=rowsCache.filter(r=>(r.gameState?.history||[]).some(h=>h.round===room.currentRound)).length;
   $f('facProgress').textContent=guided?`${n} de ${rowsCache.length} equipos registraron su decisión de la ronda ${room.currentRound}.`:`${rowsCache.filter(r=>(r.gameState?.history||[]).length>=5).length} de ${rowsCache.length} equipos completaron la experiencia.`;
   const actions={
     facOpenRound: guided&&waiting&&!completed&&!resetting,
     facCloseRound: guided&&deciding&&!completed&&!resetting,
     facReopen: guided&&discuss&&!completed&&!resetting,
     facNext: guided&&discuss&&room.currentRound<5&&!completed&&!resetting,
     facFinish: guided&&discuss&&room.currentRound===5&&!completed&&!resetting
   };
   Object.entries(actions).forEach(([id,visible])=>{
     $f(id).hidden=!visible;$f(id).disabled=busy;
   });
   $f('facRoundState').dataset.phase=completed?'completed':room.phase;
   $f('facRoundState').textContent=resetting?'REINICIANDO':completed?'FINALIZADA':guided?(waiting?'PREPARADA':deciding?'ABIERTA':'CERRADA'):'AUTÓNOMA';
   $f('facChangeMode').disabled=busy||resetting||completed;
   $f('facResetAll').disabled=busy||resetting;
   const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('sala',loadedCode);
   $f('facShareLink').value=url.href;
 }
 renderReview(rows);
}
function renderReview(rows){
 $f('facRoundTabs').innerHTML=rounds.map((_,i)=>{
   const r=i+1,n=rowsCache.filter(row=>(row.gameState?.history||[]).some(h=>h.round===r)).length;
   return `<button type="button" role="tab" id="facTab${r}" aria-controls="facReviewPanel" aria-selected="${reviewRound===r}" tabindex="${reviewRound===r?'0':'-1'}" data-round="${r}"><span>Ronda ${r}</span><small>${n} decisiones</small></button>`;
 }).join('');
 $f('facReviewPanel').setAttribute('aria-labelledby','facTab'+reviewRound);
 $f('facRoundTabs').querySelectorAll('button').forEach(btn=>{
   btn.onclick=()=>{reviewRound=Number(btn.dataset.round);renderReview(selectedRows());$f('facTab'+reviewRound).focus();};
   btn.onkeydown=e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();reviewRound=e.key==='Home'?1:e.key==='End'?5:Math.max(1,Math.min(5,reviewRound+(e.key==='ArrowRight'?1:-1)));renderReview(selectedRows());$f('facTab'+reviewRound).focus();};
 });
 const analysis=engine.analyzeRound(rows,reviewRound),all=engine.analyzeRound(rowsCache,reviewRound),entries=analysis.entries;
 $f('facReviewTitle').textContent=rounds[reviewRound-1].title;
 $f('facReviewCount').textContent=`${all.count}/${rowsCache.length} decisiones recibidas`+(rows.length!==rowsCache.length?' · lista de equipos filtrada':'');
 // Patrones y preguntas usan siempre la sala completa; la búsqueda solo filtra las fichas.
 $f('facPatterns').innerHTML=all.patterns.map(p=>`<article class="pattern"><b>${esc(p.title)}</b><p>${esc(p.text)}</p></article>`).join('')||'<p class="facMuted">Los patrones aparecerán cuando se registren decisiones de esta ronda.</p>';
 $f('facQuestions').innerHTML=all.questions.map(q=>`<li>${esc(q)}</li>`).join('')||'<li>¿Qué señales del caso necesitan entender antes de intervenir?</li>';
 const ranking=all.entries;
 $f('facRoundRanking').innerHTML=ranking.length?`<div class="roundRankHeader"><b>Ranking al cierre de la ronda ${reviewRound}</b><small>Puntaje acumulado hasta esta ronda · se completa al llegar cada decisión.</small></div>`+ranking.map(r=>`<div class="rankrow"><span class="rankPos">${r.score===null?'—':medal(r.place)}</span><span>${esc(r.team)}</span><b>${r.score===null?'Sin dato':r.score+'<small> /100</small>'}</b><span class="${r.previousScore!==null&&r.score<r.previousScore?'negative':'positive'}">${r.previousScore===null||r.score===null?'—':(r.score-r.previousScore>0?'+':'')+(r.score-r.previousScore)+' pts'}</span><span class="facMuted">${r.borrowed===null?'Registro anterior':'Deuda '+r.borrowed}</span></div>`).join(''):'<p class="emptyState">Todavía no hay decisiones en esta ronda. El ranking aparecerá aquí antes de la conversación.</p>';
 const places=new Map(ranking.map(r=>[r.id,r.place]));
 const openedTeam=$f('facDecisions').querySelector('details[open]')?.dataset.teamId;
 $f('facDecisions').innerHTML=entries.map(entry=>{
   const h=entry.decision,s=h.scoring;
   const deltas=vars.map(v=>{const d=Math.round((h.after?.[v]||0)-(h.before?.[v]||0));return `<span class="${d<0?'negative':d>0?'positive':''}">${v} <b>${d>0?'+':''}${d}</b></span>`;}).join('');
   return `<details class="decisionCard" data-team-id="${esc(entry.id)}" ${openedTeam===entry.id?'open':''}><summary><span class="decisionTeam">${esc(entry.team)}<small>${esc(h.target)} · ${esc(h.audience)} · ${h.credits} créditos</small></span><span>${entry.score===null?'—':entry.score+'/100'} <small>#${places.get(entry.id)}</small></span></summary><div class="decisionBody"><div class="resultPracticeTags">${(h.practices||[]).map(p=>`<span>${esc(easyName(p))}</span>`).join('')}</div><p><b>Hipótesis:</b> ${esc(h.hypothesis)}</p><div class="decisionDeltas">${deltas}</div>${s?`<p class="facMuted">Tiempo activo: ${Math.floor(s.elapsedSeconds/60)} min ${s.elapsedSeconds%60} s · Pertinencia: +${s.points.relevance}/40 · Agilidad: +${s.points.speed}/5 · Saturación: −${s.penalties.overload} · Ronda: ${s.totalNoDebt}/100</p><ul class="personalFeedback">${s.feedback.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:'<p class="facMuted">Decisión anterior al nuevo desglose de puntaje.</p>'}${(h.consequence?.warnings||[]).map(w=>`<p class="resultWarning">${esc(w)}</p>`).join('')}</div></details>`;
 }).join('')||'<p class="facMuted">'+(all.count?'Ninguna decisión coincide con la búsqueda.':'Esperando las decisiones de los equipos…')+'</p>';
 // Un solo detalle abierto mantiene legible la conversación.
 $f('facDecisions').querySelectorAll('details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)$f('facDecisions').querySelectorAll('details').forEach(other=>{if(other!==detail)other.open=false;});}));
}
async function control(action,value){
 if(busy||!room)return;
 busy=true;renderFac();$f('facError').textContent='';
 try{await window.NEXUS_FIREBASE.controlRoom(loadedCode,action,value);if(action==='discussion')reviewRound=room.currentRound;}
 catch(e){$f('facError').textContent=nexusError(e);}
 finally{busy=false;renderFac();}
}
$f('facOpen').onclick=openFac;$f('facCancel').onclick=closeFac;$f('facExit').onclick=closeFac;
$f('facLoginBtn').onclick=async()=>{
 if(loggingIn)return;loggingIn=true;$f('facLoginBtn').disabled=true;$f('facLoginError').textContent='';
 try{
   const email=$f('facEmail').value.trim(),password=$f('facPassword').value;
   if(!email||!password)throw Error('Ingresa correo y contraseña.');
   await window.NEXUS_FIREBASE.login(email,password);$f('facPassword').value='';
   $f('facLogin').style.display='none';$f('facDashboard').style.display='block';
   $f('facClassCode').value=(localStorage.getItem('changeClassCode')||C.classCode||'').toUpperCase();
   await loadFac();
 }catch(e){$f('facLoginError').textContent=nexusError(e);}
 finally{loggingIn=false;$f('facLoginBtn').disabled=false;}
};
$f('facCreate').onclick=async()=>{
 const code=$f('facClassCode').value.trim().toUpperCase();
 if(!/^[A-Z0-9-]{3,30}$/.test(code)){$f('facError').textContent='El código debe tener entre 3 y 30 caracteres (letras, números o guiones).';return;}
 $f('facCreate').disabled=true;$f('facError').textContent='';
 try{const created=await window.NEXUS_FIREBASE.createRoom(code,mode());await loadFac();if(created)$f('facShareStatus').textContent='Sala creada. El enlace ya está listo para compartir.';}
 catch(e){$f('facError').textContent=nexusError(e);}
 finally{$f('facCreate').disabled=false;}
};
$f('facLoad').onclick=loadFac;$f('facRefresh').onclick=loadFac;$f('facSearch').oninput=()=>renderFac();
$f('facPassword').addEventListener('keydown',e=>{if(e.key==='Enter')$f('facLoginBtn').click();});
$f('facClassCode').addEventListener('keydown',e=>{if(e.key==='Enter')loadFac();});
$f('facOpenRound').onclick=()=>control('open');
$f('facCloseRound').onclick=()=>{
 if(!room)return;
 const missing=rowsCache.filter(r=>!(r.gameState?.history||[]).some(h=>h.round===room.currentRound));
 if(missing.length&&!confirm(`Faltan ${missing.length} de ${rowsCache.length} equipos por decidir. Al cerrar la ronda no podrán enviar hasta que la reabras. ¿Cerrar y conversar?`))return;
 control('close');
};
$f('facReopen').onclick=()=>{
 if(confirm('¿Reabrir la ronda '+room.currentRound+' para permitir respuestas pendientes? Las decisiones confirmadas se conservarán.'))control('reopen');
};
$f('facNext').onclick=()=>{
 if(confirm('¿Avanzar a la ronda '+(room.currentRound+1)+'? Quedará preparada hasta que presiones «Abrir ronda».'))control('next');
};
$f('facFinish').onclick=()=>{
 if(confirm('¿Finalizar esta experiencia? Se conservan todos los resultados para su consulta.'))control('finish');
};
$f('facRows').addEventListener('click',async e=>{
 const button=e.target.closest('[data-remove-team]');
 if(!button||busy||!room)return;
 const entry=rowsCache.find(r=>r.id===button.dataset.removeTeam);
 if(!entry)return;
 if(!confirm('¿Retirar al equipo «'+entry.team+'»? Se eliminarán sus decisiones y su posición del ranking. No podrá reingresar hasta reiniciar la sala.'))return;
 busy=true;renderFac();$f('facError').textContent='';
 try{
   await window.NEXUS_FIREBASE.removeTeam(loadedCode,entry.id);
   $f('facShareStatus').textContent='Equipo «'+entry.team+'» retirado de la sala.';
 }catch(err){$f('facError').textContent=nexusError(err);}
 finally{busy=false;renderFac();}
});
$f('facResetAll').onclick=async()=>{
 if(!room||busy)return;
 const typed=prompt('Vas a eliminar los resultados, decisiones, puntajes y participantes de esta sala. Para confirmar escribe REINICIAR:');
 if(typed===null)return;
 if(typed.trim().toUpperCase()!=='REINICIAR'){
   $f('facError').textContent='Reinicio cancelado. La palabra de confirmación no coincide.';return;
 }
 busy=true;renderFac();$f('facError').textContent='';
 try{
   await window.NEXUS_FIREBASE.resetRoom(loadedCode);
   reviewRound=1;$f('facSearch').value='';
   $f('facShareStatus').textContent='Partida reiniciada. Comparte el mismo código; los equipos deben ingresar de nuevo.';
 }catch(err){$f('facError').textContent='No se completó el reinicio: '+nexusError(err)+'. Puedes volver a usar «Reiniciar a todos» para continuarlo.';}
 finally{busy=false;renderFac();}
};
$f('facChangeMode').onclick=()=>{
 const next=room.mode==='guided'?'autonomous':'guided';
 if(confirm(next==='autonomous'?'Los equipos podrán completar todas las rondas a su ritmo. ¿Cambiar a modalidad autónoma?':`Retomarás el control desde la ronda ${room.currentRound}. Los avances ya registrados se conservan. ¿Cambiar a modalidad dirigida?`))control('mode',next);
};
$f('facCopyLink').onclick=async()=>{
 try{await navigator.clipboard.writeText(`NEXUS · Sala ${loadedCode}\n${$f('facShareLink').value}`);$f('facShareStatus').textContent='Enlace y código copiados.';}
 catch{ $f('facShareLink').select();$f('facShareStatus').textContent='Selecciona y copia el enlace de la sala.';}
};
})();
