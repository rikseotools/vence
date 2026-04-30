const fs = require('fs');
const path = require('path');

const JWT = fs.existsSync('scripts/jwt-token.txt')
  ? fs.readFileSync('scripts/jwt-token.txt', 'utf-8').trim()
  : process.env.OPT_JWT;

const BASE = 'https://api.opositatest.com/api/v2.0';
const OUTDIR = 'preguntas-para-subir/generalitat-valenciana';
const DELAY_MS = 200;

const EXAMS = [
  { id: 11831949, title: 'Examen 2018 (OEP 2016)' },
  { id: 20921710, title: 'Examen 2022 (OEP 2017-2018)' },
  { id: 39669283, title: 'Examen 2022 (OEP 2022)' },
  { id: 40080830, title: 'Examen 2023 (OEP 2023)' },
];

async function api(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { 'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json', 'Accept': 'application/json', ...(opts.headers || {}) }
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} - ${url}`);
  if (r.status === 204) return null;
  return r.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeExam(exam) {
  console.log(`\n=== ${exam.title} (examId: ${exam.id}) ===`);

  // Crear test
  let test;
  try {
    test = await api(BASE + '/tests', { method: 'POST', body: JSON.stringify({ examId: exam.id, autoStart: true }) });
  } catch (e) {
    console.error('  Error creando test:', e.message);
    return null;
  }
  console.log('  Test creado:', test.id, '| preguntas:', test.questions?.length || '?');

  // Obtener preguntas completas
  const full = await api(BASE + '/tests/' + test.id + '?embedded=questions,responses');
  console.log('  Preguntas obtenidas:', full.questions?.length);

  // Obtener explicación de cada pregunta
  let explanations = 0;
  for (const q of (full.questions || [])) {
    try {
      const reason = await api(BASE + '/questions/' + q.id + '/reason');
      q.explanation = reason?.content || null;
      q.explanationTitle = reason?.title || null;
      if (q.explanation) explanations++;
    } catch (e) {
      q.explanation = null;
      q.explanationTitle = null;
    }
    await sleep(DELAY_MS);
    if ((full.questions.indexOf(q) + 1) % 20 === 0) {
      console.log('  Progreso explicaciones:', full.questions.indexOf(q) + 1, '/', full.questions.length);
    }
  }
  console.log('  Explicaciones obtenidas:', explanations, '/', full.questions.length);

  // Extraer temas/epígrafes
  const topics = new Map();
  for (const q of (full.questions || [])) {
    for (const c of (q.contents || [])) {
      if (!topics.has(c.id)) topics.set(c.id, { name: c.name, count: 0, children: new Map() });
      topics.get(c.id).count++;
      if (c.child) topics.get(c.id).children.set(c.child.id, c.child.name);
    }
  }
  console.log('  Temas detectados:', topics.size);
  topics.forEach((v, k) => console.log('    -', v.name, '(' + v.count + ' preg)'));

  // Transformar preguntas
  const preguntas = (full.questions || []).map((q, idx) => ({
    id: q.id,
    position: idx + 1,
    question: q.declaration,
    explanation: q.explanation,
    explanationTitle: q.explanationTitle,
    correctAnswerId: q.correctAnswerId,
    options: (q.answers || []).map(a => ({
      id: a.id,
      text: a.declaration,
      isCorrect: String(a.id) === String(q.correctAnswerId)
    })),
    correctLetter: ['A','B','C','D'][(q.answers || []).findIndex(a => String(a.id) === String(q.correctAnswerId))],
    isAnnulled: q.isAnnulled,
    isRepealed: q.isRepealed,
    isDeleted: q.isDeleted,
    image: q.image,
    contents: q.contents,
  }));

  // Descartar test
  try {
    await api(BASE + '/tests/' + test.id + '/discard', { method: 'PUT' });
    console.log('  Test descartado');
  } catch (e) {
    console.log('  Warning descartando:', e.message);
  }

  // Guardar
  const output = {
    metadata: { examId: exam.id, title: exam.title, oppositionId: 89, oppositionName: 'Auxiliares Administrativos Generalitat Valenciana TL' },
    scrapedAt: new Date().toISOString(),
    source: 'opositatest-api-complete-v2',
    questionCount: preguntas.length,
    explanationCount: explanations,
    repealedCount: preguntas.filter(p => p.isRepealed).length,
    topics: [...topics.entries()].map(([id, v]) => ({ id, name: v.name, count: v.count })),
    questions: preguntas
  };

  const filename = exam.title.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
  fs.writeFileSync(path.join(OUTDIR, filename), JSON.stringify(output, null, 2));
  console.log('  Guardado:', path.join(OUTDIR, filename));

  return output;
}

(async () => {
  console.log('JWT:', JWT ? 'presente (' + JWT.length + ' chars)' : 'NO ENCONTRADO');
  let totalQ = 0, totalExpl = 0, totalRepealed = 0;

  for (const exam of EXAMS) {
    const result = await scrapeExam(exam);
    if (result) {
      totalQ += result.questionCount;
      totalExpl += result.explanationCount;
      totalRepealed += result.repealedCount;
    }
    await sleep(5000); // 5s entre exámenes
  }

  console.log('\n========= RESUMEN =========');
  console.log('Convocatorias:', EXAMS.length);
  console.log('Preguntas total:', totalQ);
  console.log('Explicaciones:', totalExpl);
  console.log('Derogadas:', totalRepealed);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
