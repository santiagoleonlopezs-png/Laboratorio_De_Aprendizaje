const C=window.CHANGE_LAB_CONFIG||{};
const definitions={"Conciencia": "Saber que habrá un cambio y entender por qué es necesario.", "Confianza": "Creer que los líderes cumplen lo que dicen y que el cambio se maneja con honestidad.", "Energía": "Tener tiempo, ánimo y fuerzas para participar sin agotarse.", "Compromiso": "Querer apoyar el cambio y estar dispuesto a hacer algo por él.", "Conocimiento": "Saber qué hay que hacer y cómo funciona la nueva manera de trabajar.", "Capacidad": "Poder aplicar lo aprendido con las habilidades y recursos disponibles.", "Apropiación": "Usar el cambio en el trabajo diario, sin depender de recordatorios constantes."};
const vars=["Conciencia","Confianza","Energía","Compromiso","Conocimiento","Capacidad","Apropiación"];
const practices=[["ADKAR", "Explica para qué se hace el cambio y qué significa para cada persona."], ["Escucha persuasiva", "Escucha las preocupaciones antes de ofrecer soluciones."], ["Co-creación", "Invita al equipo a construir soluciones útiles."], ["Lean Change", "Prueba una mejora pequeña y ajústala con resultados."], ["Aprendizaje experiencial", "Practica la nueva forma de trabajar en situaciones reales."], ["TRIZ", "Encuentra y elimina barreras que impiden avanzar."], ["Redes de influencia", "Invita a compañeros respetados a apoyar el cambio."], ["Coaching", "Acompaña a quienes tienen dificultades concretas."], ["Reconocimiento", "Destaca los avances y las conductas positivas."], ["Intenciones de implementación", "Acuerda qué hará cada persona, cuándo y cómo."], ["Identificación de casos exitosos", "Identifica lo que ya funciona y compártelo."], ["Análisis anticipado del fracaso", "Imagina qué podría fallar y toma medidas preventivas."], ["Coaching para líderes", "Activa sesiones de coaching para que los líderes cambien hábitos de dirección."], ["Gestión Humana", "Pide apoyo a Gestión Humana para resolver retos de personas y cultura."], ["Capacitación", "Organiza una formación práctica cuando faltan conocimientos o habilidades."]];

const easyNames={"ADKAR": "Explicar el propósito del cambio", "Escucha persuasiva": "Escuchar antes de convencer", "Co-creación": "Involucrar al equipo en las soluciones", "Lean Change": "Probar cambios pequeños", "Aprendizaje experiencial": "Aprender haciendo", "TRIZ": "Eliminar obstáculos", "Redes de influencia": "Movilizar personas influyentes", "Coaching": "Acompañar a quienes tienen dificultades", "Reconocimiento": "Reconocer los avances", "Intenciones de implementación": "Convertir ideas en acciones concretas", "Identificación de casos exitosos": "Aprender de lo que funciona", "Análisis anticipado del fracaso": "Anticipar problemas y resistencias", "Gestión Humana": "Activar a Gestión Humana", "Capacitación": "Activar una capacitación", "Coaching para líderes": "Coaching para líderes"};
function easyName(name){return easyNames[name]||name;}
const practiceCosts={
 "ADKAR":20,
 "Lean Change":30,
 "Moving Motivators":20,
 "Delegation Poker":20,
 "Campañas de comunicación-difusión":25,
 "TRIZ":20,
 "Nudges":15,
 "Redes de influencia":30,
 "Storytelling":15,
 "Co-creación":35,
 "Aprendizaje experiencial":35,
 "Coaching":40,
 "Reconocimiento":20,
 "Comunidades de práctica":30,
 "Lecciones aprendidas":20,
 "Comunicación segmentada":25,
 "Respaldo directivo":20,
 "Grupos focales":25,
 "Pensamiento científico":20,"Entrevista motivacional":25,"Escucha persuasiva":20,
 "Escala de disposición al cambio":15,"Análisis anticipado del fracaso":20,
 "Intenciones de implementación":20,"Identificación de casos exitosos":20,
 "Inoculación preventiva de objeciones":20,
 "Coaching para líderes":30,"Gestión Humana":25,"Capacitación":25
};
const TOTAL_BUDGET=120;

