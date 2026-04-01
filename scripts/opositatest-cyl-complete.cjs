/**
 * Scraper de rondas adicionales para temas con >100 preguntas
 * Hace rondas sucesivas hasta que no aparezcan preguntas nuevas (3 rondas sin nuevas = completo)
 *
 * Uso: node scripts/opositatest-cyl-complete.cjs
 */

const fs = require('fs');
const path = require('path');

const JWT_FILE = path.join(__dirname, 'jwt-token.txt');
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'auxiliar-cyl');
const OPPOSITION_ID = 175;
const MAX_QUESTIONS = 100;
const MAX_ROUNDS = 15; // máximo de rondas por tema
const EMPTY_ROUNDS_TO_STOP = 3; // parar tras N rondas sin preguntas nuevas

const jwt = fs.readFileSync(JWT_FILE, 'utf-8').trim();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(url, opts = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        ...opts,
        headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json', ...(opts.headers || {}) }
      });
      if (r.status === 401) { console.error('❌ JWT expirado'); process.exit(1); }
      if (r.status === 429) { console.log('⏳ Rate limit 60s...'); await sleep(60000); continue; }
      if (r.status === 204) return {};
      if (!r.ok) {
        const body = await r.text();
        if (body.includes('TestCreatedOrInProgressLimitReached')) {
          console.error('❌ Límite tests. Ejecutar cleanup primero.');
          process.exit(1);
        }
        console.error(`❌ HTTP ${r.status}: ${body.substring(0, 200)}`);
        return null;
      }
      return r.json();
    } catch (err) {
      console.error(`⚠️ Red (${attempt + 1}):`, err.message);
      await sleep(3000);
    }
  }
  return null;
}

// Temas que devolvieron exactamente 100 (posible más)
const INCOMPLETE_TOPICS = [
  { num: 1,  id: 'a64e33ad-ecca-473f-bc6e-d14c56dc9f33', name: 'La Constitución Española' },
  { num: 2,  id: '1c6d4e62-16ef-4205-a3e5-a24181ceb62d', name: 'La Administración General del Estado' },
  { num: 3,  id: '2a6a83e1-e4ba-48f5-806b-c766fc8905e0', name: 'La Administración local' },
  { num: 4,  id: 'fc662961-aa7c-417d-bd40-9672e5403dd1', name: 'La Unión Europea' },
  { num: 5,  id: '92f79e79-94a6-418e-aee1-112d390edcb2', name: 'El Estatuto de Autonomía de Castilla y León' },
  { num: 6,  id: '0bba3b48-66cf-4d41-96b0-59b4dd108d01', name: 'Las Cortes de Castilla y León' },
  { num: 7,  id: '14d9d739-4866-489f-8c4b-301cfbf60999', name: 'Instituciones propias de la Comunidad de Castilla y León' },
  { num: 11, id: '8ef30223-7e44-4961-8880-6af729c76844', name: 'Las fuentes del derecho administrativo' },
  { num: 12, id: 'f652bc77-c515-417e-9505-8ad76c841530', name: 'El acto administrativo' },
  { num: 13, id: 'bb0f1d75-2653-4a97-8034-8021716e42fa', name: 'El procedimiento administrativo común' },
  { num: 14, id: 'cafd24d0-d449-41d9-b2e3-39aa338a3a2b', name: 'Los órganos de las Administraciones Públicas' },
  { num: 15, id: 'f852aa0f-524f-44e8-8439-59d571f89ec6', name: 'El Estatuto Básico del Empleado Público' },
  { num: 16, id: 'a56a679d-3167-4a07-9342-bcda42a112f3', name: 'La Ley de la Función Pública de Castilla y León' },
  { num: 17, id: 'caba21a4-3767-47fd-bae0-82d526d6f83a', name: 'El derecho de sindicación y de huelga' },
  { num: 18, id: '89ecc1c1-c111-4e1b-b44f-48159c2687d7', name: 'El presupuesto de la Comunidad de Castilla y León' },
  { num: 19, id: '60cfe520-7f60-42ac-9894-c494f0a7cb4f', name: 'Las políticas de igualdad y no discriminación en Castilla y León' },
  { num: 22, id: '61c0d9b4-ef6c-4624-a4aa-a4cb667395c2', name: 'La Administración electrónica' },
  { num: 25, id: '17d27c26-85ad-4ebf-aaf4-7f2947336565', name: 'Informática básica' },
  { num: 26, id: '510d2b75-420a-4c14-8a61-ccac44f3c4cc', name: 'Sistemas ofimáticos' },
  { num: 27, id: '4c90a320-f5b1-4ee0-8ab9-27588f8e9aab', name: 'Correo electrónico' },
  { num: 28, id: 'f69b6d13-c3c7-481c-b770-9673044cb318', name: 'Seguridad y salud en el puesto de trabajo' },
];

