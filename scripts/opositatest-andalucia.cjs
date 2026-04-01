/**
 * Scraper de OpositaTest para Auxiliares Administrativos Junta de Andalucía (oppositionId: 49)
 *
 * Uso: node scripts/opositatest-andalucia.cjs [comando]
 *
 * Comandos:
 *   temas       - Scrapear todos los temas (personalizado, 100 preguntas por tema)
 *   exams       - Scrapear las 6 convocatorias anteriores
 *   tema N      - Scrapear solo el tema N (ej: tema 5)
 *   leyes       - Scrapear preguntas ordenadas por leyes
 *   status      - Ver progreso actual
 *   cleanup     - Descartar tests pendientes para liberar slots
 *
 * Requisitos:
 *   - JWT token en scripts/jwt-token.txt
 *   - Suscripción activa en OpositaTest para Andalucía
 */

const fs = require('fs');
const path = require('path');

const JWT_FILE = path.join(__dirname, 'jwt-token.txt');
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'auxiliar-andalucia');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'scrape-progress.json');

const OPPOSITION_ID = 49;
const MAX_QUESTIONS = 75; // Máximo para esta oposición

// Bloque 1 - Área Jurídico Administrativa General (12 temas)
// Bloque 2 - Organización y Gestión Administrativa (10 temas)
const TOPICS = [
  // Bloque 1
  { num: 1,  id: 'dd695d83-1c09-4169-b43b-dd925bbe7964', name: 'La Constitución Española', bloque: 1 },
  { num: 2,  id: '827211ff-bdf4-47d4-ab25-11895619c2fa', name: 'El Tribunal Constitucional / Reforma constitucional', bloque: 1 },
  { num: 3,  id: '60872eb8-7e69-423f-8d13-354f3103bbf7', name: 'La Corona / Las Cortes Generales', bloque: 1 },
  { num: 4,  id: '62b359f2-9ccf-4f7e-b85f-463b8ffef4e3', name: 'El Gobierno / La Administración', bloque: 1 },
  { num: 5,  id: '9cc0340c-3942-482e-9075-3307ca2a983f', name: 'Organización territorial del Estado', bloque: 1 },
  { num: 6,  id: 'a485ab16-f631-4439-94c2-03483ae07b60', name: 'Estatuto de Autonomía para Andalucía', bloque: 1 },
  { num: 7,  id: '65bc6f62-9a4b-4e33-82e3-da3700214a13', name: 'Organización institucional Comunidad Autónoma Andalucía', bloque: 1 },
  { num: 8,  id: '89036ae2-93b8-4e86-9288-235f5870859a', name: 'Administración de la Junta de Andalucía', bloque: 1 },
  { num: 9,  id: 'f8dd1529-e2d4-4c73-b473-c05efdea4ac1', name: 'La Unión Europea', bloque: 1 },
  { num: 10, id: '6744073e-965c-49de-9f23-a18ca3427daf', name: 'Procedimiento Administrativo Común', bloque: 1 },
  { num: 11, id: 'b886bde9-6729-4b3a-8dc3-28301c1e4003', name: 'Revisión actos y recursos', bloque: 1 },
  { num: 12, id: '83e0e29c-f140-41d8-a056-31318c6a7c40', name: 'Función Pública de Andalucía', bloque: 1 },
  // Bloque 2
  { num: 13, id: 'e72e2f21-f578-4022-b31b-91647030b405', name: 'Derechos de la ciudadanía', bloque: 2 },
  { num: 14, id: 'b142c8df-ec7d-4b11-b6bc-20a643aeb232', name: 'Atención a la ciudadanía', bloque: 2 },
  { num: 15, id: 'fb3a5143-bf11-465c-b119-e0c8066af5b3', name: 'Administración electrónica', bloque: 2 },
  { num: 16, id: '8a04da3c-fc41-4647-b9cc-c308229aa1b7', name: 'Documentos administrativos', bloque: 2 },
  { num: 17, id: '45c45455-9251-4bcf-9fc5-7baf5c369d9b', name: 'Igualdad de género', bloque: 2 },
  { num: 18, id: 'f2111c5e-fca1-4400-bae6-b8d92f3b64f8', name: 'Violencia de género', bloque: 2 },
  { num: 19, id: 'fdd4276f-b211-4a7a-9de2-5682423b6f86', name: 'Transparencia', bloque: 2 },
  { num: 20, id: '7a908377-a30c-4bba-9d8b-ada46dbaa4c0', name: 'Prevención de riesgos laborales', bloque: 2 },
  { num: 21, id: '9a1961da-0342-45dc-ae78-9b64d77ffcde', name: 'Ofimática', bloque: 2 },
  { num: 22, id: '5e2201c0-f694-4059-8fae-a8a615502f3a', name: 'Internet / Correo electrónico', bloque: 2 },
];

