'use strict';
// Proyecto NEXUS: transporte Firebase unificado con los demás laboratorios.
// No altera la simulación; Firestore conserva puntaje, decisiones y estado por equipo.
(function(){
  const ROOT='nexus_rooms';
  let app=null,auth=null,db=null,unsubRanking=null;
  let activeCode='',activeUid='',activeTeam='';
  const err=e=>{
    const s=String(e?.code||e?.message||e||'');
    if(/permission-denied|insufficient permissions/i.test(s))
      return 'Firestore rechazó la operación. Publica las reglas de NEXUS y verifica el acceso a la sala.';
    if(/auth\/operation-not-allowed/i.test(s))
      return 'Activa Correo/Contraseña y Anónimo en Firebase Authentication.';
    if(/auth\/invalid-credential|auth\/wrong-password/i.test(s))
      return 'Correo o contraseña incorrectos en Firebase Authentication.';
    if(/auth\/unauthorized-domain/i.test(s))
      return 'Autoriza el dominio de GitHub Pages en Firebase Authentication.';
    if(/unavailable|network-request-failed|failed to fetch/i.test(s))
      return 'No fue posible conectarse con Firebase. Comprueba tu red e inténtalo de nuevo.';
    return String(e?.message||e||'Error inesperado de Firebase.');
  };
  function init(){
    const conf=window.FIREBASE_CONFIG;
    if(!window.firebase||!conf?.apiKey||!conf?.projectId)
      throw Error('No se cargó Firebase o su configuración. Actualiza la página y verifica la conexión.');
    if(!app){
      app=firebase.apps.length?firebase.app():firebase.initializeApp(conf);
      auth=firebase.auth(app);
      db=firebase.firestore(app);
    }
  }
  const roomRef=code=>db.collection(ROOT).doc(code);
  function stopRanking(){
    if(unsubRanking){unsubRanking();unsubRanking=null;}
  }
  function timestamp(value){
    if(value?.toDate)return value.toDate().toISOString();
    return value||new Date().toISOString();
  }
  function scoreData(code,team,state){
    return {
      ownerUid:activeUid,team,score:Math.max(0,Math.min(100,Math.round(state.score||0))),
      baseScore:Math.max(0,Math.min(100,Math.round(state.baseScore??state.score??0))),
      round:Math.max(1,Math.min(5,(state.round||0)+1)),
      business:Math.max(0,Math.min(100,Math.round(state.business||0))),
      appropriation:Math.max(0,Math.min(100,Math.round(state.metrics?.Apropiación||0))),
      spent:Math.max(0,Math.round(state.spent||0)),
      borrowed:Math.max(0,Math.round(state.borrowed||0)),
      gameState:JSON.parse(JSON.stringify(state)),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
  }
  function publicScore(team,state){
    return {
      ownerUid:activeUid,team,score:Math.max(0,Math.min(100,Math.round(state.score||0))),
      round:Math.max(1,Math.min(5,(state.round||0)+1)),
      borrowed:Math.max(0,Math.round(state.borrowed||0)),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
  }
  async function join(code,team,state){
    init();
    stopRanking();
    // Esperar la restauración de la sesión anónima antes de generar otra identidad.
    await new Promise((resolve,reject)=>{
      let unsubscribe;
      unsubscribe=auth.onAuthStateChanged(()=>{unsubscribe();resolve();},reject);
    });
    if(auth.currentUser&&!auth.currentUser.isAnonymous)await auth.signOut();
    if(!auth.currentUser)await auth.signInAnonymously();
    const uid=auth.currentUser.uid;
    const room=await roomRef(code).get();
    if(!room.exists)throw Error('No existe esta sala. El facilitador debe crearla desde su panel antes de jugar.');
    if(room.data().status!=='open')throw Error('La sala está cerrada. Pide al facilitador que la habilite.');
    const ref=roomRef(code).collection('teams').doc(uid);
    const existing=await ref.get();
    if(existing.exists && existing.data().team!==team)
      throw Error('Este dispositivo ya se registró como '+existing.data().team+' en la clase. Usa ese nombre para continuar.');
    activeCode=code;activeTeam=team;activeUid=uid;
    let restore=null;
    if(existing.exists){
      restore=existing.data().gameState||null;
    }else{
      // Registro atómico: las decisiones completas quedan privadas, el ranking es público en la sala.
      const batch=db.batch();
      batch.set(ref,scoreData(code,team,state));
      batch.set(roomRef(code).collection('ranking').doc(uid),publicScore(team,state));
      await batch.commit();
    }
    return {restore,room:room.data()};
  }
  async function save(code,team,state){
    init();
    if(!auth.currentUser||auth.currentUser.uid!==activeUid||code!==activeCode||team!==activeTeam)
      throw Error('No hay una sesión de equipo activa para esta sala.');
    // El documento de sala decide el avance, también si se abre una pestaña antigua.
    await db.runTransaction(async tx=>{
      const room=await tx.get(roomRef(code));
      const ref=roomRef(code).collection('teams').doc(activeUid);
      const saved=await tx.get(ref);
      if(!room.exists||room.data().status!=='open')throw Error('La sala está cerrada.');
      const oldHistory=saved.data()?.gameState?.history||[];
      const history=state.history||[];
      if(history.length<oldHistory.length)throw Error('Hay un avance más reciente. Vuelve a ingresar para recuperarlo.');
      if(history.length>oldHistory.length+1)throw Error('Debes registrar las decisiones una ronda a la vez.');
      if(history.length>oldHistory.length){
        const config=window.NEXUS_ENGINE.roomConfig(room.data());
        const decision=history[history.length-1];
        if(decision.round!==oldHistory.length+1)throw Error('La decisión no corresponde a la siguiente ronda.');
        if(config.mode==='guided'&&(config.phase!=='deciding'||decision.round>config.currentRound))
          throw Error('El facilitador aún no ha habilitado esta ronda o ya abrió la conversación.');
      }else if(history.some((h,i)=>h.id&&oldHistory[i]?.id&&h.id!==oldHistory[i].id)){
        throw Error('Otra pestaña ya registró esta ronda. Vuelve a ingresar para recuperar el resultado.');
      }
      tx.update(ref,scoreData(code,team,state));
      tx.set(roomRef(code).collection('ranking').doc(activeUid),publicScore(team,state));
    });
    return true;
  }
  function ranking(code,onUpdate,onError){
    init();stopRanking();
    if(!auth.currentUser)throw Error('Entra a una sala antes de consultar el ranking.');
    unsubRanking=roomRef(code).collection('ranking').onSnapshot(snap=>{
      const rows=snap.docs.map(d=>({...d.data(),id:d.id,updated_at:timestamp(d.data().updatedAt)}))
        .sort((a,b)=>(b.score||0)-(a.score||0)||String(a.team).localeCompare(String(b.team)));
      onUpdate(rows);
    },e=>onError(err(e)));
  }
  async function login(email,password){
    init();
    stopRanking();
    const credential=await auth.signInWithEmailAndPassword(email,password);
    const token=await credential.user.getIdTokenResult(true);
    if(token.claims.facilitator!==true){
      await auth.signOut();
      throw Error('Cuenta autenticada, pero sin el permiso facilitator=true en Firebase.');
    }
    activeCode='';activeUid='';activeTeam='';
    return credential.user.uid;
  }
  async function createRoom(code,mode="guided"){
    init();
    const user=auth.currentUser;
    if(!user||user.isAnonymous)throw Error('Inicia sesión como facilitador.');
    const token=await user.getIdTokenResult();
    if(token.claims.facilitator!==true)throw Error('Tu cuenta no tiene el rol de facilitador.');
    const ref=roomRef(code),snapshot=await ref.get();
    if(snapshot.exists){
      if(snapshot.data().hostUid!==user.uid)throw Error('La sala ya pertenece a otro facilitador.');
      return false;
    }
    await ref.set({gameId:'nexus-v1',hostUid:user.uid,classCode:code,status:'open',
      mode:mode==='guided'?'guided':'autonomous',currentRound:1,phase:'deciding',
      scoringVersion:2,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    return true;
  }
  function watchRoom(code,onUpdate,onError){
    init();
    return roomRef(code).onSnapshot(snap=>onUpdate(snap.exists?snap.data():null),e=>onError(err(e)));
  }
  async function controlRoom(code,action,value){
    init();
    const user=auth.currentUser;
    if(!user||user.isAnonymous)throw Error('Inicia sesión como facilitador.');
    await db.runTransaction(async tx=>{
      const ref=roomRef(code),snapshot=await tx.get(ref);
      if(!snapshot.exists||snapshot.data().hostUid!==user.uid)throw Error('No tienes acceso a esta sala.');
      const config=window.NEXUS_ENGINE.roomConfig(snapshot.data());
      const patch={updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
      if(action==='mode'){
        patch.mode=value==='guided'?'guided':'autonomous';
        patch.currentRound=config.currentRound;patch.phase='deciding';
      }else if(action==='discussion'){
        if(config.mode!=='guided')throw Error('Esta sala es autónoma.');
        patch.phase='discussion';
      }else if(action==='next'){
        if(config.mode!=='guided'||config.phase!=='discussion')throw Error('Muestra primero el ranking y conversa sobre esta ronda.');
        if(config.currentRound>=5)throw Error('Ya se completaron las cinco rondas.');
        patch.currentRound=config.currentRound+1;patch.phase='deciding';
      }else if(action==='resume'){
        patch.phase='deciding';
      }else throw Error('Acción de sala desconocida.');
      tx.update(ref,patch);
    });
  }
  async function subscribeRoom(code,onUpdate,onError){
    init();
    const user=auth.currentUser;
    if(!user||user.isAnonymous)throw Error('Debes ingresar como facilitador.');
    const room=await roomRef(code).get();
    if(!room.exists)throw Error('Esta sala aún no existe. Haz clic en CREAR SALA para activarla.');
    if(room.data().hostUid!==user.uid)throw Error('Esta sala pertenece a otra cuenta de facilitador.');
    return roomRef(code).collection('teams').onSnapshot(snapshot=>{
      const rows=snapshot.docs.map(d=>({...d.data(),id:d.id,updated_at:timestamp(d.data().updatedAt)}))
        .sort((a,b)=>(b.score||0)-(a.score||0)||String(a.team).localeCompare(String(b.team)));
      const decisions=rows.flatMap(r=>(r.gameState?.history||[]).map(h=>({
        team:r.team,round:h.round,objective:h.target,audience:h.audience,
        practices:h.practices,hypothesis:h.hypothesis,
        consequence:(h.consequence?.warnings||[]).join(' · '),
        credits:h.credits,borrowed:r.borrowed||0
      })));
      onUpdate(rows,decisions);
    },e=>onError(err(e)));
  }
  window.NEXUS_FIREBASE={init,join,save,ranking,login,createRoom,subscribeRoom,watchRoom,controlRoom,stopRanking,error:err};
})();