const rounds=[
{title:"Ronda 1 · El cambio fue anunciado",situation:"La transformación técnicamente va según cronograma. Sin embargo, aparecen señales contradictorias.",signals:["📊 91% asistió al lanzamiento.","💬 “Nos enteramos de decisiones por otros equipos.”","📊 Conocimiento declarado: 76%.","💬 “Entiendo qué cambia, pero no por qué.”","📉 Uso del nuevo proceso: 43%."]},
{title:"Ronda 2 · La organización responde",situation:"Las primeras intervenciones generan movimiento, pero también efectos no previstos.",signals:["💬 “Nos están preguntando mucho, pero no sabemos qué hacen con lo que decimos.”","📈 Algunos líderes informales empiezan a movilizar equipos.","📉 Los errores operativos aumentan.","💬 “Tengo ganas de hacerlo, pero no sé si puedo.”"]},
{title:"Ronda 3 · La organización se atrinchera",situation:"El cambio ya es conocido y existen capacidades iniciales, pero aparecen posiciones rígidas. Algunos líderes defienden la forma anterior de trabajar y las conversaciones empiezan a polarizarse.",signals:["📊 La conciencia y el conocimiento del cambio son altos.","📉 La confianza cae en grupos críticos.","💬 “Ya entendí el cambio; no estoy convencido de que sea mejor.”","💬 “Cada conversación termina intentando convencerme.”"]},
{title:"Ronda 4 · Presión competitiva",situation:"Dirección exige acelerar: otras organizaciones del sector muestran mejores resultados.",signals:["⚠️ El proyecto debe adelantar hitos.","💬 “Otra prioridad nueva esta semana.”","📊 La formación aumentó, la aplicación no al mismo ritmo.","💬 “¿Qué hicieron los otros para avanzar tanto?”"]},
{title:"Ronda 5 · Sostener o acelerar",situation:"Los resultados empiezan a aparecer. Dirección quiere aprovechar el impulso, pero el sistema muestra señales de fatiga.",signals:["📈 El KPI de negocio mejora.","📉 La energía de algunos equipos cae.","💬 “Podemos hacerlo, pero no sé cuánto tiempo a este ritmo.”","💬 “Ahora sí veo para qué sirve el cambio.”"]}
];
let team="";
let classCode="";
let state=null;
let activeRoom=null,roomUnsubscribe=null,submissionPending=false,executing=false;
let currentRanking=[];
const engine=window.NEXUS_ENGINE;
function freshState(){return{round:0,score:0,baseScore:0,spent:0,borrowed:0,loans:[],business:55,metrics:{Conciencia:52,Confianza:58,Energía:72,Compromiso:44,Conocimiento:61,Capacidad:42,Apropiación:35},history:[]};}
function stateKey(){return "changeState_"+classCode+"_"+team}
async function enterGame(){
 const t=$("joinTeam").value.trim(),c=$("joinCode").value.trim().toUpperCase();
 if(t.length<2||t.length>35||c.length<3||c.length>30||!/^[A-Z0-9-]+$/.test(c)){
   $("joinError").textContent="Ingresa un nombre válido y un código de clase (letras, números o guiones).";return;
 }
 const btn=$("joinBtn");btn.disabled=true;btn.textContent="CONECTANDO...";
 $("joinError").textContent="";
 try{
   const local=freshState();
   const {restore,room}=await window.NEXUS_FIREBASE.join(c,t,local);
   activeRoom=engine.roomConfig(room);
   team=t;classCode=c;state=restore||local;
   state.borrowed=Number(state.borrowed)||0;state.spent=Number(state.spent)||0;
   state.loans=Array.isArray(state.loans)?state.loans:[];
   state.history=Array.isArray(state.history)?state.history:[];
   if(!state.metrics)state.metrics={...freshState().metrics};
   if(state.metrics.Conciencia===undefined)state.metrics.Conciencia=52;
   if(state.metrics.Claridad!==undefined)delete state.metrics.Claridad;
   if(state.evolution)state.evolution.forEach(p=>{if(p.metrics?.Claridad!==undefined)delete p.metrics.Claridad;});
   if(!state.evolution)state.evolution=[{label:"Inicio",metrics:{...state.metrics},business:state.business}];
   state.baseScore=Number(state.baseScore??state.score)||0;
   state.score=Math.max(0,state.baseScore-debtPenalty());
   localStorage.setItem("changeTeam",team);localStorage.setItem("changeClassCode",classCode);
   const cached=JSON.parse(localStorage.getItem(stateKey())||'null');
   if(cached?.history?.length===state.history.length&&cached?.clock?.round===state.round+1)state.clock={...cached.clock,runningSince:null};
   else state.clock=state.clock?.round===state.round+1?{...state.clock,runningSince:null}:null;
   save();$("teamTag").textContent=" · "+team+" · "+classCode;
   $("joinOverlay").style.display="none";setLayer('');render();updateBudget();
   if(roomUnsubscribe)roomUnsubscribe();
   roomUnsubscribe=window.NEXUS_FIREBASE.watchRoom(c,room=>{
     pauseClock();activeRoom=room?engine.roomConfig(room):null;updateRoomStatus();
   },error=>{pauseClock();activeRoom=null;updateRoomStatus();$("rankingStatus").textContent=error;});
   const last=state.history.find(h=>h.round===state.round+1);
   if(last)showResult(last);else updateRoomStatus();
 }catch(e){$("joinError").textContent=window.NEXUS_FIREBASE.error(e);console.error("NEXUS ingreso",e);}
 finally{btn.disabled=false;btn.textContent="Entrar a la simulación →";}
}
let selected=[]; let time=420, tick;
const $=id=>document.getElementById(id);
vars.forEach(v=>{$("target").innerHTML+=`<option>${v}</option>`;$("bets").innerHTML+=`<div class="betrow"><span>${v} <details class="helpTip"><summary aria-label="Qué significa ${v}">?</summary><div>${definitions[v]}</div></details></span><input aria-label="Predicción para ${v}" type="range" min="-15" max="15" value="0" data-bet="${v}"><b id="b_${v}">0</b></div>`});
["Alta dirección","Líderes","Influenciadores","Equipos","Individuos"].forEach(a=>$("audience").innerHTML+=`<option>${a}</option>`);
practices.forEach((p,i)=>$("practices").innerHTML+=`<button type="button" class="practice" data-i="${i}" aria-pressed="false"><b>${easyName(p[0])}</b><small>${p[1]}</small><span class="effort">${engine.interventionLoad([p[0]]).actions[0].size} · ${engine.interventionEffort[p[0]]||1} de carga</span><span class="cost">${practiceCosts[p[0]]} créditos</span></button>`);
function selectedCost(){return selected.reduce((sum,i)=>sum+(practiceCosts[practices[i][0]]||0),0)}
function debtPenalty(){return Math.min(50,Math.round((state?.borrowed||0)*0.4));}
function remainingBudget(){return TOTAL_BUDGET+(state.borrowed||0)-(state.spent||0)-(state.history.some(h=>h.round===state.round+1)?0:selectedCost());}
function requestLoan(amount=20){
 if(!state||!engine.canPlay(state,activeRoom)||submissionPending)return false;
 const credits=Math.max(20,Math.ceil(amount/20)*20);
 if(!confirm("COMITÉ FINANCIERO: SOLICITUD DE CRÉDITO\n\n¿Solicitar "+credits+" créditos adicionales?\n\nSe aprueba la financiación, pero queda registrada como deuda y penaliza el ranking en 0,4 puntos por crédito (máximo 50)."))return false;
 state.borrowed=(state.borrowed||0)+credits;
 state.loans=(state.loans||[]).concat({round:state.round+1,credits});
 state.score=Math.max(0,Math.round((state.baseScore||0)-debtPenalty()));
 $("scoreTag").textContent=state.score+"/100";
 save();updateBudget();void syncScore();
 return true;
}
function updateBudget(){
 const used=selectedCost(),spent=state.spent||0,borrowed=state.borrowed||0;
 const planned=state.history.some(h=>h.round===state.round+1)?0:used;
 const remaining=remainingBudget(),own=TOTAL_BUDGET-spent-planned;
 $("budgetUsed").textContent=used;$("budgetSpent").textContent=spent;
 $("budgetRemaining").textContent=remaining;$("budgetOwn").textContent=own;
 $("budgetDebt").textContent=borrowed;
 const last=state.history.find(h=>h.round===state.round+1);
 const load=last?.scoring?.exertion||engine.interventionLoad(selected.map(i=>practices[i][0]),last?.before||state.metrics);
 $("loadPreview").classList.toggle('overloaded',load.excess>0);
 $("loadPreview").innerHTML=`<div><span>Carga de las intervenciones</span><b>${load.load} / ${load.capacity}</b></div><small>${load.excess?`Exceso de ${load.excess} unidades · −${load.penalty} pts por saturación`:'Dentro de la capacidad disponible · sin penalización por saturación'}</small>`;
 document.querySelector(".budgetbox").classList.toggle("inDebt",borrowed>0);
 $("budgetFill").style.width=Math.min(100,((spent+planned)/(TOTAL_BUDGET+borrowed))*100)+"%";
 document.querySelectorAll(".practice").forEach(x=>{
   const i=+x.dataset.i,cost=practiceCosts[practices[i][0]]||0;
   x.classList.toggle("unaffordable",!selected.includes(i)&&cost>remaining);
 });
}
$("loanRequest").onclick=()=>requestLoan(20);
document.querySelectorAll(".practice").forEach(x=>x.onclick=()=>{
 if(!state||!engine.canPlay(state,activeRoom)||submissionPending)return;
 let i=+x.dataset.i;
 if(selected.includes(i)){
   selected=selected.filter(z=>z!==i);x.classList.remove("selected");
 }else{
   const cost=practiceCosts[practices[i][0]]||0;
   if(selected.length>=3){alert("Puedes elegir hasta 3 intervenciones. La saturación depende del tamaño de las acciones y de la capacidad disponible.");return;}
   if(cost>remainingBudget()&&!requestLoan(cost-remainingBudget()))return;
   selected.push(i);x.classList.add("selected");
 }
 x.setAttribute("aria-pressed",String(selected.includes(i)));updateBudget();
});
document.querySelectorAll("[data-bet]").forEach(x=>x.oninput=()=>{$("b_"+x.dataset.bet).textContent=(+x.value>0?"+":"")+x.value});