// Convocatorias anteriores
const PREVIOUS_CALLS = [
  { id: 1474881,  name: 'Examen 2017 (OEP 2015/2016)' },
  { id: 18703386, name: 'Examen OEP 2017/2018' },
  { id: 24278896, name: 'Examen TL OEP 2017+2018 Extraordinario' },
  { id: 24680599, name: 'Examen 2022 (OEP 2019, 2020, 2021)' },
  { id: 33721722, name: 'Examen OEP 2022 Estabilización' },
  { id: 45305205, name: 'Examen 2023 (OEP 2022/2023)' },
];

// Preguntas por leyes (bloque especial)
const LAWS = [
  { id: '900ba5c9-1d1a-4c8e-9abf-2ddc3413d32e', name: 'Constitución Española' },
  { id: '6d931b3f-163f-4c57-87f9-f541a2eba343', name: 'Ley 39/2015 LPAC' },
  { id: 'c5e362fd-d04b-41c9-b141-a4d573b66c5d', name: 'LO 2/2007 Estatuto de Autonomía Andalucía' },
  { id: 'efcd6ca8-5854-428f-bb65-64a34d8b5532', name: 'Ley 9/2007 Administración Junta Andalucía' },
  { id: '7ac65c8a-9d1a-4614-8928-860a07f17c3c', name: 'Ley 6/2006 Gobierno Andalucía' },
  { id: 'ebeb0b73-6ac8-43b9-ad55-da395e3e85dc', name: 'Ley 5/2023 Función Pública Andalucía' },
  { id: 'e58b6d46-1657-4623-b2e9-a460947b341f', name: 'Ley 12/2007 Igualdad de género Andalucía' },
  { id: '1b02c687-879b-4763-8ca9-0438e61690f6', name: 'Ley 13/2007 Violencia de género Andalucía' },
];

// ─── Helpers ───

let jwt;
function loadJWT() {
  if (!fs.existsSync(JWT_FILE)) {
    console.error('❌ No se encuentra scripts/jwt-token.txt');
    console.error('   Extraer JWT de DevTools: F12 → Network → Authorization header');
    process.exit(1);
  }
  jwt = fs.readFileSync(JWT_FILE, 'utf-8').trim();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(url, opts = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        ...opts,
        headers: {
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          ...(opts.headers || {})
        }
      });

      if (r.status === 401) {
        console.error('❌ JWT expirado. Extraer nuevo token.');
        process.exit(1);
      }

      if (r.status === 429) {
        console.log('⏳ Rate limit, esperando 60s...');
        await sleep(60000);
        continue;
      }

      if (r.status === 204) return {};

      if (!r.ok) {
        const body = await r.text();
        if (body.includes('TestCreatedOrInProgressLimitReached')) {
          console.error('❌ Límite de 10 tests. Ejecutar: node scripts/opositatest-andalucia.cjs cleanup');
          process.exit(1);
        }
        console.error(`❌ HTTP ${r.status}: ${body.substring(0, 200)}`);
        return null;
      }

      return r.json();
    } catch (err) {
      console.error(`⚠️ Error de red (intento ${attempt + 1}):`, err.message);
      await sleep(3000);
    }
  }
  return null;
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { topics: {}, exams: {}, laws: {}, totalQuestions: 0 };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function transformQuestions(questions) {
  return questions.map(q => ({
    id: q.id,
    question: q.declaration,
    explanation: q.explanation || '',
    explanationTitle: q.explanationTitle || '',
    correctAnswerId: q.correctAnswerId,
    options: q.answers.map(a => ({
      id: a.id,
      letter: ['A', 'B', 'C', 'D'][q.answers.indexOf(a)],
      text: a.declaration,
      image: a.image || null,
      isCorrect: a.id === q.correctAnswerId
    })),
    correctAnswer: ['A', 'B', 'C', 'D'][q.answers.findIndex(a => a.id === q.correctAnswerId)],
    isAnnulled: q.isAnnulled || false,
    isRepealed: q.isRepealed || false,
    image: q.image || null,
    contents: (q.contents || []).map(c => ({
      id: c.id, name: c.name,
      child: c.child ? { id: c.child.id, name: c.child.name } : null
    }))
  }));
}

