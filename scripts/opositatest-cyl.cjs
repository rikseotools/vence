/**
 * Scraper de OpositaTest para Auxiliares Administrativos CyL (oppositionId: 175)
 *
 * Uso: node scripts/opositatest-cyl.cjs [comando]
 *
 * Comandos:
 *   temas       - Scrapear todos los temas (personalizado, 100 preguntas por tema)
 *   exams       - Scrapear las 4 convocatorias anteriores
 *   tema N      - Scrapear solo el tema N (ej: tema 5)
 *   status      - Ver progreso actual
 *   cleanup     - Descartar tests pendientes para liberar slots
 *
 * Requisitos:
 *   - JWT token en scripts/jwt-token.txt
 *   - Suscripción activa en OpositaTest para CyL
 */

const fs = require('fs');
const path = require('path');

const JWT_FILE = path.join(__dirname, 'jwt-token.txt');
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'auxiliar-cyl');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'scrape-progress.json');

const OPPOSITION_ID = 175;
const MAX_QUESTIONS = 100;

// Grupo I - Organización política y administrativa (19 temas, T10 sin preguntas)
// Grupo II - Competencias (9 temas)
const TOPICS = [
  { num: 1,  id: 'a64e33ad-ecca-473f-bc6e-d14c56dc9f33', name: 'La Constitución Española', grupo: 'I' },
  { num: 2,  id: '1c6d4e62-16ef-4205-a3e5-a24181ceb62d', name: 'La Administración General del Estado', grupo: 'I' },
  { num: 3,  id: '2a6a83e1-e4ba-48f5-806b-c766fc8905e0', name: 'La Administración local', grupo: 'I' },
  { num: 4,  id: 'fc662961-aa7c-417d-bd40-9672e5403dd1', name: 'La Unión Europea', grupo: 'I' },
  { num: 5,  id: '92f79e79-94a6-418e-aee1-112d390edcb2', name: 'El Estatuto de Autonomía de Castilla y León', grupo: 'I' },
  { num: 6,  id: '0bba3b48-66cf-4d41-96b0-59b4dd108d01', name: 'Las Cortes de Castilla y León', grupo: 'I' },
  { num: 7,  id: '14d9d739-4866-489f-8c4b-301cfbf60999', name: 'Instituciones propias de la Comunidad de Castilla y León', grupo: 'I' },
  { num: 8,  id: 'eef52723-55a4-4577-bf41-64edda5681d7', name: 'El Gobierno de la Comunidad de Castilla y León', grupo: 'I' },
  { num: 9,  id: '6adfc03d-e8fb-4a7d-9a03-43c91b5a2d03', name: 'La administración de Castilla y León', grupo: 'I' },
  // T10 no tiene preguntas en OpositaTest
  { num: 11, id: '8ef30223-7e44-4961-8880-6af729c76844', name: 'Las fuentes del derecho administrativo', grupo: 'I' },
  { num: 12, id: 'f652bc77-c515-417e-9505-8ad76c841530', name: 'El acto administrativo', grupo: 'I' },
  { num: 13, id: 'bb0f1d75-2653-4a97-8034-8021716e42fa', name: 'El procedimiento administrativo común', grupo: 'I' },
  { num: 14, id: 'cafd24d0-d449-41d9-b2e3-39aa338a3a2b', name: 'Los órganos de las Administraciones Públicas', grupo: 'I' },
  { num: 15, id: 'f852aa0f-524f-44e8-8439-59d571f89ec6', name: 'El Estatuto Básico del Empleado Público', grupo: 'I' },
  { num: 16, id: 'a56a679d-3167-4a07-9342-bcda42a112f3', name: 'La Ley de la Función Pública de Castilla y León', grupo: 'I' },
  { num: 17, id: 'caba21a4-3767-47fd-bae0-82d526d6f83a', name: 'El derecho de sindicación y de huelga', grupo: 'I' },
  { num: 18, id: '89ecc1c1-c111-4e1b-b44f-48159c2687d7', name: 'El presupuesto de la Comunidad de Castilla y León', grupo: 'I' },
  { num: 19, id: '60cfe520-7f60-42ac-9894-c494f0a7cb4f', name: 'Las políticas de igualdad y no discriminación en Castilla y León', grupo: 'I' },
  { num: 20, id: '1d9a848d-0c69-490f-bfec-0bb2e9abcc00', name: 'Los derechos de las personas en sus relaciones con las AAPP', grupo: 'II' },
  { num: 21, id: 'ee941698-99b5-48ed-bd3b-e819087d2ad7', name: 'Las oficinas de asistencia en materia de registros de CyL', grupo: 'II' },
  { num: 22, id: '61c0d9b4-ef6c-4624-a4aa-a4cb667395c2', name: 'La Administración electrónica', grupo: 'II' },
  { num: 23, id: 'c2357d82-3a48-4e35-8ee6-f02a23e46049', name: 'Transparencia y acceso a la información pública en CyL', grupo: 'II' },
  { num: 24, id: '2aad7ea8-9306-4c94-9be3-4cc71019eb1a', name: 'El concepto de documento', grupo: 'II' },
  { num: 25, id: '17d27c26-85ad-4ebf-aaf4-7f2947336565', name: 'Informática básica', grupo: 'II' },
  { num: 26, id: '510d2b75-420a-4c14-8a61-ccac44f3c4cc', name: 'Sistemas ofimáticos', grupo: 'II' },
  { num: 27, id: '4c90a320-f5b1-4ee0-8ab9-27588f8e9aab', name: 'Correo electrónico', grupo: 'II' },
  { num: 28, id: 'f69b6d13-c3c7-481c-b770-9673044cb318', name: 'Seguridad y salud en el puesto de trabajo', grupo: 'II' },
];

