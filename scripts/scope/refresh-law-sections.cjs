#!/usr/bin/env node
/**
 * refresh-law-sections.cjs — RE-POBLA law_sections con el parser arreglado.
 *
 * El bug de parseBoeSections (sacaba el nº de sección del id, no del label →
 * colapsaba el esquema `tp`/`ti-N` del BOE, fix 24/07) dejó law_sections con
 * estructura MAL para muchas leyes regionales (p.ej. LEC 9 secciones falsas vs 24
 * reales). La tabla la consumen: página /leyes/[law], temario, test-config, SSR
 * CE/L39, PDF. Este script re-deriva la estructura del BOE, la VALIDA (reforzado:
 * sin huecos de título, sin solapes, rangos con artículos reales) y SOLO reemplaza
 * las que difieren Y el nuevo es válido — transaccional (DELETE+INSERT en 1 tx).
 * Las inválidas/iguales/sin-BOE NO se tocan (fail-safe: nunca deja peor que estaba).
 *
 * Uso: node scripts/scope/refresh-law-sections.cjs            (DRY, no escribe)
 *      node scripts/scope/refresh-law-sections.cjs --apply    (aplica)
 */
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });
const { parseBoeSections } = require('../../lib/laws/parseBoeSections');

const APPLY = process.argv.includes('--apply');
const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const boeIdOf = (u) => (String(u || '').match(/BOE-A-\d{4}-\d+/) || [])[0];
const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const titInt = (num) => { const s = String(num || ''); if (/prelim/i.test(s)) return 0; const u = s.toUpperCase().replace(/\.BIS$/, ''); let n = 0; for (let i = 0; i < u.length; i++) { const c = ROMAN[u[i]], nx = ROMAN[u[i + 1]]; if (c == null) return null; n += (nx && c < nx) ? -c : c; } return u.length ? n : null; };

async function estructura(bid, conRubrica) {
  const idx = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/indice`, { headers: { Accept: 'application/xml' } })).text();
  const bl = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)].map((m) => ({ id: m[1].trim(), label: clean(m[2]) }));
  const p = parseBoeSections(bl);
  const out = p.secciones.map((s) => ({ tipo: p.tipo, blockId: s.blockId, num: s.num, from: s.from, to: s.to }));
  if (conRubrica) for (const s of out) { s.rubrica = await rubrica(bid, s.blockId); }
  return out;
}
async function rubrica(bid, blockId) {
  try {
    const body = clean(await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/bloque/${blockId}`, { headers: { Accept: 'application/xml' } })).text());
    const m = body.match(/(?:CAP[IÍ]TULO|T[IÍ]TULO|LIBRO|PARTE)\s+[IVXLCDM]+\.?\s+([^.]{3,140})/i);
    return m ? m[1].trim().replace(/\s+/g, ' ') : null;
  } catch { return null; }
}

// Validación reforzada: rangos con artículos reales + sin solape + (títulos) sin huecos.
async function valida(lawId, secs) {
  if (!secs.length) return 'sin_secciones';
  for (const s of secs) {
    const [{ c }] = await sql`SELECT count(*)::int c FROM articles WHERE law_id=${lawId} AND article_number ~ '^[0-9]+$' AND article_number::int BETWEEN ${s.from} AND ${s.to}`;
    if (c === 0) return `rango_vacio(${s.num}:${s.from}-${s.to})`;
  }
  for (let i = 0; i < secs.length; i++) for (let j = i + 1; j < secs.length; j++) if (secs[i].from <= secs[j].to && secs[j].from <= secs[i].to) return 'solape';
  // Núm de sección duplicado → mismo slug (law_sections_slug_key es único) → INSERT rompería.
  // Señal de parse anómalo (dos "Título I"). Rechazar = fail-safe (se queda la estructura vieja).
  const seen = new Set(); for (const s of secs) { const k = `${s.tipo}:${String(s.num).toLowerCase()}`; if (seen.has(k)) return `num_duplicado(${s.num})`; seen.add(k); }
  if (secs[0].tipo === 'titulo') { const nums = secs.map((s) => titInt(s.num)).filter((n) => n != null).sort((a, b) => a - b); for (let i = 1; i < nums.length; i++) if (nums[i] - nums[i - 1] > 1) return `gap_titulos(${nums.join(',')})`; }
  return 'ok';
}

async function reemplazar(lawId, secs) {
  const tipo = secs[0].tipo;
  const nombreTipo = tipo === 'titulo' ? 'Título' : 'Capítulo';
  return sql.begin(async (tx) => {
    await tx`DELETE FROM law_sections WHERE law_id=${lawId}`;
    let i = 0;
    for (const s of secs) {
      const title = s.rubrica ? `${nombreTipo} ${s.num}. ${s.rubrica}` : `${nombreTipo} ${s.num}`;
      const slug = `${lawId.slice(0, 8)}-${tipo}-${String(s.num).toLowerCase()}`;
      await tx`INSERT INTO law_sections (law_id, section_type, section_number, title, description, article_range_start, article_range_end, slug, order_position, is_active, created_at, updated_at)
        VALUES (${lawId}, ${tipo}, ${s.num}, ${title}, NULL, ${s.from}, ${s.to}, ${slug}, ${++i}, true, now(), now())`;
    }
    return i;
  });
}

(async () => {
  const leyes = await sql`SELECT DISTINCT l.id, l.short_name, l.boe_url FROM laws l JOIN law_sections s ON s.law_id=l.id WHERE l.boe_url ~ 'BOE-A-' ORDER BY l.short_name`;
  console.log(`${leyes.length} leyes con law_sections + BOE · modo ${APPLY ? 'APPLY' : 'DRY'}`);
  const cont = { same: 0, replaced: 0, would_replace: 0, invalid: 0, parse_fail: 0 };
  for (const l of leyes) {
    try {
      const bid = boeIdOf(l.boe_url);
      let secs;
      try { secs = await estructura(bid, false); } catch { cont.parse_fail++; continue; }
      if (!secs.length) { cont.parse_fail++; continue; }
      const v = await valida(l.id, secs);
      if (v !== 'ok') { cont.invalid++; console.log(`  ⚠️  ${l.short_name} — nuevo INVÁLIDO (${v}) → se deja el viejo`); continue; }
      const cur = await sql`SELECT section_number num, article_range_start s, article_range_end e FROM law_sections WHERE law_id=${l.id} ORDER BY article_range_start`;
      const nn = secs.slice().sort((a, b) => a.from - b.from).map((x) => `${x.num}:${x.from}-${x.to}`).join('|');
      const nc = cur.map((x) => `${x.num}:${x.s}-${x.e}`).join('|');
      if (nn === nc) { cont.same++; continue; }
      if (!APPLY) { cont.would_replace++; console.log(`  · ${l.short_name} (${cur.length}→${secs.length} secc)`); continue; }
      const secsR = await estructura(bid, true); // con rúbricas para el title
      const n = await reemplazar(l.id, secsR);
      cont.replaced++; console.log(`  ✅ ${l.short_name} (${cur.length}→${n} secc)`);
    } catch (e) { cont.error = (cont.error || 0) + 1; console.log(`  ✗ ${l.short_name} — ${String(e.message).slice(0, 60)}`); }
  }
  console.log('\nresumen:', JSON.stringify(cont));
  await sql.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