function drawEvolutionChart(){
 const canvas=$("evolutionChart"); if(!canvas)return;
 const dpr=window.devicePixelRatio||1;
 const rect=canvas.getBoundingClientRect();
 const W=Math.max(520,Math.floor(rect.width||820)), H=340;
 canvas.width=W*dpr;canvas.height=H*dpr;
 const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);
 ctx.clearRect(0,0,W,H);
 const pad={l:44,r:18,t:20,b:48}, cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
 // grid
 ctx.font="11px Arial";ctx.fillStyle="#a6b9bf";ctx.strokeStyle="#294048";ctx.lineWidth=1;
 [0,25,50,75,100].forEach(v=>{
   const y=pad.t+ch-(v/100)*ch;
   ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
   ctx.fillText(String(v),10,y+4);
 });
 const pts=state.evolution||[];
 const series=[...vars,"KPI negocio"];
 // Browser-generated palette: no external dependency.
 const palette=["#ffc400","#6bcdd1","#bca8ff","#ff9f72","#75c79b","#76adf2","#f3a7c8","#e9ede9"];
 series.forEach((s,si)=>{
   ctx.strokeStyle=palette[si%palette.length];ctx.fillStyle=palette[si%palette.length];ctx.lineWidth=2.2;
   ctx.beginPath();
   pts.forEach((p,i)=>{
     const x=pts.length===1?pad.l+cw/2:pad.l+(i/(Math.max(1,pts.length-1)))*cw;
     const val=s==="KPI negocio"?p.business:p.metrics[s];
     const y=pad.t+ch-(val/100)*ch;
     if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   });ctx.stroke();
   pts.forEach((p,i)=>{
     const x=pts.length===1?pad.l+cw/2:pad.l+(i/(Math.max(1,pts.length-1)))*cw;
     const val=s==="KPI negocio"?p.business:p.metrics[s];
     const y=pad.t+ch-(val/100)*ch;
     ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill();
   });
 });
 ctx.fillStyle="#555";ctx.textAlign="center";
 pts.forEach((p,i)=>{
   const x=pts.length===1?pad.l+cw/2:pad.l+(i/(Math.max(1,pts.length-1)))*cw;
   ctx.fillText(p.label,x,H-25);
 });
 ctx.textAlign="left";
 let legend=canvas.parentElement.querySelector(".chartlegend");
 if(!legend){legend=document.createElement("div");legend.className="chartlegend";canvas.parentElement.appendChild(legend)}
 legend.innerHTML=series.map((s,i)=>`<span><i class="chartdot" style="background:${palette[i%palette.length]}"></i>${s}</span>`).join("");
}