async function fetchExplanation(q) {
  try {
    const r = await fetch(`https://api.opositatest.com/api/v2.0/questions/${q.id}/reason`, {
      headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' }
    });
    if (r.ok) {
      const reason = await r.json();
      if (reason) {
        q.explanation = reason.content;
        q.explanationTitle = reason.title;
        return true;
      }
    }
  } catch (err) { /* ignorar */ }
  return false;
}

// Mínimo de preguntas nuevas para seguir scrapeando otra ronda
const MIN_NEW_QUESTIONS = 3;
const MAX_ROUNDS = 15;

// ─── Core scraping ───

async function scrapeContentExhaustive(contentId, label) {
  const allQuestions = new Map(); // id -> question
  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;
    console.log(`  Ronda ${round}...`);

    // Crear examen
    const exam = await api('https://api.opositatest.com/api/v2.0/exams', {
      method: 'POST',
      body: JSON.stringify({
        type: 'random',
        oppositionId: OPPOSITION_ID,
        numberOfQuestions: MAX_QUESTIONS,
        contentsRequestedIds: [contentId]
      })
    });

    if (!exam) { console.error(`  ❌ Error creando examen en ronda ${round}`); break; }

    // Crear test
    const test = await api('https://api.opositatest.com/api/v2.0/tests', {
      method: 'POST',
      body: JSON.stringify({ examId: exam.id, autoStart: true })
    });

    if (!test) { console.error(`  ❌ Error creando test en ronda ${round}`); break; }

    // Obtener preguntas
    const full = await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}?embedded=questions,responses`);
    if (!full?.questions) { console.error(`  ❌ Error obteniendo preguntas en ronda ${round}`); break; }

    // Contar nuevas
    let newCount = 0;
    const newQuestions = [];
    for (const q of full.questions) {
      if (!allQuestions.has(q.id)) {
        newCount++;
        newQuestions.push(q);
        allQuestions.set(q.id, q);
      }
    }

    console.log(`  ${full.questions.length} obtenidas, ${newCount} nuevas (total: ${allQuestions.size})`);

    // Obtener explicaciones SOLO de preguntas nuevas
    if (newQuestions.length > 0) {
      let expCount = 0;
      for (const q of newQuestions) {
        if (await fetchExplanation(q)) {
          allQuestions.set(q.id, q);
          expCount++;
        }
        await sleep(150);
      }
      console.log(`  ${expCount} explicaciones obtenidas`);
    }

    // Descartar test
    await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}/discard`, { method: 'PUT' });

    // Si pocas nuevas o la ronda devolvió menos del máximo, parar
    if (newCount < MIN_NEW_QUESTIONS) {
      console.log(`  Pocas preguntas nuevas (${newCount}), parando.`);
      break;
    }

    if (full.questions.length < MAX_QUESTIONS) {
      console.log(`  Tema tiene menos de ${MAX_QUESTIONS} preguntas totales, parando.`);
      break;
    }

    await sleep(1500);
  }

  return [...allQuestions.values()];
}

async function scrapeTopic(topic, progress) {
  const key = `T${topic.num}`;
  if (progress.topics[key]?.done) {
    console.log(`⏭️  ${key} ya scrapeado (${progress.topics[key].count} preguntas)`);
    return;
  }

  console.log(`\n📋 Scrapeando ${key}: ${topic.name}...`);

  const rawQuestions = await scrapeContentExhaustive(topic.id, key);
  if (rawQuestions.length === 0) { console.error(`❌ No se obtuvieron preguntas para ${key}`); return; }

  const questions = transformQuestions(rawQuestions);

  const topicDir = path.join(OUTPUT_DIR, `Tema_${topic.num}`);
  ensureDir(topicDir);

  const outputFile = path.join(topicDir, `tema_${topic.num}.json`);
  const output = {
    tema: `Tema ${topic.num}`,
    nombre: topic.name,
    bloque: topic.bloque,
    source: 'opositatest',
    oposicion: 'Auxiliares Administrativos Junta de Andalucía',
    oppositionId: OPPOSITION_ID,
    contentId: topic.id,
    scrapedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`  ✅ Guardado: ${outputFile} (${questions.length} preguntas)`);

  // Actualizar progreso
  progress.topics[key] = { done: true, count: questions.length, rounds: Math.ceil(questions.length / MAX_QUESTIONS), scrapedAt: new Date().toISOString() };
  updateTotalCount(progress);
  saveProgress(progress);

  await sleep(2000);
}

