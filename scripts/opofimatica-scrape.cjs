// scripts/opofimatica-scrape.cjs
// Scraper de OpofimáticaEstado (WordPress + Quiz Maker ays-pro).
// Las preguntas van SERVER-RENDERED en el HTML del test para el usuario logueado,
// CON la respuesta correcta marcada (ays_answer_correct[]=1). Cada test muestra
// 30 aleatorias de un pool mayor → RELOAD-TO-SATURATE (recargar hasta que K
// recargas seguidas no aporten nuevas). Dedupe por data-question-id.
//
// Captura SIN PÉRDIDA + metadatos de versión (crítico: web vs escritorio tienen
// funciones distintas): categoría, pregunta cruda, opciones A-D + correcta,
// explicación (si está en el HTML), hashtags, versión Office (365/2019/2016),
// entorno (web/escritorio), Windows (10/11), marcador [test N], question-id.
//
// Salida: preguntas-para-subir/opofimaticaestado/{categoria}.json
// Uso: node scripts/opofimatica-scrape.cjs

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'opofimaticaestado');
const COOKIES = require('./opofimatica-cookies.json');
const JAR = COOKIES.filter((c) => /opofimaticaestado/.test(c.domain)).map((c) => `${c.name}=${c.value}`).join('; ');
const H = { Cookie: JAR, 'User-Agent': 'Mozilla/5.0' };

const SLUGS = [
  'test-aleatorio-word', 'test-aleatorio-excel', 'test-aleatorio-access',
  'test-aleatorio-outlook', 'test-aleatorio-windows', 'test-aleatorio-windows-11',
  'test-aleatorio-internet', 'test-aleatorio-informatica', 'test-aleatorio-2026',
  'test-aleatorio-word-excel', 'test-aleatorio',
];
const MAX_RELOADS = 2000;     // sin límite práctico — saturar el pool completo
const DRY_ROUNDS_STOP = 25;   // parar solo tras 25 recargas seguidas SIN nuevas (saturación real; coupon-collector tiene cola larga)
const DELAY_MS = 350;
const CHECKPOINT = path.join(__dirname, '..', 'preguntas-para-subir', 'opofimaticaestado', '_checkpoint.json');

const clean = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8230;/g, '…').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normCat(c) {
  if (!c) return null;
  const t = c.trim();
  if (/^windows\s*11$/i.test(t)) return 'Windows 11';
  if (/^windows\s*10$/i.test(t) || /^windows$/i.test(t)) return 'Windows 10';
  return t;
}

function metadata(qRaw) {
  const q = qRaw.toLowerCase();
  const hashtags = [...qRaw.matchAll(/#[a-z0-9áéíóúñ]{2,}/gi)].map((m) => m[0].toLowerCase())
    .filter((t) => /office|365|2019|2016|web|escritorio|windows|word|excel|access|outlook/.test(t));
  let office = null;
  if (/365/.test(q)) office = '365'; else if (/2019/.test(q)) office = '2019'; else if (/2016/.test(q)) office = '2016';
  let entorno = null;
  if (/\bweb\b|en la web|online|navegador/.test(q)) entorno = 'web';
  else if (/escritorio|desktop|aplicaci[oó]n de escritorio/.test(q)) entorno = 'escritorio';
  let windows = null;
  if (/windows\s*11|\bwin\s*11\b/.test(q)) windows = '11'; else if (/windows\s*10|\bwin\s*10\b/.test(q)) windows = '10';
  const testMarker = (qRaw.match(/\[test\s*\d+\]/i) || [])[0] || null;
  return { hashtags: [...new Set(hashtags)], office, entorno, windows, testMarker };
}

function parseQuestions(html) {
  const out = [];
  const blocks = html.split(/<div class='step\s/).slice(1);
  for (const raw of blocks) {
    const idm = raw.match(/data-question-id='(\d+)'/);
    if (!idm) continue;
    const id = idm[1];
    const qm = raw.match(/<div class='ays_quiz_question'>([\s\S]*?)<\/div>/);
    if (!qm) continue;
    const questionRaw = clean(qm[1]);
    if (!questionRaw) continue;
    const catm = raw.match(/Categor[ií&][^<]*<\/em>\s*<strong[^>]*>([^<]+)<\/strong>/i);
    const category = normCat(catm ? catm[1] : null);

    // Opciones: por cada answer div, flag de correcta + texto del label
    const ansStart = raw.indexOf("ays-quiz-answers");
    const ansSection = ansStart >= 0 ? raw.slice(ansStart) : raw;
    const options = [];
    const re = /ays_answer_correct\[\]'\s*value='(\d)'[\s\S]*?<label[^>]*for='ays-answer-\d+-\d+'[^>]*>([\s\S]*?)<\/label>/g;
    let m;
    while ((m = re.exec(ansSection)) !== null) {
      const text = clean(m[2]);
      if (!text) continue;
      options.push({ correct: m[1] === '1', text });
      if (options.length >= 8) break; // guard
    }
    if (options.length < 2) continue;
    const correctIdx = options.findIndex((o) => o.correct);
    const correctLetter = correctIdx >= 0 ? 'ABCDEFGH'[correctIdx] : null;

    // Explicación (si el HTML la trae; a menudo no)
    const em = raw.match(/ays_quest[it]{1,2}on_explanation[^>]*>([\s\S]*?)<\/div>/i);
    const explanation = em ? clean(em[1]) || null : null;

    out.push({
      sourceId: id,
      category,
      question: questionRaw,
      options: options.map((o, i) => ({ letter: 'ABCDEFGH'[i], text: o.text, correct: o.correct })),
      correctLetter,
      explanation,
      version: metadata(questionRaw),
      source: 'opofimaticaestado',
    });
  }
  return out;
}

function saveCheckpoint(global) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ ts: 'live', count: global.size, questions: [...global.values()] }));
}
function loadCheckpoint(global) {
  try {
    const c = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
    for (const q of c.questions || []) global.set(q.sourceId, q);
    console.log(`↩️  checkpoint cargado: ${global.size} preguntas ya scrapeadas (resume)`);
  } catch {}
}