function render(){
 let r=rounds[state.round]; $("roundTag").textContent=`Ronda ${state.round+1}/5`; $("roundTitle").textContent=r.title;$("situation").textContent=r.situation;$("signals").innerHTML=r.signals.map(s=>`<div class="signal">${s}</div>`).join("");
 $("scoreTag").textContent=Math.round(state.score)+"/100";
 $("diagnosis").innerHTML=vars.map(v=>`<div class="diagrow"><span>${v}</span><input aria-label="Atención a ${v}" type="range" min="0" max="40" value="0" data-diag="${v}"><b id="d_${v}">0</b></div>`).join("");
 document.querySelectorAll("[data-diag]").forEach(x=>x.oninput=()=>{let sum=[...document.querySelectorAll("[data-diag]")].reduce((a,b)=>a+(+b.value),0);if(sum>100){x.value-=sum-100} $("d_"+x.dataset.diag).textContent=x.value;$("diagSum").textContent=[...document.querySelectorAll("[data-diag]")].reduce((a,b)=>a+(+b.value),0)});
 $("metrics").innerHTML=vars.map(v=>`<div class="metricrow"><span>${v}</span><div class="bar"><div class="fill" style="width:${state.metrics[v]}%"></div></div><b>${Math.round(state.metrics[v])}</b></div>`).join("")+`<div class="metricrow"><span>KPI negocio</span><div class="bar"><div class="fill" style="width:${state.business}%"></div></div><b>${Math.round(state.business)}</b></div>`;
 $("history").innerHTML=state.history.length?state.history.map(h=>`<div class="historyitem"><b>R${h.round}: ${nexusEscape(h.target)}</b> · <b>${h.credits??"—"} créditos invertidos</b><br>${h.practices.map(x=>nexusEscape(easyName(x))).join(" + ")}<br><small>${nexusEscape(h.hypothesis)}</small></div>`).join(""):"Aún no has ejecutado decisiones.";
 renderRanking(); drawEvolutionChart(); updateRoomStatus();
}
function elapsedMs(){
 const clock=state?.clock;
 return clock?.round===state.round+1?(clock.elapsedMs||0)+(clock.runningSince?Math.max(0,Date.now()-clock.runningSince):0):0;
}
function pauseClock(){
 if(!state?.clock)return;
 state.clock.elapsedMs=elapsedMs();state.clock.runningSince=null;clearInterval(tick);save();
}
function startTimer(){
 if(!engine.canPlay(state,activeRoom)||submissionPending)return;
 if(state.clock?.round!==state.round+1)state.clock={round:state.round+1,elapsedMs:0,runningSince:null};
 if(!state.clock.runningSince)state.clock.runningSince=Date.now();
 const update=()=>{
   const left=420-Math.floor(elapsedMs()/1000),seconds=Math.abs(left);
   $("timer").textContent=(left<0?"+":"")+String(Math.floor(seconds/60)).padStart(2,'0')+":"+String(seconds%60).padStart(2,'0');
   $("timer").title='Temps de décision actif · repère de 7 minutes, sans arrêt automatique';
 };
 clearInterval(tick);update();tick=setInterval(update,1000);save();
}
function updateRoomStatus(){
 if(!state)return;
 const done=state.history.some(h=>h.round===state.round+1),finished=state.history.length>=5;
 const playable=engine.canPlay(state,activeRoom)&&!submissionPending;
 $("execute").disabled=!playable||executing;
 $("diagnosisCard").inert=!playable;$("decisionPanel").querySelectorAll('textarea,select,input,button').forEach(el=>el.disabled=!playable||executing);
 document.querySelectorAll('.practice').forEach(el=>{el.setAttribute('aria-disabled',String(!playable));});
 const r=activeRoom;
 let message=!r?'Reconectando con la sala. El avance se habilitará al recuperar la conexión.':finished?'Cinco rondas completadas. Revisa el ranking y lo que aprendió tu organización.':r.status!=='open'?'La sala está cerrada.':r.mode==='autonomous'?'Modalidad autónoma · Tu equipo decide cuándo avanzar a la siguiente ronda.':r.phase==='discussion'?`Ronda ${r.currentRound} · Ranking y conversación. La siguiente ronda la habilita el facilitador.`:done?`Decisión de la ronda ${state.round+1} registrada. Revisa el resultado y el ranking.`:state.round+1>r.currentRound?`En espera · El facilitador habilitará la ronda ${state.round+1}.`:`Sala dirigida · Ronda ${r.currentRound} abierta. Decide y revisa tu feedback antes de conversar.`;
 $("roomStatus").textContent=message;
 $("roomStatus").classList.toggle('waiting',!playable);
 $("roundProgress").innerHTML=rounds.map((_,i)=>`<span class="${state.history.some(h=>h.round===i+1)?'complete':state.round===i?'active':''}"><b>${state.history.some(h=>h.round===i+1)?'✓':String(i+1).padStart(2,'0')}</b> Ronda ${i+1}</span>`).join('');
 const nextAllowed=finished||r?.status==='open'&&(r?.mode==='autonomous'||r?.phase==='deciding'&&r.currentRound>state.round+1);
 $("resultContinue").disabled=submissionPending||!nextAllowed;
 $("resultContinue").textContent=submissionPending?'Confirmando tu decisión…':finished?'Ver mi cierre de la experiencia →':nextAllowed?'Continuar a la siguiente ronda →':'Espera la apertura de la siguiente ronda';
 if(submissionPending){$("resultContinue").disabled=false;$("resultContinue").textContent='Reintentar envío de la decisión';}
 if(playable)startTimer();else pauseClock();
}
window.addEventListener('pagehide',pauseClock);
function effects(){
  let e=Object.fromEntries(vars.map(v=>[v,0]));
  const names=selected.map(i=>practices[i][0]);
  const target=$("target").value;

  const map={
    "ADKAR":{Conciencia:4,Conocimiento:4,Compromiso:2},
    "Lean Change":{Confianza:4,Compromiso:4,Capacidad:2},
    "Moving Motivators":{Compromiso:7,Confianza:3},
    "Delegation Poker":{Confianza:4,Compromiso:5},
    "Campañas de comunicación-difusión":{Conciencia:9,Conocimiento:2,Energía:-1},
    "TRIZ":{Confianza:2,Conciencia:2},
    "Nudges":{Capacidad:3,Compromiso:2},
    "Redes de influencia":{Compromiso:6,Confianza:2},
    "Storytelling":{Conciencia:5,Compromiso:4},
    "Co-creación":{Confianza:5,Compromiso:6,Energía:-3},
    "Aprendizaje experiencial":{Conocimiento:5,Capacidad:8,Energía:-2},
    "Coaching":{Capacidad:5,Confianza:3},
    "Reconocimiento":{Energía:5,Compromiso:5},
    "Comunidades de práctica":{Conocimiento:5,Capacidad:5,Confianza:2},
    "Lecciones aprendidas":{Conocimiento:5,Capacidad:4},
    "Comunicación segmentada":{Conciencia:5,Conocimiento:3},
    "Respaldo directivo":{Conciencia:5,Confianza:6,Compromiso:5},
    "Grupos focales":{Confianza:5,Conciencia:3,Compromiso:4,Energía:-1},
    "Pensamiento científico":{Confianza:4,Conocimiento:3,Compromiso:3},
    "Entrevista motivacional":{Confianza:7,Compromiso:7,Energía:1},
    "Escucha persuasiva":{Confianza:6,Compromiso:5},
    "Escala de disposición al cambio":{Confianza:3,Compromiso:4,Conocimiento:2},
    "Análisis anticipado del fracaso":{Conocimiento:4,Capacidad:4,Confianza:2},
    "Intenciones de implementación":{Capacidad:7,Compromiso:4,Apropiación:4},
    "Identificación de casos exitosos":{Confianza:4,Capacidad:5,Compromiso:4},
    "Inoculación preventiva de objeciones":{Confianza:4,Conocimiento:4,Compromiso:3},
 "Coaching para líderes":{Confianza:5,Compromiso:4,Capacidad:4},"Gestión Humana":{Confianza:4,Compromiso:4,Capacidad:3},"Capacitación":{Conocimiento:8,Capacidad:5,Energía:-2}
  };

  // Pertinencia por momento. No existe una única respuesta correcta:
  // varias prácticas pueden ser válidas, pero no todas son igualmente oportunas.
  const fit=[
{"ADKAR":1.35,"Lean Change":0.75,"Moving Motivators":0.65,"Delegation Poker":0.55,"Campañas de comunicación-difusión":1.25,"TRIZ":0.75,"Nudges":0.45,"Redes de influencia":0.85,"Storytelling":1.25,"Co-creación":0.8,"Aprendizaje experiencial":0.55,"Coaching":0.45,"Reconocimiento":0.55,"Comunidades de práctica":0.5,"Lecciones aprendidas":0.35,"Comunicación segmentada":1.15,"Respaldo directivo":1.1,"Grupos focales":1.0,"Pensamiento científico":0.65,"Entrevista motivacional":0.35,"Escucha persuasiva":0.45,"Escala de disposición al cambio":0.45,"Análisis anticipado del fracaso":0.55,"Intenciones de implementación":0.35,"Identificación de casos exitosos":0.45,"Inoculación preventiva de objeciones":0.65,"Coaching para líderes":0.35,"Gestión Humana":0.7,"Capacitación":0.45},
{"ADKAR":0.75,"Lean Change":1.2,"Moving Motivators":0.8,"Delegation Poker":0.9,"Campañas de comunicación-difusión":0.35,"TRIZ":0.8,"Nudges":0.65,"Redes de influencia":1.15,"Storytelling":0.55,"Co-creación":1.15,"Aprendizaje experiencial":1.35,"Coaching":1.2,"Reconocimiento":0.65,"Comunidades de práctica":1.15,"Lecciones aprendidas":0.7,"Comunicación segmentada":0.7,"Respaldo directivo":0.8,"Grupos focales":1.15,"Pensamiento científico":0.85,"Entrevista motivacional":0.9,"Escucha persuasiva":1.0,"Escala de disposición al cambio":0.85,"Análisis anticipado del fracaso":0.75,"Intenciones de implementación":0.9,"Identificación de casos exitosos":0.85,"Inoculación preventiva de objeciones":0.65},
{"ADKAR":0.45,"Lean Change":0.85,"Moving Motivators":0.75,"Delegation Poker":0.7,"Campañas de comunicación-difusión":0.15,"TRIZ":0.65,"Nudges":0.45,"Redes de influencia":0.8,"Storytelling":0.45,"Co-creación":0.75,"Aprendizaje experiencial":0.55,"Coaching":0.75,"Reconocimiento":0.55,"Comunidades de práctica":0.7,"Lecciones aprendidas":0.55,"Comunicación segmentada":0.45,"Respaldo directivo":0.55,"Grupos focales":0.9,"Pensamiento científico":1.25,"Entrevista motivacional":1.35,"Escucha persuasiva":1.35,"Escala de disposición al cambio":1.2,"Análisis anticipado del fracaso":0.9,"Intenciones de implementación":0.65,"Identificación de casos exitosos":1.0,"Inoculación preventiva de objeciones":1.15,"Coaching para líderes":1.1,"Gestión Humana":1.2,"Capacitación":0.25},
{"ADKAR":0.55,"Lean Change":1.3,"Moving Motivators":0.8,"Delegation Poker":1.05,"Campañas de comunicación-difusión":0.25,"TRIZ":0.7,"Nudges":1.05,"Redes de influencia":1.2,"Storytelling":0.45,"Co-creación":0.8,"Aprendizaje experiencial":1.05,"Coaching":0.85,"Reconocimiento":0.8,"Comunidades de práctica":0.95,"Lecciones aprendidas":0.75,"Comunicación segmentada":0.55,"Respaldo directivo":0.75,"Grupos focales":0.7,"Pensamiento científico":0.8,"Entrevista motivacional":0.65,"Escucha persuasiva":0.6,"Escala de disposición al cambio":0.55,"Análisis anticipado del fracaso":1.0,"Intenciones de implementación":1.25,"Identificación de casos exitosos":1.1,"Inoculación preventiva de objeciones":0.7,"Coaching para líderes":0.8,"Gestión Humana":1.05,"Capacitación":1.2},
{"ADKAR":0.45,"Lean Change":1.05,"Moving Motivators":0.85,"Delegation Poker":0.9,"Campañas de comunicación-difusión":0.15,"TRIZ":0.6,"Nudges":0.9,"Redes de influencia":0.95,"Storytelling":0.35,"Co-creación":0.55,"Aprendizaje experiencial":0.9,"Coaching":0.8,"Reconocimiento":1.25,"Comunidades de práctica":1.2,"Lecciones aprendidas":1.35,"Comunicación segmentada":0.45,"Respaldo directivo":0.65,"Grupos focales":0.65,"Pensamiento científico":0.8,"Entrevista motivacional":0.75,"Escucha persuasiva":0.7,"Escala de disposición al cambio":0.6,"Análisis anticipado del fracaso":1.15,"Intenciones de implementación":1.0,"Identificación de casos exitosos":1.2,"Inoculación preventiva de objeciones":0.7}
][state.round];

  const consequence={high:[],medium:[],low:[],irrelevant:[],counterproductive:[],opportunity:false,synergies:[],warnings:[]};

  names.forEach(n=>{
    const f=fit[n]??.6;
    const base=map[n]||{};

    if(f>=.95){
      consequence.high.push(n);
      // Alta pertinencia: el efecto debe sentirse claramente en el sistema.
      Object.entries(base).forEach(([k,v])=>e[k]+=v*f*1.45);
    }else if(f>=.65){
      consequence.medium.push(n);
      Object.entries(base).forEach(([k,v])=>e[k]+=v*f*.72);
    }else if(f>=.40){
      consequence.low.push(n);
      Object.entries(base).forEach(([k,v])=>e[k]+=v*f*.28);
      // costo de dispersión: aporta poco y consume capacidad de cambio
      e.Energía-=2;e.Confianza-=1;e.Compromiso-=1;e.Capacidad-=1;e.Apropiación-=1.5;
    }else if(f>=.25){
      consequence.irrelevant.push(n);
      e.Energía-=4;e.Confianza-=3;e.Compromiso-=3;e.Capacidad-=2.5;e.Apropiación-=3.5;
    }else{
      consequence.counterproductive.push(n);
      Object.entries(base).forEach(([k,v])=>{if(v<0)e[k]+=v;});
      e.Energía-=7;e.Confianza-=6;e.Compromiso-=5;e.Capacidad-=5;e.Apropiación-=6;
    }
  });

  // Calidad del diagnóstico: enfocar el objetivo que el equipo identificó como crítico suma;
  // diagnosticar una cosa e intervenir otra genera incoherencia.
  const attention=Object.fromEntries([...document.querySelectorAll("[data-diag]")].map(x=>[x.dataset.diag,+x.value]));
  const highest=Object.entries(attention).sort((a,b)=>b[1]-a[1])[0];
  if(highest&&attention[target]===highest[1])e[target]+=3;
  if(highest&&highest[1]>=40&&attention[target]<highest[1]){
    e.Confianza-=2;e.Energía-=2;
    consequence.warnings.push("El foco de la intervención no coincide con la principal hipótesis diagnóstica del equipo.");
  }

  // Sinergias: combinaciones que se refuerzan entre sí.
  if(names.includes("Grupos focales")&&names.includes("Lean Change")){e.Confianza+=3;e.Compromiso+=2;consequence.synergies.push("Escucha + experimentación: el feedback se convierte en ajustes visibles.");}
  if(names.includes("Respaldo directivo")&&names.includes("Campañas de comunicación-difusión")){e.Conciencia+=4;consequence.synergies.push("Patrocinio + comunicación: aumenta la legitimidad del mensaje.");}
  if(names.includes("Redes de influencia")&&names.includes("Reconocimiento")){e.Compromiso+=3;e.Confianza+=2;consequence.synergies.push("Influencia + reconocimiento: se refuerzan conductas visibles en la red.");}
  if(names.includes("Aprendizaje experiencial")&&names.includes("Comunidades de práctica")){e.Capacidad+=4;e.Conocimiento+=2;consequence.synergies.push("Práctica + aprendizaje entre pares: acelera transferencia y capacidad.");}
  if(names.includes("Co-creación")&&names.includes("Delegation Poker")){e.Compromiso+=3;e.Confianza+=2;consequence.synergies.push("Co-creación + autonomía: aumenta participación con capacidad de decisión.");}

  // Condiciones contextuales: una práctica pertinente también puede ser mal ejecutada
  // si el sistema no tiene las condiciones necesarias.
  if(names.includes("Co-creación")&&state.metrics.Energía<50){e.Energía-=6;e.Compromiso-=2;consequence.warnings.push("Co-crear con energía baja aumentó la carga del sistema.");}
  if(names.includes("Delegation Poker")&&state.metrics.Capacidad<45){e.Confianza-=3;consequence.warnings.push("Delegar sin suficiente capacidad generó incertidumbre.");}
  if(names.includes("Aprendizaje experiencial")&&state.metrics.Compromiso<40){e.Energía-=3;consequence.warnings.push("La práctica exigió esfuerzo en un sistema con bajo compromiso.");}
  if(names.includes("Campañas de comunicación-difusión")&&state.metrics.Conciencia>75){e.Energía-=5;e.Confianza-=2;consequence.warnings.push("Más comunicación masiva cuando la conciencia ya era alta produjo saturación.");}
  if(names.includes("Reconocimiento")&&state.metrics.Confianza<40){e.Confianza-=3;consequence.warnings.push("El reconocimiento fue percibido con baja credibilidad por la falta de confianza.");}

  // Reglas conductuales de las tres nuevas intervenciones.
  if(names.includes("Capacitación")&&state.metrics.Conocimiento>=70){e.Energía-=5;e.Confianza-=2;consequence.warnings.push("La capacitación no resolvió el problema: el equipo ya conocía el cambio.");}
  if(names.includes("Capacitación")&&state.metrics.Compromiso<40){e.Energía-=4;e.Compromiso-=2;consequence.warnings.push("Capacitar sin disposición al cambio aumentó el cansancio.");}
  if(names.includes("Gestión Humana")&&names.includes("Coaching para líderes")){e.Confianza+=3;e.Capacidad+=2;consequence.synergies.push("Gestión Humana + coaching: apoyo especializado y líderes mejor preparados.");}
  if(names.includes("Capacitación")&&names.includes("Aprendizaje experiencial")){e.Capacidad+=4;e.Conocimiento+=2;consequence.synergies.push("Capacitación + práctica: el aprendizaje se convierte en habilidad.");}
  if(names.includes("Coaching para líderes")&&state.metrics.Energía<40){e.Energía-=3;consequence.warnings.push("El coaching no compensa por sí solo una sobrecarga de trabajo.");}
  if(names.includes("Gestión Humana")&&state.round===2&&names.includes("Escucha persuasiva")){e.Confianza+=3;e.Compromiso+=2;consequence.synergies.push("Gestión Humana + escucha: se atienden preocupaciones con apoyo concreto.");}
  // Costo de oportunidad: si ninguna intervención tiene pertinencia media-alta,
  // el problema central continúa avanzando aunque el equipo haya gastado recursos.
  const useful=consequence.high.length+consequence.medium.length;
  if(useful===0){
    consequence.opportunity=true;
    const deterioration=[
      {Confianza:-2,Energía:-2,Compromiso:-3,Capacidad:-2,Apropiación:-3},
      {Confianza:-2,Energía:-3,Compromiso:-2,Capacidad:-3,Apropiación:-3},
      {Confianza:-2,Energía:-4,Compromiso:-3,Capacidad:-3,Apropiación:-4},
      {Confianza:-2,Energía:-4,Compromiso:-3,Capacidad:-2,Apropiación:-4},
      {Confianza:-2,Energía:-5,Compromiso:-3,Capacidad:-3,Apropiación:-5}
    ][state.round];
    Object.entries(deterioration).forEach(([k,v])=>e[k]+=v);
    consequence.warnings.push("Costo de oportunidad: se invirtieron recursos sin intervenir suficientemente la condición crítica de la ronda.");
  }

  // Proporcionalidad: tres acciones pequeñas pueden caber; una combinación
  // grande solo satura si supera la capacidad que permiten energía y habilidad.
  const loadInfo=engine.interventionLoad(names,state.metrics);
  if(loadInfo.excess>0){
    e.Energía-=loadInfo.excess*2;e.Confianza-=loadInfo.excess*.75;e.Compromiso-=loadInfo.excess*.5;
    consequence.warnings.push(`La carga de las acciones (${loadInfo.load}) superó la capacidad disponible (${loadInfo.capacity}) en ${loadInfo.excess} unidades. El exceso aumentó el cansancio y la coordinación necesaria.`);
  }

  // Presión natural de cada ronda: no actuar bien también tiene consecuencias.
  const pressure=[{Energía:-2},{Energía:-4,Capacidad:-2},{Energía:-6,Confianza:-2},{Energía:-5,Compromiso:-2},{Energía:-5,Compromiso:-3}][state.round];
  Object.entries(pressure).forEach(([k,v])=>e[k]+=v);

  // Variabilidad moderada para evitar resultados completamente mecánicos.
  // Sin azar: decisiones idénticas en el mismo contexto producen el mismo resultado.

  e.__consequence=consequence;
  return e;
}

