#!/usr/bin/env node
/**
 * Scraper OpositaTest — Ayudantes de Instituciones Penitenciarias (oppositionId 11)
 * Scrapea las 9 convocatorias anteriores (previousCall) completas, con explicaciones.
 * Sigue docs/scraping/opositatest-api-manual.md.
 *
 * Output: preguntas-para-subir/instituciones-penitenciarias/convocatorias-anteriores/
 */
const fs = require('fs');
const path = require('path');

const JWT = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();
const H = { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' };
const API = 'https://api.opositatest.com/api/v2.0';
const OUT = path.join(__dirname, '..', 'preguntas-para-subir', 'instituciones-penitenciarias', 'convocatorias-anteriores');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXAMS = [
  { examId: 1420248, title: 'Examen 2016 (OEP 2016)' },
  { examId: 639383, title: 'Examen 2018 (OEP 2017)' },
  { examId: 2442799, title: 'Examen 2019 (OEP 2018)' },
  { examId: 8493055, title: 'Examen 2020 (OEP 2019)' },
  { examId: 18845708, title: 'Examen 2021 (OEP 2020)' },
  { examId: 24937659, title: 'Examen 2022 (OEP 2021-2022)' },
  { examId: 35347479, title: 'Examen 2024 (OEP 2023)' },
  { examId: 43776752, title: 'Examen 2025 (OEP 2024)' },
  { examId: 51783607, title: 'Examen 2026 (OEP 2025)' },
];

async function getExplanation(qid, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const r = await fetch(`${API}/questions/${qid}/reason`, { headers: H });
    if (r.status === 429) { console.log('  ⏳ rate limit, espero 60s...'); await sleep(60000); continue; }
    if (r.status !== 200) return { title: null, content: null };
    return r.json();
  }
  return { title: null, content: null };
}

async function scrapeExam(exam) {
  const safe = exam.title.replace(/[^a-zA-Z0-9]+/g, '_');
  const outFile = path.join(OUT, safe + '.json');
  if (fs.existsSync(outFile)) { console.log('⏭️  ya existe:', safe); return; }

  console.log(`\n📥 ${exam.title} (examId ${exam.examId})`);
  const t = await fetch(`${API}/tests`, { method: 'POST', headers: H, body: JSON.stringify({ examId: exam.examId, autoStart: true }) }).then((r) => r.json());
  if (!t.id) { console.log('  ❌ no se pudo crear test:', JSON.stringify(t.error || t)); return; }

  const full = await fetch(`${API}/tests/${t.id}?embedded=questions,responses`, { headers: H }).then((r) => r.json());
  const qs = full.questions || [];
  console.log('  preguntas:', qs.length, '— obteniendo explicaciones...');

  const questions = [];
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const reason = await getExplanation(q.id);
    const correctIdx = q.answers.findIndex((a) => a.id === q.correctAnswerId);
    questions.push({
      id: q.id,
      position: i + 1,
      question: q.declaration,
      options: q.answers.map((a, idx) => ({ letter: ['A', 'B', 'C', 'D', 'E'][idx], text: a.declaration, isCorrect: a.id === q.correctAnswerId })),
      correctAnswer: ['A', 'B', 'C', 'D', 'E'][correctIdx],
      explanation: reason.content,
      explanationTitle: reason.title,
      isAnnulled: q.isAnnulled,
      isRepealed: q.isRepealed,
      contents: (q.contents || []).map((c) => ({ name: c.name, child: c.child ? c.child.name : null })),
    });
    if ((i + 1) % 20 === 0) console.log(`    ${i + 1}/${qs.length}`);
    await sleep(200);
  }

  await fetch(`${API}/tests/${t.id}/discard`, { method: 'PUT', headers: H });

  const annulled = questions.filter((q) => q.isAnnulled).length;
  const repealed = questions.filter((q) => q.isRepealed).length;
  const withExp = questions.filter((q) => q.explanation).length;

  fs.writeFileSync(outFile, JSON.stringify({
    metadata: { examId: exam.examId, title: exam.title, type: 'previousCall', oppositionId: 11 },
    source: 'opositatest-api-complete-v2',
    oppositionName: 'instituciones-penitenciarias',
    scrapedAt: new Date().toISOString(),
    questionCount: questions.length,
    stats: { annulled, repealed, withExplanation: withExp },
    questions,
  }, null, 2));
  console.log(`  ✅ guardado: ${questions.length} preg · ${withExp} explic · ${annulled} anuladas · ${repealed} derogadas`);
  await sleep(3000);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('🏛️  Scraping IIPP — 9 convocatorias');
  for (const e of EXAMS) {
    try { await scrapeExam(e); } catch (err) { console.log('  ❌ error en', e.title, ':', err.message); }
  }
  console.log('\n🏁 Terminado. Output:', OUT);
})();
