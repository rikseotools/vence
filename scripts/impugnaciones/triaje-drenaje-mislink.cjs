#!/usr/bin/env node
// TRIAJE (read-only) del cubo needs_human de mislink (proveedores mislink_review_2026_07 + mislink_v1).
// Objetivo: convertir las ~348 ocultas en una lista ORDENADA por tractabilidad, SIN mutar nada.
//   Para cada pregunta needs_human:
//     1. Recupera la MEJOR sugerencia de artículo correcto (fila AVR hermana con texto útil; la fila
//        'mislink_review' solo oculta, el diagnóstico real está en haiku_batch/recheck/audit…).
//     2. Parsea (ley, nº artículo) de la sugerencia en texto libre (best-effort, patrones comunes).
//     3. Resuelve contra BD: ¿existe esa ley? ¿ese artículo?  → clasifica:
//         RESOLVABLE   (ley+art en BD)        → candidata a RELINK (aún requiere verificación humana/fuente)
//         LEY_SIN_ART  (ley en BD, art no)    → importar el artículo
//         SIN_LEY      (ley no en BD)         → importar norma / posible out-of-scope
//         SIN_PARSEAR  (no se extrae ley/art) → revisión manual
//   NO relinkea ni aplica: es medición. El relink real va con verificación contra fuente (§ pipeline v2.1).
//
// Uso: node scripts/impugnaciones/triaje-drenaje-mislink.cjs [--out f.json] [--dump-resolvable]
const fs = require('fs');
const path = require('path');
const pg = (() => { try { return require('postgres'); } catch { return require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres')); } })();
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

// Códigos → fragmento distintivo para localizar la ley en BD (short_name/name).
const CODE_HINT = {
  CE: 'Constituci', CP: 'digo Penal', CC: 'digo Civil', TREBEP: 'Estatuto B', EBEP: 'Estatuto B',
  LEC: 'Enjuiciamiento Civil', LECrim: 'Enjuiciamiento Criminal', LOPJ: 'Poder Judicial',
  TFUE: 'Funcionamiento de la Uni', TUE: 'de la Uni', LBRL: 'Bases del R',
};
// Extrae {artNum, leyRef} de una sugerencia en texto libre. Devuelve el primer match razonable.
function parseSug(t) {
  if (!t) return null;
  const artM = t.match(/art[íi]?c?u?l?o?\.?\s*(\d{1,4})\s*(bis|ter|qu[aá]ter)?/i);
  const artNum = artM ? (artM[1] + (artM[2] ? ' ' + artM[2].toLowerCase() : '')) : null;
  // ley: N/AAAA, o RD/Decreto N/AAAA, o un código conocido
  const num = t.match(/\b(?:RD|Real Decreto|Decreto|Ley|LO|RDL)?\s*\d{1,4}\/\d{4}\b/i);
  let code = null;
  for (const c of Object.keys(CODE_HINT)) { if (new RegExp(`\\b${c}\\b`).test(t)) { code = c; break; } }
  return { artNum, num: num ? num[0].trim() : null, code };
}

(async () => {
  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 4, connect_timeout: 30 });
  const out = { RESOLVABLE: [], LEY_SIN_ART: [], SIN_LEY: [], SIN_PARSEAR: [], SIN_SUGERENCIA: [] };
  try {
    const qs = await sql`
      SELECT DISTINCT q.id::text qid
      FROM ai_verification_results v JOIN questions q ON q.id = v.question_id
      WHERE q.lifecycle_state = 'needs_human'
        AND v.ai_provider IN ('claude_code_mislink_review_2026_07','claude_code_mislink_v1')`;
    for (const { qid } of qs) {
      // mejor sugerencia: fila AVR con correct_article_suggestion no vacío, la más reciente
      const [sug] = await sql`
        SELECT correct_article_suggestion s FROM ai_verification_results
        WHERE question_id = ${qid} AND coalesce(correct_article_suggestion,'') <> '' AND correct_article_suggestion <> '-'
        ORDER BY verified_at DESC NULLS LAST LIMIT 1`;
      if (!sug) { out.SIN_SUGERENCIA.push({ qid }); continue; }
      const p = parseSug(sug.s);
      if (!p || (!p.num && !p.code) || !p.artNum) { out.SIN_PARSEAR.push({ qid, sug: sug.s.slice(0, 80) }); continue; }
      // localizar ley
      let law;
      if (p.num) {
        const n = p.num.match(/\d{1,4}\/\d{4}/)[0];
        [law] = await sql`SELECT id, short_name FROM laws WHERE (short_name ILIKE ${'%'+n+'%'} OR name ILIKE ${'%'+n+'%'}) AND is_active LIMIT 1`;
      }
      if (!law && p.code) {
        const hint = CODE_HINT[p.code];
        [law] = await sql`SELECT id, short_name FROM laws WHERE (short_name ILIKE ${'%'+p.code+'%'} OR name ILIKE ${'%'+hint+'%'}) AND is_active LIMIT 1`;
      }
      if (!law) { out.SIN_LEY.push({ qid, sug: sug.s.slice(0, 80) }); continue; }
      const artN = p.artNum.match(/\d+/)[0];
      const [art] = await sql`SELECT id FROM articles WHERE law_id = ${law.id} AND article_number = ${artN} AND is_active LIMIT 1`;
      if (art) out.RESOLVABLE.push({ qid, law: law.short_name, art: p.artNum, sug: sug.s.slice(0, 70) });
      else out.LEY_SIN_ART.push({ qid, law: law.short_name, art: p.artNum, sug: sug.s.slice(0, 70) });
    }

    console.log('===== TRIAJE needs_human mislink (', qs.length, 'preguntas ) =====');
    for (const k of ['RESOLVABLE', 'LEY_SIN_ART', 'SIN_LEY', 'SIN_PARSEAR', 'SIN_SUGERENCIA'])
      console.log(`  ${k.padEnd(15)} ${out[k].length}`);
    console.log('\n  RESOLVABLE = relink candidato (art destino YA en BD; requiere verificación fuente, NO auto)');
    console.log('  LEY_SIN_ART/SIN_LEY = importar artículo/norma primero.  SIN_PARSEAR/SIN_SUGERENCIA = manual.');

    if (process.argv.includes('--dump-resolvable')) {
      console.log('\n--- RESOLVABLE (primeras 30) ---');
      out.RESOLVABLE.slice(0, 30).forEach(r => console.log(`  ${r.qid.slice(0,8)}  ${r.law} art ${r.art}   « ${r.sug} »`));
    }
    const outFlag = process.argv.indexOf('--out');
    if (outFlag > -1 && process.argv[outFlag+1]) { fs.writeFileSync(process.argv[outFlag+1], JSON.stringify(out, null, 2)); console.log('\n→ escrito', process.argv[outFlag+1]); }
  } finally { await sql.end(); }
})();