async function scrapeExam(exam, progress) {
  const key = `exam_${exam.id}`;
  if (progress.exams[key]?.done) {
    console.log(`⏭️  ${exam.name} ya scrapeado (${progress.exams[key].count} preguntas)`);
    return;
  }

  console.log(`\n📋 Scrapeando ${exam.name}...`);

  const test = await api('https://api.opositatest.com/api/v2.0/tests', {
    method: 'POST',
    body: JSON.stringify({ examId: exam.id, autoStart: true })
  });

  if (!test) { console.error(`❌ Error creando test para ${exam.name}`); return; }
  console.log(`  Test creado: ${test.id}`);

  const full = await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}?embedded=questions,responses`);
  if (!full?.questions) { console.error(`❌ Error obteniendo preguntas`); return; }

  console.log(`  ${full.questions.length} preguntas obtenidas`);

  let explanationCount = 0;
  for (const q of full.questions) {
    if (await fetchExplanation(q)) explanationCount++;
    await sleep(150);
  }
  console.log(`  ${explanationCount} explicaciones obtenidas`);

  const questions = transformQuestions(full.questions);

  const examDir = path.join(OUTPUT_DIR, 'examenes-oficiales');
  ensureDir(examDir);

  const safeName = exam.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outputFile = path.join(examDir, `${safeName}.json`);
  const output = {
    nombre: exam.name,
    examId: exam.id,
    source: 'opositatest',
    oposicion: 'Auxiliares Administrativos Junta de Andalucía',
    oppositionId: OPPOSITION_ID,
    scrapedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`  ✅ Guardado: ${outputFile}`);

  await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}/discard`, { method: 'PUT' });
  console.log(`  Test descartado`);

  progress.exams[key] = { done: true, count: questions.length, name: exam.name, scrapedAt: new Date().toISOString() };
  saveProgress(progress);

  await sleep(2000);
}

function updateTotalCount(progress) {
  progress.totalQuestions = Object.values(progress.topics).reduce((sum, t) => sum + (t.count || 0), 0)
    + Object.values(progress.exams || {}).reduce((sum, e) => sum + (e.count || 0), 0)
    + Object.values(progress.laws || {}).reduce((sum, l) => sum + (l.count || 0), 0)
    + (progress.oficial?.count || 0);
}

async function scrapeLaw(law, progress) {
  const key = `law_${law.id.substring(0, 8)}`;
  if (progress.laws[key]?.done) {
    console.log(`⏭️  ${law.name} ya scrapeado (${progress.laws[key].count} preguntas)`);
    return;
  }

  console.log(`\n📋 Scrapeando ley: ${law.name}...`);

  const rawQuestions = await scrapeContentExhaustive(law.id, law.name);
  if (rawQuestions.length === 0) { console.error(`❌ No se obtuvieron preguntas para ${law.name}`); return; }

  const questions = transformQuestions(rawQuestions);

  const lawDir = path.join(OUTPUT_DIR, 'por-leyes');
  ensureDir(lawDir);

  const safeName = law.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);
  const outputFile = path.join(lawDir, `${safeName}.json`);
  const output = {
    ley: law.name,
    contentId: law.id,
    source: 'opositatest',
    oposicion: 'Auxiliares Administrativos Junta de Andalucía',
    oppositionId: OPPOSITION_ID,
    scrapedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`  ✅ Guardado: ${outputFile} (${questions.length} preguntas)`);

  progress.laws[key] = { done: true, count: questions.length, name: law.name, scrapedAt: new Date().toISOString() };
  updateTotalCount(progress);
  saveProgress(progress);

  await sleep(2000);
}