async function execute(){
 if(executing||submissionPending||!engine.canPlay(state,activeRoom))return;
 const attention=Object.fromEntries([...document.querySelectorAll('[data-diag]')].map(x=>[x.dataset.diag,+x.value]));
 if(Object.values(attention).reduce((a,b)=>a+b,0)!==100)return alert('Distribuye exactamente 100 puntos de atención.');
 if(!selected.length)return alert('Selecciona al menos una intervención.');
 if(selectedCost()>TOTAL_BUDGET+(state.borrowed||0)-(state.spent||0))return alert('Solicita financiación antes de ejecutar la intervención.');
 const hyp=$("hypothesis").value.trim();if(hyp.length<20)return alert('Formula una hipótesis de al menos 20 caracteres.');
 executing=true;$("execute").disabled=true;
 const roundSpend=selectedCost();
 const elapsedSeconds=elapsedMs()/1000;pauseClock(); let e=effects(), consequence=e.__consequence||{}; delete e.__consequence; let before={...state.metrics};
 vars.forEach(v=>state.metrics[v]=Math.max(0,Math.min(100,state.metrics[v]+e[v])));
  // Apropiación sistémica: depende especialmente de compromiso, capacidad y confianza.
  // Una mala decisión no puede convertir automáticamente el deterioro en una mejora.
  const appropriationAfterDecision=state.metrics.Apropiación;
  let emerg=(state.metrics.Conciencia*.18+state.metrics.Compromiso*.27+state.metrics.Conocimiento*.12+state.metrics.Capacidad*.27+state.metrics.Confianza*.16);
  let emergentAppropriation=appropriationAfterDecision*.78+emerg*.22;
  const badDecision=(consequence.irrelevant?.length||0)>0 || (consequence.counterproductive?.length||0)>0 || consequence.opportunity;
  state.metrics.Apropiación=Math.max(0,Math.min(100,badDecision?Math.min(appropriationAfterDecision,emergentAppropriation):emergentAppropriation));
 state.business=Math.max(0,Math.min(100,state.business+(state.metrics.Apropiación-45)*.10+(state.metrics.Capacidad-45)*.06));
 let bets=Object.fromEntries([...document.querySelectorAll("[data-bet]")].map(x=>[x.dataset.bet,+x.value]));

 const scoring=engine.scoreRound({round:state.round+1,practices:selected.map(i=>practices[i][0]),consequence,attention,target:$("target").value,bets,before,after:state.metrics,credits:roundSpend,elapsedSeconds});
 const previous=state.history.map(h=>h.scoring?.totalNoDebt??h.baseScore).filter(Number.isFinite);
 state.baseScore=Math.round((previous.reduce((a,b)=>a+b,0)+scoring.totalNoDebt)/(previous.length+1));
 state.score=Math.max(0,state.baseScore-debtPenalty());
 state.spent=(state.spent||0)+roundSpend;
 const decisionRecord={id:crypto.randomUUID(),round:state.round+1,target:$("target").value,audience:$("audience").value,practices:selected.map(i=>practices[i][0]),credits:roundSpend,hypothesis:hyp,consequence,before:{...before},after:{...state.metrics},attention,bets,scoring,score:state.score,baseScore:state.baseScore,borrowed:state.borrowed,business:state.business,spent:state.spent,decidedAt:new Date().toISOString()};
 state.history.push(decisionRecord);state.evolution.push({label:'R'+(state.round+1),metrics:{...state.metrics},business:state.business});
 submissionPending=true;save();showResult(decisionRecord);renderMetricsOnly();updateBudget();drawEvolutionChart();
 const saved=await syncScore();submissionPending=!saved;executing=false;updateRoomStatus();
 if(!saved)$("resultSyncStatus").textContent='Tu decisión aún no está confirmada en la sala. Reintenta el envío para que cuente en el ranking. '+$("rankingStatus").textContent;
}
function showResult(h){
 const before=h.before||{},after=h.after||state.metrics,consequence=h.consequence||{};
 const net=vars.reduce((a,v)=>a+(after[v]||0)-(before[v]||0),0);
 const verdict=net>10?'Tu decisión movió el sistema.':net>=0?'Avances con costos que revisar.':'Es momento de ajustar el rumbo.';
 $("resultRoundNumber").textContent=h.round;$("resultVerdict").textContent=verdict;
 $("resultScore").textContent=(h.score??state.score)+'/100';
 $("resultTarget").textContent=h.target;$("resultAudience").textContent=h.audience;
 $("resultHypothesis").textContent=h.hypothesis;
 $("resultPractices").innerHTML=(h.practices||[]).map(p=>`<span>${nexusEscape(easyName(p))}</span>`).join('');
 $("resultSpentRound").textContent=h.credits+' créditos';
 $("resultBudgetLeft").textContent=(TOTAL_BUDGET+(h.borrowed??state.borrowed)-(h.spent??state.spent))+' créditos';
 $("resultDebt").textContent=(h.borrowed??state.borrowed)+' créditos';
 $("resultBusiness").textContent=Math.round(h.business??state.business)+'/100';
 $("resultReading").textContent=net>0?'Hubo una mejora global en los indicadores. Revisa también las dimensiones que bajaron: una mejora total puede esconder fatiga o pérdida de confianza.':'El efecto global fue limitado o negativo. Contrasta la pertinencia de cada acción con las señales del caso y la energía disponible.';
 $("resultDeltas").innerHTML=vars.map(v=>{const d=Math.round((after[v]||0)-(before[v]||0));return `<div class="resultDelta"><span>${v}</span><div class="resultDeltaBar"><i style="width:${Math.round(after[v]||0)}%"></i></div><b class="${d<0?'down':'up'}">${Math.round(after[v]||0)} (${d>0?'+':''}${d})</b></div>`;}).join('');
 $("resultWarnings").innerHTML=[...(consequence.warnings||[]),...(consequence.synergies||[])].map(w=>`<div class="resultWarning">${nexusEscape(w)}</div>`).join('');
 renderScoreFeedback(h);
 $("roundResultOverlay").classList.add('show');$("roundResultOverlay").scrollTop=0;setLayer('roundResultOverlay');
 updateRoomStatus();renderLiveRanking();$("roundResultOverlay").focus();
}
function renderScoreFeedback(h){
 const score=h.scoring;
 if(!score){$("resultLoadSummary").textContent='';$("resultScoreFormula").textContent='Esta decisión pertenece a la versión anterior del puntaje.';$("resultScoreBreakdown").innerHTML='';$("resultPersonalFeedback").innerHTML='';return;}
 const labels={relevance:['Pertinencia',40],diagnosis:['Lectura del problema',20],forecast:['Predicción',10],impact:['Efecto en el sistema',15],focus:['Foco y recursos',10],speed:['Agilidad con criterio',5]};
 const debt=Math.min(50,Math.round((h.borrowed||0)*.4));
 const load=score.exertion;
 $("resultLoadSummary").textContent=load?`Carga de esta decisión: ${load.load}/${load.capacity} unidades. `+load.actions.map(a=>`${easyName(a.name)}: ${a.size.toLowerCase()} (${a.units})`).join(' · '):'Esta decisión se registró antes del cálculo proporcional de carga.';
 $("resultScoreFormula").textContent=`Esta ronda: ${score.totalNoDebt}/100. Ranking: promedio de tus rondas evaluadas (${h.baseScore}/100) menos ${debt} puntos por deuda = ${h.score}/100.`;
 $("resultScoreBreakdown").innerHTML=Object.entries(labels).map(([k,[label,max]])=>`<div><span>${label}</span><b>+${score.points[k]}<small> / ${max}</small></b></div>`).join('')+Object.entries({Saturación:score.penalties.overload,'Acciones inoportunas':score.penalties.wrong,'Demora al decidir':score.penalties.delay}).map(([label,value])=>`<div class="${value?'negative':''}"><span>${label}</span><b>−${value}</b></div>`).join('');
 $("resultPersonalFeedback").innerHTML=score.feedback.map(f=>`<li>${nexusEscape(f)}</li>`).join('');
}
function renderMetricsOnly(){$("metrics").innerHTML=vars.map(v=>`<div class="metricrow"><span>${v}</span><div class="bar"><div class="fill" style="width:${state.metrics[v]}%"></div></div><b>${Math.round(state.metrics[v])}</b></div>`).join("")+`<div class="metricrow"><span>KPI negocio</span><div class="bar"><div class="fill" style="width:${state.business}%"></div></div><b>${Math.round(state.business)}</b></div>`;$("scoreTag").textContent=state.score+"/100"}
function save(){localStorage.setItem(stateKey(),JSON.stringify(state))}
function nexusError(e){return window.NEXUS_FIREBASE?.error(e)||String(e?.message||e);}
function nexusEscape(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
// El equipo conserva su historial y puntaje en un mismo documento de Firestore.
// Evitamos depender de dos solicitudes separadas para mostrar decisiones y ranking.
let scoreSaveQueue=Promise.resolve();
function syncScore(){
 if(!state||!team||!classCode)return Promise.resolve(false);
 const snapshot=JSON.parse(JSON.stringify(state)),code=classCode,name=team;
 const task=async()=>{
   try{
     await window.NEXUS_FIREBASE.save(code,name,snapshot);
     $("rankingStatus").textContent='';
     if(snapshot.history.length)$("resultSyncStatus").textContent='Decisión confirmada. Tu resultado ya cuenta en el ranking.';
     return true;
   }catch(e){
     console.error('NEXUS guardado en Firestore',e);
     $("rankingStatus").textContent=nexusError(e)+' Tu avance se conserva localmente.';
     $("resultSyncStatus").textContent=snapshot.history.length?'El envío no está confirmado. Reintenta antes de continuar. '+nexusError(e):'';
     return false;
   }
 };
 const pending=scoreSaveQueue.then(task,task);scoreSaveQueue=pending;return pending;
}
let rankingCode='';
function renderRanking(force=false){
 if(!state||!team||!classCode)return;
 if(!force&&rankingCode===classCode)return;
 rankingCode=classCode;
 try{
   window.NEXUS_FIREBASE.ranking(classCode,rows=>{
     currentRanking=rows;renderLiveRanking();
     $("rankingStatus").textContent=rows.length?"":"Aún no hay equipos registrados en esta clase.";
   },e=>{
     $("ranking").innerHTML="";
     $("rankingStatus").textContent=e;rankingCode='';
   });
 }catch(e){$("rankingStatus").textContent=nexusError(e);rankingCode='';}
}
function renderLiveRanking(){
 let previousScore=null,place=0;
 const html=currentRanking.map((r,i)=>{
   if(i===0||r.score!==previousScore)place=i+1;previousScore=r.score;
   const medal=place===1?'🥇':place===2?'🥈':place===3?'🥉':String(place);
   return `<div class="rankrow ${r.team===team?'me':''}"><span class="rankPos">${medal}</span><span>${nexusEscape(r.team)}${r.team===team?' <small>Tu equipo</small>':''}</span><b>${Math.round(r.score||0)}<small> /100</small></b><span>R${r.round||1}</span><span class="${r.borrowed?'debtLabel':'muted'}">${r.borrowed?'Deuda '+r.borrowed:'Sin deuda'}</span></div>`;
 }).join('')||'<p class="muted">Esperando las primeras decisiones de la sala…</p>';
 $("ranking").innerHTML=html;$("resultRanking").innerHTML=html;
}
const refreshRankingBtn=$("refreshRanking");
if(refreshRankingBtn)refreshRankingBtn.onclick=()=>renderRanking(true);

// Firestore actualiza el ranking al cambiar los documentos, sin sondeos periódicos.
$("execute").onclick=execute;
async function continueAfterResult(){
 if(executing)return;
 if(submissionPending){
   executing=true;$("resultContinue").disabled=true;
   const saved=await syncScore();submissionPending=!saved;executing=false;updateRoomStatus();return;
 }
 if(!state.history.some(h=>h.round===state.round+1))return;
 const finished=state.history.length>=5;
 if(!finished&&!(activeRoom?.status==='open'&&(activeRoom.mode==='autonomous'||activeRoom.phase==='deciding'&&activeRoom.currentRound>state.round+1)))return;
 $("roundResultOverlay").classList.remove('show');setLayer('');
 if(finished){
   $("feedback").innerHTML=`<b>Simulación finalizada</b><p>Índice de decisión: <strong>${state.score}/100</strong>. Revisa la evolución de tu organización y el ranking en vivo.</p>`;
   $("history").innerHTML=state.history.map(h=>`<div class="historyitem"><b>Ronda ${h.round} · ${nexusEscape(h.target)}</b><p>${h.practices.map(p=>nexusEscape(easyName(p))).join(' + ')}</p><small>${nexusEscape(h.hypothesis)}</small><b>${h.score??'—'}/100 en el ranking</b></div>`).join('');
   updateRoomStatus();window.scrollTo({top:0,behavior:'smooth'});return;
 }
 pauseClock();state.round++;selected=[];
 document.querySelectorAll('.practice').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});
 $("hypothesis").value='';$("feedback").innerHTML='';$("diagSum").textContent='0';
 document.querySelectorAll('[data-bet]').forEach(x=>{x.value=0;$("b_"+x.dataset.bet).textContent='0';});
 updateBudget();save();render();void syncScore();window.scrollTo({top:0,behavior:'smooth'});
}
$("resultContinue").onclick=continueAfterResult;
$("next").onclick=continueAfterResult;

$("joinBtn").addEventListener("click", enterGame);
$("joinTeam").value=localStorage.getItem("changeTeam")||"";
const roomFromLink=new URLSearchParams(location.search).get("sala");
$("joinCode").value=roomFromLink&&/^[A-Z0-9-]{3,30}$/i.test(roomFromLink)?roomFromLink.toUpperCase():localStorage.getItem("changeClassCode")||"";
["joinTeam","joinCode"].forEach(id=>{
  $(id).addEventListener("keydown",e=>{
    if(e.key==="Enter") enterGame();
  });
});
window.addEventListener("resize",()=>{if(state)drawEvolutionChart();});

// Una sola pantalla interactiva a la vez, también para navegación por teclado.
function setLayer(id){
 document.body.style.overflow=id?'hidden':'';
 for(const node of document.body.children){
   if(['SCRIPT','STYLE','LINK'].includes(node.tagName))continue;
   node.inert=Boolean(id)&&node.id!==id;
 }
}
setLayer('joinOverlay');
