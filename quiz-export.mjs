import {isSelfPaced, participantIdentity, questionOrder} from './quiz-engine.mjs';

const HEADERS = ['Sala', 'Partida', 'Modalidad', 'ID participante', 'Tipo de ingreso',
  'Nombre', 'Cédula', 'Fecha de ingreso (hora Colombia)', 'Número de pregunta', 'Pregunta',
  'Opción elegida', 'Respuesta seleccionada', 'Opción correcta', 'Respuesta correcta',
  'Estado de respuesta', 'Acierto', 'Tiempo de respuesta (s)', 'Puntos registrados',
  'Puntaje total registrado', 'Estado de puntuación'];

function csvCell(value, cedula = false) {
  let text = typeof value === 'number' && Number.isFinite(value)
    ? String(value).replace('.', ',') : String(value ?? '').replaceAll('\0', '');
  // Excel otherwise rounds long document numbers and removes leading zeros.
  // This generated formula accepts digits only; other cells never execute formulas.
  if (cedula && /^[0-9]{1,30}$/.test(text)) text = `="${text}"`;
  else if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

function dateLabel(value) {
  let ms = typeof value?.toMillis === 'function' ? value.toMillis()
    : Number.isFinite(value) ? value
    : Number.isFinite(value?.seconds) ? value.seconds * 1000 : NaN;
  if (!Number.isFinite(ms) || ms <= 0 || Number.isNaN(new Date(ms).getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Bogota', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'}).format(new Date(ms));
}

const numberOrBlank = value => typeof value === 'number' && Number.isFinite(value) ? value : '';
const optionIndex = value => Number.isInteger(value) && value >= 0 && value < 4 ? value : null;
const letter = value => value === null ? '' : 'ABCD'[value];

// One row per participant and question, including unanswered questions and saved
// responses outside the current selection. No Firebase or browser dependency.
export function buildQuizResponseExport({run, runId, questions = [], players = [], identities = []}) {
  const privateData = new Map(identities.map(p => [p.id, p]));
  const order = questionOrder(run, questions);
  const rows = [];
  let answerCount = 0, missingIdentityCount = 0, pendingCount = 0;
  for (const player of players) {
    const identity = privateData.get(player.id) || {};
    const type = participantIdentity({participantIdentity: player.identityType || participantIdentity(run)});
    const name = identity.name || (type === 'cedula' ? '' : player.name || '');
    const cedula = type === 'name' ? '' : String(identity.cedula ?? '');
    if (type !== 'name' && !cedula) missingIdentityCount++;
    const answers = player.answers && typeof player.answers === 'object' ? player.answers : {};
    const savedIndices = Object.keys(answers).filter(k => /^(0|[1-9][0-9]*)$/.test(k))
      .map(Number).filter(Number.isSafeInteger).sort((a, b) => a - b);
    const indices = [...new Set([...order, ...savedIndices])];
    if (!indices.length) indices.push(null);
    const oldAttempt = isSelfPaced(run) && player.selfPaced?.version && run.quizVersion
      && player.selfPaced.version !== run.quizVersion;
    for (const index of indices) {
      const saved = index === null ? null : answers[index];
      const answered = saved !== undefined && saved !== null;
      const answer = answered ? (typeof saved === 'object' ? saved : {option: saved}) : {};
      const q = oldAttempt ? null : questions[index];
      const chosen = optionIndex(answer.option), correctOption = optionIndex(q?.[3]);
      const correct = typeof answer.correct === 'boolean' ? answer.correct
        : answered && chosen !== null && correctOption !== null ? chosen === correctOption : null;
      const pending = answered && !isSelfPaced(run) && index === run.questionIndex && run.status !== 'revealed';
      if (answered) answerCount++;
      if (pending) pendingCount++;
      rows.push([run.className || runId, runId, isSelfPaced(run) ? 'Autónoma' : 'Dirigida',
        player.id, {name: 'Nombre', cedula: 'Cédula', both: 'Nombre y cédula'}[type], name, cedula,
        dateLabel(player.joinedAt), index === null ? '' : index + 1,
        q?.[1] || (index === null ? '' : oldAttempt ? 'Pregunta de un intento anterior' : 'Pregunta no disponible'),
        letter(chosen), chosen === null ? '' : q?.[2]?.[chosen] || '', letter(correctOption),
        correctOption === null ? '' : q?.[2]?.[correctOption] || '',
        !answered ? 'Sin responder' : answer.timedOut ? 'Tiempo agotado' : 'Respondida',
        !answered || correct === null ? '' : correct ? 'Sí' : 'No',
        answered ? numberOrBlank(answer.elapsed) : '', answered ? numberOrBlank(answer.points) : '',
        numberOrBlank(player.score), !answered ? '' : oldAttempt ? 'Intento anterior' : pending ? 'Pendiente de revelar' : 'Registrada']);
    }
  }
  const lines = [HEADERS.map(v => csvCell(v)).join(';'),
    ...rows.map(row => row.map((value, index) => csvCell(value, index === 6)).join(';'))];
  const roomName = String(run.className || runId).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .trim().replace(/[. ]+$/g, '').slice(0,70) || 'sala';
  return {csv: '\uFEFFsep=;\r\n' + lines.join('\r\n') + '\r\n', filename: `SaberON_respuestas_${roomName}.csv`,
    participantCount: players.length, answerCount, rowCount: rows.length, missingIdentityCount, pendingCount};
}