async function scrapeOficial(progress) {
  const key = 'oficial';
  if (progress.oficial?.done) {
    console.log(`⏭️  Oficial ya scrapeado (${progress.oficial.count} preguntas)`);
    return;
  }

  console.log(`\n📋 Scrapeando preguntas tipo Oficial (simulacro exhaustivo)...`);

  const allQuestions = new Map();
  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;
    console.log(`  Ronda ${round}...`);

    // Crear examen tipo oficial
    const exam = await api('https://api.opositatest.com/api/v2.0/exams', {
      method: 'POST',
      body: JSON.stringify({
        type: 'oficial',
        oppositionId: OPPOSITION_ID,
        numberOfQuestions: MAX_QUESTIONS
      })
    });

    if (!exam) { console.error(`  ❌ Error creando examen oficial en ronda ${round}`); break; }

    const test = await api('https://api.opositatest.com/api/v2.0/tests', {
      method: 'POST',
      body: JSON.stringify({ examId: exam.id, autoStart: true })
    });

    if (!test) { console.error(`  ❌ Error creando test oficial en ronda ${round}`); break; }

    const full = await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}?embedded=questions,responses`);
    if (!full?.questions) { console.error(`  ❌ Error obteniendo preguntas oficiales en ronda ${round}`); break; }

    let newCount = 0;
    const newQuestions = [];
    for (const q of full.questions) {
      if (!allQuestions.has(q.id)) {
        newCount++;
        newQuestions.push(q);
        allQuestions.set(q.id, q);
      }
    }

    console.log(`  ${full.questions.length} obtenidas, ${newCount} nuevas (total: ${allQuestions.size})`);

    if (newQuestions.length > 0) {
      let expCount = 0;
      for (const q of newQuestions) {
        const reason = await api(`https://api.opositatest.com/api/v2.0/questions/${q.id}/reason`);
        if (reason) {
          q.explanation = reason.content;
          q.explanationTitle = reason.title;
          allQuestions.set(q.id, q);
          expCount++;
        }
        await sleep(150);
      }
      console.log(`  ${expCount} explicaciones obtenidas`);
    }

    await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}/discard`, { method: 'PUT' });

    if (newCount < MIN_NEW_QUESTIONS) {
      console.log(`  Pocas preguntas nuevas (${newCount}), parando.`);
      break;
    }

    await sleep(1500);
  }

  if (allQuestions.size === 0) { console.error(`❌ No se obtuvieron preguntas oficiales`); return; }

  const questions = transformQuestions([...allQuestions.values()]);

  const oficialDir = path.join(OUTPUT_DIR, 'oficial');
  ensureDir(oficialDir);

  const outputFile = path.join(oficialDir, 'oficial_todas.json');
  const output = {
    tipo: 'oficial (simulacro)',
    source: 'opositatest',
    oposicion: 'Auxiliares Administrativos Junta de Andalucía',
    oppositionId: OPPOSITION_ID,
    scrapedAt: new Date().toISOString(),
    rounds: round,
    questionCount: questions.length,
    questions
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`  ✅ Guardado: ${outputFile} (${questions.length} preguntas en ${round} rondas)`);

  progress.oficial = { done: true, count: questions.length, rounds: round, scrapedAt: new Date().toISOString() };
  updateTotalCount(progress);
  saveProgress(progress);
}

async function cleanupTests() {
  console.log('🧹 Limpiando tests guardados...');
  const saved = await api('https://api.opositatest.com/api/v2.0/tests/saved?pageSize=25&sort=-createdAt');
  if (!saved?.resources) { console.log('No se pudieron obtener tests guardados'); return; }

  console.log(`Tests guardados: ${saved.resources.length}`);
  for (const t of saved.resources) {
    console.log(`  Descartando ${t.id}...`);
    await api(`https://api.opositatest.com/api/v2.0/tests/${t.id}/discard`, { method: 'PUT' });
    await sleep(500);
  }
  console.log('✅ Limpieza completada');
}