// Convocatorias anteriores (exámenes oficiales)
const PREVIOUS_CALLS = [
  { id: 22060708, name: 'Examen 2021 (OEP 2018)' },
  { id: 22086895, name: 'Examen aplazo 2022 (OEP 2018)' },
  { id: 36868896, name: 'Examen 2024 (OEP 2019, 2020)' },
  { id: 47573546, name: 'Examen 2025 (OEP 2021, 2022 Y 2023)' },
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
          console.error('❌ Límite de 10 tests. Ejecutar: node scripts/opositatest-cyl.cjs cleanup');
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
  return { topics: {}, exams: {}, totalQuestions: 0 };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Core scraping ───

async function scrapeTopic(topic, progress) {
  const key = `T${topic.num}`;
  if (progress.topics[key]?.done) {
    console.log(`⏭️  ${key} ya scrapeado (${progress.topics[key].count} preguntas)`);
    return;
  }

  console.log(`\n📋 Scrapeando ${key}: ${topic.name}...`);

  // Paso 1: Crear examen personalizado
  const exam = await api('https://api.opositatest.com/api/v2.0/exams', {
    method: 'POST',
    body: JSON.stringify({
      type: 'random',
      oppositionId: OPPOSITION_ID,
      numberOfQuestions: MAX_QUESTIONS,
      contentsRequestedIds: [topic.id]
    })
  });

  if (!exam) { console.error(`❌ Error creando examen para ${key}`); return; }
  console.log(`  Examen creado: ${exam.id}`);

  // Paso 2: Crear test
  const test = await api('https://api.opositatest.com/api/v2.0/tests', {
    method: 'POST',
    body: JSON.stringify({ examId: exam.id, autoStart: true })
  });

  if (!test) { console.error(`❌ Error creando test para ${key}`); return; }
  console.log(`  Test creado: ${test.id}`);

  // Paso 3: Obtener preguntas
  const full = await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}?embedded=questions,responses`);
  if (!full?.questions) { console.error(`❌ Error obteniendo preguntas para ${key}`); return; }

  console.log(`  ${full.questions.length} preguntas obtenidas`);

  // Paso 4: Obtener explicaciones (con delay para evitar rate limit)
  let explanationCount = 0;
  for (const q of full.questions) {
    const reason = await api(`https://api.opositatest.com/api/v2.0/questions/${q.id}/reason`);
    if (reason) {
      q.explanation = reason.content;
      q.explanationTitle = reason.title;
      explanationCount++;
    }
    await sleep(150); // 150ms entre peticiones
  }
  console.log(`  ${explanationCount} explicaciones obtenidas`);

  // Paso 5: Transformar y guardar
  const questions = full.questions.map(q => ({
    id: q.id,
    question: q.declaration,
    explanation: q.explanation || '',
    explanationTitle: q.explanationTitle || '',
    correctAnswerId: q.correctAnswerId,
    options: q.answers.map(a => ({
      id: a.id,
      letter: ['A', 'B', 'C', 'D'][q.answers.indexOf(a)],
      text: a.declaration,
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

  const topicDir = path.join(OUTPUT_DIR, `Tema_${topic.num}`);
  ensureDir(topicDir);

  const outputFile = path.join(topicDir, `tema_${topic.num}.json`);
  const output = {
    tema: `Tema ${topic.num}`,
    nombre: topic.name,
    grupo: topic.grupo,
    source: 'opositatest',
    oposicion: 'Auxiliares Administrativos CyL',
    oppositionId: OPPOSITION_ID,
    contentId: topic.id,
    scrapedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`  ✅ Guardado: ${outputFile}`);

  // Paso 6: Descartar test
  await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}/discard`, { method: 'PUT' });
  console.log(`  Test descartado`);

  // Actualizar progreso
  progress.topics[key] = { done: true, count: questions.length, scrapedAt: new Date().toISOString() };
  progress.totalQuestions = Object.values(progress.topics).reduce((sum, t) => sum + (t.count || 0), 0);
  saveProgress(progress);

  // Esperar entre temas
  await sleep(2000);
}

async function scrapeExam(exam, progress) {
  const key = `exam_${exam.id}`;
  if (progress.exams[key]?.done) {
    console.log(`⏭️  ${exam.name} ya scrapeado (${progress.exams[key].count} preguntas)`);
    return;
  }

  console.log(`\n📋 Scrapeando ${exam.name}...`);

  // Para convocatorias, solo paso 2 (ya tienen examId)
  const test = await api('https://api.opositatest.com/api/v2.0/tests', {
    method: 'POST',
    body: JSON.stringify({ examId: exam.id, autoStart: true })
  });

  if (!test) { console.error(`❌ Error creando test para ${exam.name}`); return; }
  console.log(`  Test creado: ${test.id}`);

  const full = await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}?embedded=questions,responses`);
  if (!full?.questions) { console.error(`❌ Error obteniendo preguntas`); return; }

  console.log(`  ${full.questions.length} preguntas obtenidas`);

  // Explicaciones
  let explanationCount = 0;
  for (const q of full.questions) {
    const reason = await api(`https://api.opositatest.com/api/v2.0/questions/${q.id}/reason`);
    if (reason) {
      q.explanation = reason.content;
      q.explanationTitle = reason.title;
      explanationCount++;
    }
    await sleep(150);
  }
  console.log(`  ${explanationCount} explicaciones obtenidas`);

  const questions = full.questions.map(q => ({
    id: q.id,
    question: q.declaration,
    explanation: q.explanation || '',
    explanationTitle: q.explanationTitle || '',
    correctAnswerId: q.correctAnswerId,
    options: q.answers.map(a => ({
      id: a.id,
      letter: ['A', 'B', 'C', 'D'][q.answers.indexOf(a)],
      text: a.declaration,
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

  const examDir = path.join(OUTPUT_DIR, 'examenes-oficiales');
  ensureDir(examDir);

  const safeName = exam.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outputFile = path.join(examDir, `${safeName}.json`);
  const output = {
    nombre: exam.name,
    examId: exam.id,
    source: 'opositatest',
    oposicion: 'Auxiliares Administrativos CyL',
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
  console.log('\n📊 Estado del scraping CyL\n');

  const doneTopics = Object.entries(progress.topics).filter(([, v]) => v.done);
  const pendingTopics = TOPICS.filter(t => !progress.topics[`T${t.num}`]?.done);

  console.log(`Temas: ${doneTopics.length}/${TOPICS.length} completados`);
  for (const t of TOPICS) {
    const key = `T${t.num}`;
    const p = progress.topics[key];
    if (p?.done) {
      console.log(`  ✅ T${t.num}: ${p.count} preguntas`);
    } else {
      console.log(`  ⬜ T${t.num}: ${t.name}`);
    }
  }

  const doneExams = Object.entries(progress.exams).filter(([, v]) => v.done);
  console.log(`\nConvocatorias: ${doneExams.length}/${PREVIOUS_CALLS.length} completadas`);
  for (const e of PREVIOUS_CALLS) {
    const key = `exam_${e.id}`;
    const p = progress.exams[key];
    if (p?.done) {
      console.log(`  ✅ ${e.name}: ${p.count} preguntas`);
    } else {
      console.log(`  ⬜ ${e.name}`);
    }
  }

  console.log(`\nTotal preguntas scrapeadas: ${progress.totalQuestions || 0}`);
}

// ─── Main ───

(async () => {
  loadJWT();
  ensureDir(OUTPUT_DIR);
  const progress = loadProgress();

  const cmd = process.argv[2] || 'temas';

  switch (cmd) {
    case 'temas':
      console.log('🚀 Scrapeando todos los temas de CyL...\n');
      for (const topic of TOPICS) {
        await scrapeTopic(topic, progress);
      }
      console.log(`\n✅ Completado. Total: ${progress.totalQuestions} preguntas`);
      break;

    case 'exams':
      console.log('🚀 Scrapeando convocatorias anteriores de CyL...\n');
      for (const exam of PREVIOUS_CALLS) {
        await scrapeExam(exam, progress);
      }
      break;

    case 'tema': {
      const num = parseInt(process.argv[3]);
      if (!num) { console.error('Uso: node scripts/opositatest-cyl.cjs tema 5'); process.exit(1); }
      const topic = TOPICS.find(t => t.num === num);
      if (!topic) { console.error(`Tema ${num} no encontrado (T10 no tiene preguntas)`); process.exit(1); }
      await scrapeTopic(topic, progress);
      break;
    }

    case 'status':
      showStatus(progress);
      break;

    case 'cleanup':
      await cleanupTests();
      break;

    default:
      console.log('Comandos: temas, exams, tema N, status, cleanup');
  }
})();
