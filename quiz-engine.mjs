// Shared scoring and progress rules. No Firebase or browser dependencies.
export const isSelfPaced = run => run?.mode === 'self_paced';
export function questionSeconds(run) {
  const value = Number(run?.duration);
  return Number.isInteger(value) && value >= 5 && value <= 600 ? value : 60;
}
export function questionOrder(run, questions) {
  const source = Array.isArray(run?.selectedQuestions) ? run.selectedQuestions : questions.map((_, i) => i);
  return [...new Set(source.filter(i => Number.isInteger(i) && i >= 0 && i < questions.length))];
}
export function milliseconds(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return Number.isFinite(value) ? value : 0;
}
export function evaluateAnswer(option, correctOption, elapsed, duration) {
  const time = Math.max(0, Math.min(duration, Number(elapsed) || 0));
  const timedOut = time >= duration || !Number.isInteger(option) || option < 0 || option > 3;
  const correct = !timedOut && option === correctOption;
  return {
    option: timedOut ? -1 : option,
    elapsed: Math.floor(time * 1000) / 1000,
    correct,
    points: correct ? Math.max(1, 10 - Math.floor(time / duration * 10)) : 0,
    timedOut
  };
}
export function answerTotals(answers = {}, order = Object.keys(answers)) {
  const result = {score: 0, correctCount: 0, correctTime: 0, answeredCount: 0};
  for (const i of order) {
    const answer = answers[i];
    if (!answer) continue;
    result.answeredCount++;
    result.score += Number(answer.points) || 0;
    if (answer.correct) {
      result.correctCount++;
      result.correctTime += Number(answer.elapsed) || 0;
    }
  }
  result.correctTime = +result.correctTime.toFixed(3);
  return result;
}
export function compareSelfPaced(a, b) {
  return b.score - a.score || b.correctCount - a.correctCount || a.correctTime - b.correctTime || String(a.name).localeCompare(String(b.name), 'es') || String(a.id).localeCompare(String(b.id));
}
export function selfPacedRanking(players, run, questions) {
  const order = questionOrder(run, questions);
  return players.filter(p => p.selfPaced?.version === run.quizVersion && milliseconds(p.selfPaced.startedAt))
    .map(p => ({...p, ...answerTotals(p.answers, order)})).sort(compareSelfPaced);
}
export function attemptView(run, player, questions) {
  const order = questionOrder(run, questions);
  const progress = player?.selfPaced?.version === run.quizVersion ? player.selfPaced : null;
  const answers = progress ? player.answers || {} : {};
  const nextIndex = order.find(i => !answers[i]);
  const complete = !!progress && order.length > 0 && nextIndex === undefined;
  const activeIndex = progress?.activeIndex;
  return {order, progress, answers, nextIndex, complete, activeIndex,
    startedAt: milliseconds(progress?.questionStartedAt),
    answer: progress && order.includes(activeIndex) ? answers[activeIndex] : null,
    ...answerTotals(answers, order)};
}
