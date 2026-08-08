// ¿Cuántas explicaciones activas dan, para una opción, una razón que encaja MEJOR con otra opción?
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const STOP = new Set(('de la el los las un una y o que en a al del es son no se por para con su sus como pero si lo le ni e u be ce este esta esa ese cuando donde cual cuales mas más solo sólo todo todos toda todas ser sera será han ha haber puede podra podrá podran podrán').split(' '));
const pal = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ]+/g,' ').split(' ').filter(w => w.length > 3 && !STOP.has(w));
const recall = (bullet, opcion) => {
  const B = new Set(pal(bullet)), O = pal(opcion);
  if (!O.length || B.size === 0) return 0;
  let hit = 0; for (const w of new Set(O)) if (B.has(w)) hit++;
  return hit / new Set(O).size;
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`
    SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation
    FROM questions
    WHERE is_active = true AND explanation ILIKE '%Por qué las demás son incorrectas%'`);
  console.log('Universo (formato "Por qué las demás son incorrectas"): ' + rows.length);

  const hallazgos = [];
  for (const r of rows) {
    const ops = { A: r.option_a, B: r.option_b, C: r.option_c, D: r.option_d };
    const cola = r.explanation.split(/Por qué las demás son incorrectas/i)[1] || '';
    // bullets tipo "- **A)** texto"  /  "- A: texto"  /  "- A) texto"
    const re = /^\s*[-*]\s*\**\s*([A-D])\)?\**\s*[:)\-–—]\s*(.+)$/gim;
    let m;
    while ((m = re.exec(cola)) !== null) {
      const letra = m[1].toUpperCase(), texto = m[2].trim();
      if (!ops[letra] || texto.length < 25) continue;
      const propia = recall(texto, ops[letra]);
      let mejor = letra, mejorR = propia;
      for (const L of ['A','B','C','D']) {
        if (L === letra || !ops[L]) continue;
        const rr = recall(texto, ops[L]);
        if (rr > mejorR) { mejor = L; mejorR = rr; }
      }
      if (mejor !== letra && mejorR - propia >= 0.30 && propia <= 0.25) {
        hallazgos.push({ id: r.id, letra, mejor, propia: +propia.toFixed(2), otro: +mejorR.toFixed(2), texto: texto.slice(0,110), opcion: (ops[letra]||'').slice(0,90) });
      }
    }
  }
  console.log('Preguntas con razón descolocada: ' + new Set(hallazgos.map(h=>h.id)).size + ' (segmentos: ' + hallazgos.length + ')\n');
  for (const h of hallazgos.slice(0, 25)) {
    console.log(`${h.id.slice(0,8)} | razón de ${h.letra} (recall ${h.propia}) encaja con ${h.mejor} (${h.otro})`);
    console.log(`   opción ${h.letra}: ${h.opcion}`);
    console.log(`   razón dada: ${h.texto}`);
  }
  await c.end();
})();