function transformQuestion(q) {
  return {
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
  };
}

(async () => {
  console.log('🔄 Completando temas con más de 100 preguntas...\n');

  const summary = [];

  for (const topic of INCOMPLETE_TOPICS) {
    const topicDir = path.join(OUTPUT_DIR, `Tema_${topic.num}`);
    const mainFile = path.join(topicDir, `tema_${topic.num}.json`);

    // Cargar preguntas existentes
    const existing = JSON.parse(fs.readFileSync(mainFile, 'utf-8'));
    const allQuestions = new Map();
    for (const q of existing.questions) {
      allQuestions.set(q.id, q);
    }

    const initialCount = allQuestions.size;
    let emptyRounds = 0;

    console.log(`📋 T${topic.num}: ${topic.name} (${initialCount} existentes)`);

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (emptyRounds >= EMPTY_ROUNDS_TO_STOP) break;

      // Crear examen + test
      const exam = await api('https://api.opositatest.com/api/v2.0/exams', {
        method: 'POST',
        body: JSON.stringify({
          type: 'random',
          oppositionId: OPPOSITION_ID,
          numberOfQuestions: MAX_QUESTIONS,
          contentsRequestedIds: [topic.id]
        })
      });
      if (!exam) { console.log(`  ❌ Error ronda ${round}`); break; }

      const test = await api('https://api.opositatest.com/api/v2.0/tests', {
        method: 'POST',
        body: JSON.stringify({ examId: exam.id, autoStart: true })
      });
      if (!test) { console.log(`  ❌ Error test ronda ${round}`); break; }

      const full = await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}?embedded=questions,responses`);
      if (!full?.questions) { console.log(`  ❌ Error preguntas ronda ${round}`); break; }

      // Encontrar nuevas
      const newQuestions = full.questions.filter(q => !allQuestions.has(q.id));

      if (newQuestions.length === 0) {
        emptyRounds++;
        console.log(`  Ronda ${round}: 0 nuevas (${emptyRounds}/${EMPTY_ROUNDS_TO_STOP} vacías)`);
      } else {
        emptyRounds = 0;
        // Obtener explicaciones solo de las nuevas
        for (const q of newQuestions) {
          const reason = await api(`https://api.opositatest.com/api/v2.0/questions/${q.id}/reason`);
          if (reason) {
            q.explanation = reason.content;
            q.explanationTitle = reason.title;
          }
          await sleep(150);
        }

        for (const q of newQuestions) {
          allQuestions.set(q.id, transformQuestion(q));
        }
        console.log(`  Ronda ${round}: +${newQuestions.length} nuevas → ${allQuestions.size} total`);
      }

      // Descartar test
      await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}/discard`, { method: 'PUT' });
      await sleep(1500);
    }

    const finalCount = allQuestions.size;
    const gained = finalCount - initialCount;

    if (gained > 0) {
      // Guardar archivo actualizado
      existing.questions = [...allQuestions.values()];
      existing.questionCount = finalCount;
      existing.completedAt = new Date().toISOString();
      existing.rounds = 'multiple';
      fs.writeFileSync(mainFile, JSON.stringify(existing, null, 2));
      console.log(`  ✅ T${topic.num}: ${initialCount} → ${finalCount} (+${gained})\n`);
    } else {
      console.log(`  ✅ T${topic.num}: ${initialCount} (realmente tiene ${initialCount}, completo)\n`);
    }

    summary.push({ tema: topic.num, initial: initialCount, final: finalCount, gained });
    await sleep(2000);
  }

  console.log('\n=== RESUMEN ===');
  let totalGained = 0;
  for (const s of summary) {
    if (s.gained > 0) {
      console.log(`T${s.tema}: ${s.initial} → ${s.final} (+${s.gained})`);
      totalGained += s.gained;
    } else {
      console.log(`T${s.tema}: ${s.final} (completo)`);
    }
  }
  console.log(`\nTotal preguntas nuevas: +${totalGained}`);
  console.log(`Total general: ${summary.reduce((sum, s) => sum + s.final, 0)}`);
})();
