import {onSnapshot, runTransaction, serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {attemptView, evaluateSelfPacedAnswer, answerTotals, questionOrder, milliseconds, selfPacedRanking} from './quiz-engine.mjs';

export function createSelfPacedQuiz({db, roomRef, playerRef, playersRef, getQuestions, getPlayerId, getPlayerName, $, show, escapeHtml}) {
  let run = null, player = null, participants = [], key = '', viewKey = '', busy = false, failedOperation = null;
  let unsubscribePlayer = null, unsubscribeRanking = null;
  const failure = error => {
    $('pMsg').textContent = error.message || 'No se pudo guardar. Revisa tu conexión.';
    $('selfIntroStatus').textContent = $('pMsg').textContent;
    $('selfRetry').classList.remove('hidden');
    $('selfIntroRetry').classList.remove('hidden');
  };
  function stop() {
    if (unsubscribePlayer) unsubscribePlayer();
    if (unsubscribeRanking) unsubscribeRanking();
    unsubscribePlayer = unsubscribeRanking = null;
    key = ''; viewKey = ''; player = null; participants = []; run = null; failedOperation = null; busy = false;
  }
  function updateRun(next) {
    const nextKey = playerRef().path;
    if (key !== nextKey) {
      stop(); key = nextKey; run = next;
      unsubscribePlayer = onSnapshot(playerRef(), snapshot => {
        player = snapshot.exists() ? snapshot.data() : null;
        if (!player) {
          show('selfIntro'); $('startSelfQuiz').disabled = true;
          $('selfIntroStatus').textContent = 'Tu inscripción ya no está disponible. Vuelve a ingresar al quiz.';
          return;
        }
        render();
      }, failure);
      unsubscribeRanking = onSnapshot(playersRef(), snapshot => {
        participants = snapshot.docs.map(d => ({id: d.id, ...d.data()})); renderRanking();
      }, failure);
    } else {
      if (run?.quizVersion !== next.quizVersion) {viewKey = ''; failedOperation = null;}
      run = next;
    }
    render();
  }
  function renderRanking() {
    if (!run) return;
    const ranking = selfPacedRanking(participants, run, getQuestions());
    const mine = ranking.findIndex(p => p.id === getPlayerId());
    const html = ranking.length ? ranking.map((p, i) => `<div class="rankrow"><b>#${i + 1}</b><span>${escapeHtml(p.name)}<small class="mini rankdetail">${p.correctCount} aciertos · avance ${p.answeredCount}/${questionOrder(run, getQuestions()).length}</small></span><b>${p.score} pts</b></div>`).join('') : '<p class="muted">El ranking aparecerá cuando alguien comience.</p>';
    $('selfLiveRanking').innerHTML = html;
    $('selfFinalRanking').innerHTML = html;
    $('selfFinalPosition').textContent = mine < 0 ? '' : `Tu posición actual: ${mine + 1} de ${ranking.length}. El ranking se actualiza mientras otras personas responden.`;
  }
  function render() {
    if (!run || !player) return;
    const questions = getQuestions(), view = attemptView(run, player, questions);
    const available = run.selfPacedStatus === 'published';
    $('selfIntroRetry').classList.add('hidden');
    if (view.complete) {
      show('selfResults');
      $('selfFinalScore').textContent = `${view.score} puntos`;
      $('selfFinalAccuracy').textContent = `${view.correctCount} aciertos de ${view.order.length} preguntas`;
      $('selfFinalNote').textContent = 'El puntaje combina aciertos y rapidez. El tiempo registrado incluye la espera entre preguntas.';
      renderRanking(); return;
    }
    if (!available || !view.progress || !view.order.includes(view.activeIndex) || !view.startedAt) {
      show('selfIntro');
      $('selfIntroTitle').textContent = `Hola, ${getPlayerName()}`;
      $('selfIntroInfo').textContent = `${view.order.length} preguntas · sin límite de tiempo. Cada acierto suma de 1 a 10 puntos según la rapidez. Una respuesta incorrecta suma 0 puntos.`;
      $('selfIntroStatus').textContent = !available ? (run.selfPacedStatus === 'closed' ? 'El instrumento está cerrado.' : 'El facilitador todavía está preparando el instrumento.') : 'La rapidez cuenta desde Comenzar quiz y, después, desde que guardas la respuesta anterior. Si te demoras en abrir la siguiente pregunta, obtendrás menos puntos por rapidez. Salir o recargar no detiene ese registro.';
      $('startSelfQuiz').textContent = view.progress ? 'Continuar quiz' : 'Comenzar quiz';
      $('startSelfQuiz').disabled = !available || busy || !view.order.length;
      return;
    }
    show('playerGame');
    $('pTimer').classList.add('hidden');
    $('pTimeBarBox').classList.add('hidden');
    $('selfAfterAnswer').classList.toggle('hidden', !view.answer);
    $('selfRetry').classList.add('hidden');
    const nextViewKey = `${run.quizVersion}:${view.activeIndex}:${view.startedAt}:${!!view.answer}`;
    if (viewKey !== nextViewKey) {
      viewKey = nextViewKey;
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
      $('pMsg').textContent = view.answer ? `Respuesta guardada. +${view.answer.points} puntos.` : '';
    }
    $('nextSelfQuestion').disabled = busy;
    $('pAnswers').querySelectorAll('button').forEach(button => button.disabled = !!view.answer || busy);
    if (view.answer) {
      renderRanking();
    }
  }
  async function beginNext() {
    if (busy || !run) return;
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
        // Include the wait after the previous submission in the next question's score.
        const previousEnd = milliseconds(view.progress?.lastAnsweredAt)
          || (view.answer && view.startedAt ? view.startedAt + Number(view.answer.elapsed || 0) * 1000 : 0);
        const progress = {version: live.quizVersion, startedAt: view.progress?.startedAt || serverTimestamp(),
          activeIndex: view.nextIndex, questionStartedAt: previousEnd || serverTimestamp(),
          questionOpenedAt: serverTimestamp(), lastAnsweredAt: view.progress?.lastAnsweredAt || null, completedAt: null};
        transaction.update(playerDocument, {selfPaced: progress, answers: view.answers,
          ...answerTotals(view.answers, view.order), lastSeen: serverTimestamp()});
      });
      failedOperation = null;
    } catch (caught) {error = caught; failedOperation = beginNext;}
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
        const elapsed = Math.max(0, (Date.now() - started) / 1000);
        const result = evaluateSelfPacedAnswer(option, correctOption, elapsed);
        const answers = {...(data.answers || {}), [index]: result};
        const complete = order.every(i => !!answers[i]);
        transaction.update(playerDocument, {answers, ...answerTotals(answers, order),
          selfPaced: {...progress, lastAnsweredAt: serverTimestamp(), completedAt: complete ? serverTimestamp() : null, completedReason: complete ? 'answered' : null}, lastSeen: serverTimestamp()});
      });
      failedOperation = null;
    } catch (caught) {error = caught; failedOperation = () => answer(option, index);}
    finally {
      if (key !== requestKey) return;
      busy = false; render();
      if (error) {
        failure(error);
      }
    }
  }
  $('startSelfQuiz').onclick = beginNext;
  $('nextSelfQuestion').onclick = beginNext;
  const retry = () => {if (failedOperation) return failedOperation();};
  $('selfRetry').onclick = retry;
  $('selfIntroRetry').onclick = retry;
  return {updateRun, stop};
}