// Recorre un slug añadiendo al mapa GLOBAL compartido (dedupe cross-slug).
// Satura de verdad: para tras DRY_ROUNDS_STOP recargas seguidas sin NINGUNA nueva.
async function scrapeSlug(slug, global) {
  let dry = 0;
  for (let i = 0; i < MAX_RELOADS && dry < DRY_ROUNDS_STOP; i++) {
    let html;
    try {
      const r = await fetch(`https://www.opofimaticaestado.com/${slug}/?_=${i}_${(i * 7919) % 100003}`, { headers: H });
      html = await r.text();
    } catch (e) { console.log(`  ${slug} recarga ${i} ERROR ${e.message}`); await sleep(DELAY_MS); continue; }
    const before = global.size;
    for (const q of parseQuestions(html)) if (!global.has(q.sourceId)) global.set(q.sourceId, q);
    const added = global.size - before;
    dry = added === 0 ? dry + 1 : 0;
    if (i % 10 === 0 || added > 0) process.stdout.write(`  ${slug}: recarga ${i} +${added} → GLOBAL ${global.size} (dry ${dry}/${DRY_ROUNDS_STOP})\n`);
    if (i % 15 === 0) saveCheckpoint(global);
    await sleep(DELAY_MS);
  }
  saveCheckpoint(global);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const global = new Map(); // dedupe cross-slug por sourceId
  loadCheckpoint(global);
  for (const slug of SLUGS) {
    console.log(`\n### ${slug} (global actual: ${global.size})`);
    await scrapeSlug(slug, global);
  }
  const perCat = {};
  for (const q of global.values()) {
    const cat = q.category || 'sin-categoria';
    (perCat[cat] = perCat[cat] || []).push(q);
  }
  // guardar por categoría
  let total = 0;
  const summary = {};
  for (const [cat, qs] of Object.entries(perCat)) {
    const file = path.join(OUT_DIR, cat.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json');
    fs.writeFileSync(file, JSON.stringify({ category: cat, source: 'opofimaticaestado', scrapedAt: 'RUNSTAMP', count: qs.length, questions: qs }, null, 2));
    total += qs.length;
    // desglose de versión/entorno
    const withExpl = qs.filter((q) => q.explanation).length;
    const web = qs.filter((q) => q.version.entorno === 'web').length;
    const esc = qs.filter((q) => q.version.entorno === 'escritorio').length;
    const v365 = qs.filter((q) => q.version.office === '365').length;
    const v2019 = qs.filter((q) => q.version.office === '2019').length;
    summary[cat] = { total: qs.length, conExplicacion: withExpl, web, escritorio: esc, o365: v365, o2019: v2019 };
  }
  fs.writeFileSync(path.join(OUT_DIR, '_summary.json'), JSON.stringify({ total, categorias: summary }, null, 2));
  console.log(`\n=== TOTAL: ${total} preguntas únicas ===`);
  console.table(summary);
})();
