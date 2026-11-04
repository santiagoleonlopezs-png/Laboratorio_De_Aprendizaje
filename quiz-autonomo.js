import {onSnapshot, runTransaction, serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {attemptView, evaluateAnswer, answerTotals, questionOrder, questionSeconds, milliseconds, selfPacedRanking} from './quiz-engine.mjs';

export function createSelfPacedQuiz({db, roomRef, playerRef, playersRef, getQuestions, getPlayerId, getPlayerName, $, show, escapeHtml}) {
  let run = null, player = null, participants = [], key = '', viewKey = '', busy = false, timer = null, timeoutQueued = false;
  let unsubscribePlayer = null, unsubscribeRanking = null;
  const failure = error => {
    $('pMsg').textContent = error.message || 'No se pudo guardar. Revisa tu conexión.';
    $('selfIntroStatus').textContent = $('pMsg').textContent;
    $('selfRetry').classList.remove('hidden');
  };
  function stop() {
    if (unsubscribePlayer) unsubscribePlayer();
    if (unsubscribeRanking) unsubscribeRanking();
    unsubscribePlayer = unsubscribeRanking = null;
    clearInterval(timer); timer = null; key = ''; viewKey = ''; player = null; participants = []; run = null; timeoutQueued = false; busy = false;
  }
  function updateRun(next) {
    const nextKey = playerRef().path;
    if (key !== nextKey) {
      stop(); key = nextKey; run = next;
      unsubscribePlayer = onSnapshot(playerRef(), snapshot => {
        player = snapshot.exists() ? snapshot.data() : null;
        if (!player) {
          clearInterval(timer); show('selfIntro'); $('startSelfQuiz').disabled = true;
          $('selfIntroStatus').textContent = 'Tu inscripción ya no está disponible. Vuelve a ingresar al quiz.';
          return;
        }
        render();
      }, failure);
      unsubscribeRanking = onSnapshot(playersRef(), snapshot => {
        participants = snapshot.docs.map(d => ({id: d.id, ...d.data()})); renderRanking();
      }, failure);
    } else {
      if (run?.quizVersion !== next.quizVersion) {viewKey = ''; timeoutQueued = false;}
      run = next;
    }
    render();
  }
  function renderRanking() {
    if (!run) return;
    const ranking = selfPacedRanking(participants, run, getQuestions());
    const mine = ranking.findIndex(p => p.id === getPlayerId());
    const html = ranking.length ? ranking.map((p, i) => `<div class="rankrow"><b>#${i + 1}</b><span>${escapeHtml(p.name)}<small class="mini rankdetail">${p.correctCount} aciertos · ${p.answeredCount}/${questionOrder(run, getQuestions()).length} respondidas</small></span><b>${p.score} pts</b></div>`).join('') : '<p class="muted">El ranking aparecerá cuando alguien comience.</p>';
    $('selfLiveRanking').innerHTML = html;
    $('selfFinalRanking').innerHTML = html;
    $('selfFinalPosition').textContent = mine < 0 ? '' : `Tu posición actual: ${mine + 1} de ${ranking.length}. El ranking se actualiza mientras otras personas responden.`;
  }
  function render() {
    if (!run || !player) return;
    clearInterval(timer); timer = null;
    const questions = getQuestions(), view = attemptView(run, player, questions);
    const available = run.selfPacedStatus === 'published';
    if (view.complete) {
      show('selfResults');
      $('selfFinalScore').textContent = `${view.score} puntos`;
      $('selfFinalAccuracy').textContent = `${view.correctCount} aciertos de ${view.order.length} preguntas`;
      renderRanking(); return;
    }
    if (!available || !view.progress || !view.order.includes(view.activeIndex) || !view.startedAt) {
      show('selfIntro');
      $('selfIntroTitle').textContent = `Hola, ${getPlayerName()}`;
      $('selfIntroInfo').textContent = `${view.order.length} preguntas · ${questionSeconds(run)} segundos por pregunta. Cada acierto suma de 1 a 10 puntos según la rapidez. Error o tiempo agotado: 0 puntos.`;
      $('selfIntroStatus').textContent = !available ? (run.selfPacedStatus === 'closed' ? 'El instrumento está cerrado.' : 'El facilitador todavía está preparando el instrumento.') : 'El tiempo empieza al abrir cada pregunta. Al guardar una respuesta, tú decides cuándo pasar a la siguiente. Recargar no reinicia el reloj.';
      $('startSelfQuiz').textContent = view.progress ? 'Continuar quiz' : 'Comenzar quiz';
      $('startSelfQuiz').disabled = !available || busy || !view.order.length;
      return;
    }
    show('playerGame');
    $('selfAfterAnswer').classList.toggle('hidden', !view.answer);
    $('selfRetry').classList.add('hidden');
    const nextViewKey = `${run.quizVersion}:${view.activeIndex}:${view.startedAt}:${!!view.answer}`;
    if (viewKey !== nextViewKey) {
      viewKey = nextViewKey; timeoutQueued = false;
      $('pNum').textContent = `Pregunta ${view.order.indexOf(view.activeIndex) + 1} / ${view.order.length}`;
      $('pQuestion').textContent = questions[view.activeIndex][1];
      $('pAnswers').innerHTML = '';
      questions[view.activeIndex][2].forEach((option, i) => {
        const button = document.createElement('button'); button.className = 'answer';
        button.textContent = `${'ABCD'[i]}. ${option}`; button.disabled = !!view.answer || busy;
        button.onclick = () => answer(i, view.activeIndex);
        if (view.answer?.option === i) button.classList.add('chosen');
        $('pAnswers').appendChild(button);
      });
      $('pMsg').textContent = view.answer ? (view.answer.timedOut ? 'Tiempo agotado. Esta pregunta suma 0 puntos.' : `Respuesta guardada. +${view.answer.points} puntos.`) : '';
    }
    $('nextSelfQuestion').disabled = busy;
    $('pAnswers').querySelectorAll('button').forEach(button => button.disabled = !!view.answer || busy);
    if (view.answer) {
      $('pTimer').textContent = 'Guardada'; $('pTimeBar').style.width = '0%'; renderRanking();
    } else {
      tick(); timer = setInterval(tick, 200);
    }
  }
  function tick() {
    if (!run || !player || run.selfPacedStatus !== 'published') return;
    const view = attemptView(run, player, getQuestions());
    if (!view.startedAt || view.answer) return;
    const duration = questionSeconds(run), remain = Math.max(0, duration - (Date.now() - view.startedAt) / 1000);
    $('pTimer').textContent = Math.ceil(remain);
    $('pTimeBar').style.width = `${remain / duration * 100}%`;
    if (remain <= 0) {
      $('pAnswers').querySelectorAll('button').forEach(b => b.disabled = true);
      if (!busy && !timeoutQueued) {timeoutQueued = true; answer(null, view.activeIndex);}
    }
  }
  async function beginNext() {
    if (busy) return;
    busy = true; $('startSelfQuiz').disabled = true; $('nextSelfQuestion').disabled = true;
    const expectedVersion = run?.quizVersion;
    const runDocument = roomRef(), playerDocument = playerRef(), requestKey = key;
    let error = null;
    try {
      await runTransaction(db, async transaction => {
        const rs = await transaction.get(runDocument), ps = await transaction.get(playerDocument);
        if (!rs.exists() || !ps.exists()) throw Error('La sala o tu inscripción ya no están disponibles.');
        const live = rs.data(), data = ps.data();
        if (live.mode !== 'self_paced' || live.selfPacedStatus !== 'published') throw Error('El instrumento no está abierto.');
        if (live.quizVersion !== expectedVersion) throw Error('La partida cambió. Revisa el instrumento antes de comenzar.');
        const questions = live.questions || [], view = attemptView(live, data, questions);
        if (!view.order.length) throw Error('No hay preguntas seleccionadas.');
        if (view.complete || (view.startedAt && view.activeIndex === view.nextIndex)) return;
        const progress = {version: live.quizVersion, startedAt: view.progress?.startedAt || serverTimestamp(),
          activeIndex: view.nextIndex, questionStartedAt: serverTimestamp(), completedAt: null};
        transaction.update(playerDocument, {selfPaced: progress, answers: view.answers,
          ...answerTotals(view.answers, view.order), lastSeen: serverTimestamp()});
      });
    } catch (caught) {error = caught;}
    finally {if (key === requestKey) {busy = false; render(); if (error) failure(error);}}
  }
  async function answer(option, index) {
    if (busy || !run) return;
    busy = true; $('pAnswers').querySelectorAll('button').forEach(b => b.disabled = true);
    const expectedVersion = run.quizVersion;
    const runDocument = roomRef(), playerDocument = playerRef(), requestKey = key;
    let error = null;
    try {
      await runTransaction(db, async transaction => {
        const rs = await transaction.get(runDocument), ps = await transaction.get(playerDocument);
        if (!rs.exists() || !ps.exists()) throw Error('La sala o tu inscripción ya no están disponibles.');
        const live = rs.data(), data = ps.data(), progress = data.selfPaced;
        if (live.mode !== 'self_paced' || live.selfPacedStatus !== 'published') throw Error('El instrumento está cerrado.');
        if (live.quizVersion !== expectedVersion || progress?.version !== live.quizVersion) throw Error('Esta partida se reinició. Vuelve a comenzar.');
        if (progress.activeIndex !== index || data.answers?.[index]) return;
        const started = milliseconds(progress.questionStartedAt), order = questionOrder(live, live.questions || []);
        if (!started || !order.includes(index)) throw Error('Abre la pregunta antes de responder.');
        const correctOption = live.questions[index].correct;
        const duration = questionSeconds(live), elapsed = Math.max(0, (Date.now() - started) / 1000);
        const result = evaluateAnswer(option, correctOption, elapsed, duration);
        const answers = {...(data.answers || {}), [index]: result};
        const complete = order.every(i => !!answers[i]);
        transaction.update(playerDocument, {answers, ...answerTotals(answers, order),
          selfPaced: {...progress, completedAt: complete ? serverTimestamp() : null}, lastSeen: serverTimestamp()});
      });
    } catch (caught) {error = caught;}
    finally {
      if (key !== requestKey) return;
      busy = false; render();
      if (error) {
        failure(error);
        const view = attemptView(run, player, getQuestions());
        if (Date.now() - view.startedAt < questionSeconds(run) * 1000) $('pAnswers').querySelectorAll('button').forEach(b => b.disabled = false);
      }
    }
  }
  $('startSelfQuiz').onclick = beginNext;
  $('nextSelfQuestion').onclick = beginNext;
  $('selfRetry').onclick = () => {timeoutQueued = false; tick();};
  window.addEventListener('online', () => {timeoutQueued = false; tick();});
  return {updateRun, stop};
}