function showStatus(progress) {
  console.log('\n📊 Estado del scraping Andalucía\n');

  const doneTopics = Object.entries(progress.topics).filter(([, v]) => v.done);
  const pendingTopics = TOPICS.filter(t => !progress.topics[`T${t.num}`]?.done);

  console.log(`Temas: ${doneTopics.length}/${TOPICS.length} completados`);
  console.log('  Bloque 1 - Área Jurídico Administrativa:');
  for (const t of TOPICS.filter(t => t.bloque === 1)) {
    const key = `T${t.num}`;
    const p = progress.topics[key];
    if (p?.done) {
      console.log(`    ✅ T${t.num}: ${p.count} preguntas`);
    } else {
      console.log(`    ⬜ T${t.num}: ${t.name}`);
    }
  }
  console.log('  Bloque 2 - Organización y Gestión:');
  for (const t of TOPICS.filter(t => t.bloque === 2)) {
    const key = `T${t.num}`;
    const p = progress.topics[key];
    if (p?.done) {
      console.log(`    ✅ T${t.num}: ${p.count} preguntas`);
    } else {
      console.log(`    ⬜ T${t.num}: ${t.name}`);
    }
  }

  const doneExams = Object.entries(progress.exams || {}).filter(([, v]) => v.done);
  console.log(`\nConvocatorias: ${doneExams.length}/${PREVIOUS_CALLS.length} completadas`);
  for (const e of PREVIOUS_CALLS) {
    const key = `exam_${e.id}`;
    const p = progress.exams?.[key];
    if (p?.done) {
      console.log(`  ✅ ${e.name}: ${p.count} preguntas`);
    } else {
      console.log(`  ⬜ ${e.name}`);
    }
  }

  const doneLaws = Object.entries(progress.laws || {}).filter(([, v]) => v.done);
  console.log(`\nLeyes: ${doneLaws.length}/${LAWS.length} completadas`);
  for (const l of LAWS) {
    const key = `law_${l.id.substring(0, 8)}`;
    const p = progress.laws?.[key];
    if (p?.done) {
      console.log(`  ✅ ${l.name}: ${p.count} preguntas`);
    } else {
      console.log(`  ⬜ ${l.name}`);
    }
  }

  if (progress.oficial?.done) {
    console.log(`\nOficial (simulacro): ✅ ${progress.oficial.count} preguntas (${progress.oficial.rounds} rondas)`);
  } else {
    console.log(`\nOficial (simulacro): ⬜ pendiente`);
  }

  const total = Object.values(progress.topics).reduce((sum, t) => sum + (t.count || 0), 0)
    + Object.values(progress.exams || {}).reduce((sum, e) => sum + (e.count || 0), 0)
    + Object.values(progress.laws || {}).reduce((sum, l) => sum + (l.count || 0), 0)
    + (progress.oficial?.count || 0);
  console.log(`\nTotal preguntas scrapeadas: ${total}`);
}

// ─── Main ───

(async () => {
  loadJWT();
  ensureDir(OUTPUT_DIR);
  const progress = loadProgress();

  const cmd = process.argv[2] || 'temas';

  switch (cmd) {
    case 'temas':
      console.log('🚀 Scrapeando todos los temas de Andalucía...\n');
      for (const topic of TOPICS) {
        await scrapeTopic(topic, progress);
      }
      console.log(`\n✅ Completado. Total temas: ${Object.values(progress.topics).reduce((s, t) => s + (t.count || 0), 0)} preguntas`);
      break;

    case 'exams':
      console.log('🚀 Scrapeando convocatorias anteriores de Andalucía...\n');
      for (const exam of PREVIOUS_CALLS) {
        await scrapeExam(exam, progress);
      }
      break;

    case 'leyes':
      console.log('🚀 Scrapeando preguntas por leyes de Andalucía...\n');
      for (const law of LAWS) {
        await scrapeLaw(law, progress);
      }
      break;

    case 'oficial':
      console.log('🚀 Scrapeando preguntas tipo Oficial (simulacro) de Andalucía...\n');
      await scrapeOficial(progress);
      break;

    case 'tema': {
      const num = parseInt(process.argv[3]);
      if (!num) { console.error('Uso: node scripts/opositatest-andalucia.cjs tema 5'); process.exit(1); }
      const topic = TOPICS.find(t => t.num === num);
      if (!topic) { console.error(`Tema ${num} no encontrado`); process.exit(1); }
      await scrapeTopic(topic, progress);
      break;
    }

    case 'status':
      showStatus(progress);
      break;

    case 'cleanup':
      await cleanupTests();
      break;

    case 'todo':
      console.log('🚀 Scrapeando TODO: temas + oficial + convocatorias + leyes\n');
      for (const topic of TOPICS) {
        await scrapeTopic(topic, progress);
      }
      await scrapeOficial(progress);
      for (const exam of PREVIOUS_CALLS) {
        await scrapeExam(exam, progress);
      }
      for (const law of LAWS) {
        await scrapeLaw(law, progress);
      }
      console.log('\n✅ Todo completado');
      showStatus(progress);
      break;

    default:
      console.log('Comandos: temas, oficial, exams, leyes, tema N, todo, status, cleanup');
  }
})();
