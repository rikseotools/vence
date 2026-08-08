// v2: solo opciones LARGAS (>=8 palabras de contenido), y la razón no encaja con NINGUNA opción.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const STOP = new Set(('de la el los las un una y o que en a al del es son no se por para con su sus como pero si lo le ni este esta esa ese cuando donde cual cuales mas solo todo todos toda todas ser sera seran han haber puede podra podran debe deben caso casos').split(' '));
const pal = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ]+/g,' ').split(' ').filter(w => w.length > 3 && !STOP.has(w));
const recall = (bullet, opcion) => { const B = new Set(pal(bullet)), O = new Set(pal(opcion)); if (!O.size) return null; let h=0; for (const w of O) if (B.has(w)) h++; return h/O.size; };
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT id, option_a, option_b, option_c, option_d, explanation FROM questions
     WHERE is_active = true AND explanation ILIKE '%Por qué las demás son incorrectas%'`);
  let segmentos = 0; const hall = [];
  for (const r of rows) {
    const ops = { A: r.option_a, B: r.option_b, C: r.option_c, D: r.option_d };
    const cola = r.explanation.split(/Por qué las demás son incorrectas/i)[1] || '';
    const re = /^\s*[-*]\s*\**\s*([A-D])\)?\**\s*[:)\-–—]\s*(.+)$/gim;
    let m;
    while ((m = re.exec(cola)) !== null) {
      const L = m[1].toUpperCase(), texto = m[2].trim();
      if (!ops[L] || texto.length < 30) continue;
      if (new Set(pal(ops[L])).size < 8) continue;   // opción corta: el solape no mide nada
      segmentos++;
      const propia = recall(texto, ops[L]);
      const otras = ['A','B','C','D'].filter(x=>x!==L && ops[x]).map(x => recall(texto, ops[x]) ?? 0);
      if (propia <= 0.10 && Math.max(...otras, 0) <= 0.25) {
        hall.push({ id: r.id, L, propia:+propia.toFixed(2), texto: texto.slice(0,130), opcion: ops[L].slice(0,110) });
      }
    }
  }
  console.log(`Universo: ${rows.length} preguntas · segmentos medibles (opción larga): ${segmentos}`);
  console.log(`Razones que no encajan con NINGUNA opción: ${hall.length} segmentos en ${new Set(hall.map(h=>h.id)).size} preguntas\n`);
  for (const h of hall.slice(0,20)) {
    console.log(`${h.id.slice(0,8)} | ${h.L} (recall ${h.propia})`);
    console.log(`   opción: ${h.opcion}`);
    console.log(`   razón : ${h.texto}\n`);
  }
  await c.end();
})();
