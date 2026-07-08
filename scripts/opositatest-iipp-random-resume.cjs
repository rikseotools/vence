// Scraper RANDOM reanudable: carga lo ya guardado, captura SOLO preguntas nuevas
// (random whole-opo), baja explicaciones SOLO de las nuevas, fusiona y guarda.
// Corre hasta saturación REAL (N lotes seguidos sin ninguna nueva) o tope alto.
// Idempotente: se puede relanzar varias veces hasta que no salgan nuevas.
const fs = require('fs'), path = require('path');
const jwt = fs.readFileSync('scripts/jwt-token.txt', 'utf8').trim();
const H = { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' };
const API = 'https://api.opositatest.com/api/v2.0';
const FILE = 'preguntas-para-subir/instituciones-penitenciarias/estudio-random/estudio_random.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAT = 25;       // lotes consecutivos sin nuevas = saturado
const MAXBATCH = 600; // tope de seguridad por ejecución

async function reason(qid) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API}/questions/${qid}/reason`, { headers: H });
    if (r.status === 429) { console.error('  429, espero 60s'); await sleep(60000); continue; }
    if (r.status !== 200) return {};
    return r.json();
  }
  return {};
}

(async () => {
  const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const existing = d.questions;
  const seen = new Set(existing.map(q => q.id));
  console.error('Cargadas previas:', seen.size);

  const nuevas = new Map();
  let sinNuevas = 0, batch = 0;
  while (sinNuevas < SAT && batch < MAXBATCH) {
    const ex = await fetch(`${API}/exams`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'random', oppositionId: 11, numberOfQuestions: 100 }) }).then(r => r.json());
    if (!ex.id) { console.error('exam fail', JSON.stringify(ex).slice(0, 80)); break; }
    const t = await fetch(`${API}/tests`, { method: 'POST', headers: H, body: JSON.stringify({ examId: ex.id, autoStart: true }) }).then(r => r.json());
    const f = await fetch(`${API}/tests/${t.id}?embedded=questions,responses`, { headers: H }).then(r => r.json());
    let n = 0;
    for (const q of (f.questions || [])) { if (!seen.has(q.id)) { seen.add(q.id); nuevas.set(q.id, q); n++; } }
    await fetch(`${API}/tests/${t.id}/discard`, { method: 'PUT', headers: H });
    batch++; sinNuevas = n === 0 ? sinNuevas + 1 : 0;
    if (batch % 10 === 0) console.error(`  batch ${batch}: +${nuevas.size} nuevas (racha sin nuevas: ${sinNuevas}/${SAT})`);
    await sleep(300);
  }
  const saturo = sinNuevas >= SAT;
  console.error(`Fin captura. Nuevas: ${nuevas.size} en ${batch} batches. ${saturo ? 'SATURADO ✅' : 'tope alcanzado (relanzar) ⚠️'}`);

  // explicaciones SOLO de las nuevas
  const arr = [...nuevas.values()]; let done = 0;
  for (const q of arr) { const r = await reason(q.id); q._exp = r.content; q._expT = r.title; done++; if (done % 50 === 0) console.error('  expl ' + done + '/' + arr.length); await sleep(180); }

  // fusionar y guardar
  const toOut = q => { const ci = q.answers.findIndex(a => a.id === q.correctAnswerId); return {
    id: q.id, question: q.declaration, options: q.answers.map((a, i) => ({ letter: ['A', 'B', 'C', 'D', 'E'][i], text: a.declaration })),
    correctAnswer: ['A', 'B', 'C', 'D', 'E'][ci], explanation: q._exp, explanationTitle: q._expT,
    isAnnulled: q.isAnnulled, isRepealed: q.isRepealed, contents: (q.contents || []).map(c => ({ name: c.name, child: c.child ? c.child.name : null })) }; };
  const merged = existing.concat(arr.map(toOut));
  fs.writeFileSync(FILE, JSON.stringify({ source: 'opositatest-random-study', oppositionId: 11, scrapedAt: new Date().toISOString(), saturated: saturo, questionCount: merged.length, questions: merged }, null, 2));
  console.log(`GUARDADO: ${merged.length} total (+${arr.length} nuevas). ${saturo ? 'BANCO COMPLETO' : 'relanzar para más'}`);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
