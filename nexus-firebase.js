'use strict';
// Proyecto NEXUS: transporte Firebase unificado con los demás laboratorios.
// No altera la simulación; Firestore conserva puntaje, decisiones y estado por equipo.
(function(){
  const ROOT='nexus_rooms';
  let app=null,auth=null,db=null,unsubRanking=null;
  let activeCode='',activeUid='',activeTeam='',activeEpoch=0;
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
      ownerUid:activeUid,team,resetEpoch:Number(state.sessionEpoch)||0,score:Math.max(0,Math.min(100,Math.round(state.score||0))),
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
      ownerUid:activeUid,team,resetEpoch:Number(state.sessionEpoch)||0,score:Math.max(0,Math.min(100,Math.round(state.score||0))),
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
    let room;
    try{room=await roomRef(code).get();}
    catch(error){
      if(error?.code==='permission-denied')throw Error('Firebase no permite consultar la sala. Verifica que el acceso anónimo esté habilitado y publica las reglas actualizadas de NEXUS.');
      throw error;
    }
    if(!room.exists)throw Error('No existe esta sala. El facilitador debe crearla desde su panel antes de jugar.');
    if(room.data().status!=='open')throw Error('La sala no admite ingresos en este momento. Consulta al facilitador.');
    const epoch=Number(room.data().resetEpoch)||0;
    let removed;
    try{removed=await roomRef(code).collection('removed').doc(uid).get();}
    catch(error){
      if(error?.code==='permission-denied')throw Error('Firebase no permite comprobar el acceso de equipos retirados. Las reglas activas de NEXUS probablemente son anteriores a los nuevos controles. Publica el archivo firestore.rules actualizado.');
      throw error;
    }
    if(removed.exists&&removed.data().resetEpoch===epoch)
      throw Error('El facilitador retiró este equipo de la sala. Solicita su autorización antes de volver a participar.');
    const ref=roomRef(code).collection('teams').doc(uid);
    const existing=await ref.get();
    if(existing.exists && Number(existing.data().resetEpoch||0)!==epoch)
      throw Error('La sala se reinició. Vuelve a ingresar para comenzar de nuevo.');
    if(existing.exists && existing.data().team!==team)
      throw Error('Este dispositivo ya se registró como '+existing.data().team+' en la clase. Usa ese nombre para continuar.');
    activeCode=code;activeTeam=team;activeUid=uid;activeEpoch=epoch;
    state.sessionEpoch=epoch;
    let restore=null;
    if(existing.exists){
      restore=existing.data().gameState||null;
      if(restore)restore.sessionEpoch=epoch;
    }else{
      // Registro atómico: las decisiones completas quedan privadas, el ranking es público en la sala.
      const batch=db.batch();
      batch.set(ref,scoreData(code,team,state));
      batch.set(roomRef(code).collection('ranking').doc(uid),publicScore(team,state));
      try{await batch.commit();}
      catch(error){
        if(error?.code==='permission-denied')throw Error('Firebase no permitió guardar el equipo y su ranking. Debes publicar las reglas nuevas de NEXUS, que incluyen resetEpoch y los controles de participantes.');
        throw error;
      }
    }
    return {restore,room:room.data()};
  }
  async function save(code,team,state){
    init();
    if(!auth.currentUser||auth.currentUser.uid!==activeUid||code!==activeCode||team!==activeTeam)
      throw Error('No hay una sesión de equipo activa para esta sala.');
    if(Number(state.sessionEpoch||0)!==activeEpoch)
      throw Error('La sala ha sido reiniciada. Ingresa de nuevo para empezar desde cero.');
    // El documento de sala decide el avance, también si se abre una pestaña antigua.
    await db.runTransaction(async tx=>{
      const room=await tx.get(roomRef(code));
      const ref=roomRef(code).collection('teams').doc(activeUid);
      const saved=await tx.get(ref);
      if(!room.exists||room.data().status!=='open')throw Error('La sala no acepta decisiones en este momento.');
      if(Number(room.data().resetEpoch||0)!==Number(state.sessionEpoch||0))
        throw Error('Esta decisión pertenece a una partida anterior. Vuelve a ingresar a la sala.');
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
    activeCode='';activeUid='';activeTeam='';activeEpoch=0;
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
      mode:mode==='guided'?'guided':'autonomous',currentRound:1,
      phase:mode==='guided'?'waiting':'deciding',resetEpoch:0,
      scoringVersion:3,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
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
      if(config.status!=='open')throw Error('La sala está finalizada o reiniciándose.');
      const patch={updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
      if(action==='mode'){
        if(!['guided','autonomous'].includes(value))throw Error('Modalidad no reconocida.');
        patch.mode=value;
        patch.currentRound=config.currentRound;
        patch.phase=value==='guided'?'waiting':'deciding';
      }else if(action==='open'){
        if(config.mode!=='guided'||config.phase!=='waiting')throw Error('Solo puedes abrir una ronda preparada.');
        patch.phase='deciding';
      }else if(action==='close'||action==='discussion'){
        if(config.mode!=='guided'||config.phase!=='deciding')throw Error('Primero abre una ronda para recibir las decisiones.');
        patch.phase='discussion';
      }else if(action==='next'){
        if(config.mode!=='guided'||config.phase!=='discussion')throw Error('Primero cierra la ronda y conversa sobre las decisiones.');
        if(config.currentRound>=5)throw Error('Ya se completaron las cinco rondas.');
        patch.currentRound=config.currentRound+1;
        patch.phase='waiting'; // El facilitador decide cuándo abrir la ronda.
      }else if(action==='reopen'||action==='resume'){
        if(config.mode!=='guided'||config.phase!=='discussion')throw Error('Solo puedes reabrir una ronda cerrada.');
        patch.phase='deciding'; // Los equipos pendientes pueden responder, los anteriores conservan su decisión.
      }else if(action==='finish'){
        if(config.mode!=='guided'||config.phase!=='discussion'||config.currentRound!==5)
          throw Error('Finaliza después de cerrar la quinta ronda.');
        patch.status='completed';
      }else throw Error('Acción de sala desconocida.');
      tx.update(ref,patch);
    });
  }
  async function facilitatorUser(code){
    init();
    const user=auth.currentUser;
    if(!user||user.isAnonymous)throw Error('Inicia sesión como facilitador.');
    const token=await user.getIdTokenResult();
    if(token.claims.facilitator!==true)throw Error('Esta cuenta no tiene el rol de facilitador.');
    const snap=await roomRef(code).get();
    if(!snap.exists||snap.data().hostUid!==user.uid)throw Error('No tienes acceso a esta sala.');
    return snap;
  }
  async function removeTeam(code,teamId){
    const room=await facilitatorUser(code);
    if(!teamId||typeof teamId!=='string')throw Error('Selecciona el equipo que vas a retirar.');
    const ref=roomRef(code);
    await db.runTransaction(async tx=>{
      const current=await tx.get(ref);
      const participant=await tx.get(ref.collection('teams').doc(teamId));
      if(!current.exists||current.data().hostUid!==auth.currentUser.uid)
        throw Error('No tienes permiso para administrar esta sala.');
      if(!participant.exists)throw Error('El equipo ya no figura en la sala.');
      tx.set(ref.collection('removed').doc(teamId),{
        ownerUid:teamId,team:participant.data().team,
        resetEpoch:Number(current.data().resetEpoch)||0,
        removedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      tx.delete(ref.collection('teams').doc(teamId));
      tx.delete(ref.collection('ranking').doc(teamId));
    });
  }
  async function resetRoom(code){
    await facilitatorUser(code);
    const ref=roomRef(code);
    // Bloquear temporalmente nuevos envíos mientras se borra la partida.
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists||snap.data().hostUid!==auth.currentUser.uid)throw Error('No tienes acceso a esta sala.');
      if(snap.data().status!=='resetting')
        tx.update(ref,{status:'resetting',updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    });
    // Se eliminan todos los documentos y rankings; los retiros previos caducan con resetEpoch.
    for(let page=0;page<50;page++){
      const snaps=await Promise.all([
        ref.collection('teams').limit(190).get(),
        ref.collection('ranking').limit(190).get()
      ]);
      if(!snaps[0].size&&!snaps[1].size)break;
      const batch=db.batch();
      for(const snap of snaps)for(const doc of snap.docs)batch.delete(doc.ref);
      await batch.commit();
      if(page===49)throw Error('El volumen de participantes es superior al límite de reinicio. Vuelve a ejecutar el reinicio.');
    }
    await db.runTransaction(async tx=>{
      const current=await tx.get(ref);
      if(!current.exists||current.data().hostUid!==auth.currentUser.uid||current.data().status!=='resetting')
        throw Error('La sala cambió mientras se reiniciaba.');
      tx.update(ref,{
        status:'open',currentRound:1,
        phase:current.data().mode==='guided'?'waiting':'deciding',
        resetEpoch:(Number(current.data().resetEpoch)||0)+1,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    return true;
  }
  function watchOwnTeam(code,onUpdate,onError){
    init();
    if(!auth.currentUser)throw Error('No hay una identidad de equipo autenticada.');
    return roomRef(code).collection('teams').doc(auth.currentUser.uid)
      .onSnapshot({includeMetadataChanges:true},snap=>onUpdate(snap.exists,snap.metadata.fromCache),e=>onError(err(e)));
  }
  async function subscribeRoom(code,onUpdate,onError){
    init();
    const user=auth.currentUser;
    if(!user||user.isAnonymous)throw Error('Debes ingresar como facilitador.');
    const room=await roomRef(code).get();
    if(!room.exists)throw Error('Esta sala aún no existe. Haz clic en CREAR SALA para activarla.');
    if(room.data().hostUid!==user.uid)throw Error('Esta sala pertenece a otra cuenta de facilitador.');
    // La primera suscripción trae toda la sala; las siguientes solo actualizan
    // los documentos modificados. Evita reconstruir copias de historiales a cada respuesta.
    const teamIndex=new Map();
    return roomRef(code).collection('teams').onSnapshot(snapshot=>{
      for(const change of snapshot.docChanges()){
        const doc=change.doc;
        if(change.type==='removed'){teamIndex.delete(doc.id);continue;}
        const data=doc.data();
        teamIndex.set(doc.id,{...data,id:doc.id,updated_at:timestamp(data.updatedAt)});
      }
      const rows=Array.from(teamIndex.values())
        .sort((a,b)=>(b.score||0)-(a.score||0)||String(a.team).localeCompare(String(b.team)));
      onUpdate(rows);
    },e=>onError(err(e)));
  }
  window.NEXUS_FIREBASE={init,join,save,ranking,login,createRoom,subscribeRoom,watchRoom,controlRoom,removeTeam,resetRoom,watchOwnTeam,stopRanking,error:err};
})();

