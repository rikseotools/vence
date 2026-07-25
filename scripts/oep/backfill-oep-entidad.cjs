#!/usr/bin/env node
'use strict';
// backfill-oep-entidad.cjs — F1 de T-108: puebla la entidad `oep` + puente `convocatoria_oep`
// a partir del texto libre `convocatorias.oep_decreto` (+ `oep_fecha`, plazas). NO borra nada
// (aditivo, idempotente por la identidad natural de `oep`). Uso: node ... [--apply]
//
// Parseo: parte el string por separadores de nivel superior (+, ',', ' y '), expande rangos
// "YYYY-YYYY", y de cada fragmento extrae año + etiqueta de decreto + ámbito heurístico.

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── parser PURO ────────────────────────────────────────────────────────────────────────────────
// EXTRACCIÓN POR PATRÓN (no split por comas): busca las OEP dentro del texto, así los strings
// complejos con fechas/paréntesis/"|" ("Decreto 211/2025, de 23 de diciembre — OEP 2025 (BOJA…)")
// dan UNA fila, no una por fragmento. Dedup por AÑO (prefiere el decreto numerado), orden documental.
function ambitoDe(frag) {
  if (/\b(RD|RDL|real decreto)\b/i.test(frag)) return 'estatal';
  if (/\bdecreto\b/i.test(frag)) return 'autonomico';
  return null;
}

function parseOepDecreto(texto) {
  const t = String(texto || '');
  if (!t.trim()) return [];
  const matches = []; // {pos, año, decreto, ambito, numbered}
  let m;
  // 1) decretos CON número: RD/RDL/Real Decreto/Decreto/Orden N/AAAA (el AAAA es el año de la OEP)
  const reDec = /\b(RD|RDL|Real\s+Decreto|Decreto|Orden)\s*\.?\s*(\d+)\s*\/\s*(20\d{2})\b/gi;
  while ((m = reDec.exec(t))) {
    const kw = m[1].replace(/\s+/g, ' ');
    matches.push({ pos: m.index, año: +m[3], decreto: `${/real/i.test(kw) ? 'Real Decreto' : kw} ${m[2]}/${m[3]}`, ambito: /^(RD|RDL|real)/i.test(kw) ? 'estatal' : 'autonomico', numbered: true });
  }
  // 2) OEP/OPE/OPS seguido de año(s) o rango: "OEP 2024", "OEP 2022 y 2023", "OEP 2023-2025", "OPE 2022 + 2023"
  const reOep = /\b(OEP|OPE|OPS)\s+(20\d{2}(?:\s*(?:[-–\/]|\ba\b|\by\b|,|\+)\s*20\d{2})*)/gi;
  while ((m = reOep.exec(t))) {
    for (const y of expandYears(m[2])) matches.push({ pos: m.index, año: y, decreto: `OEP ${y}`, ambito: null, numbered: false });
  }
  // 3) fallback: contexto OEP pero el año NO va pegado al keyword ("OEP SCS 2025", "oferta de empleo … 2025").
  //    Solo si 1&2 no pillaron nada; extrae los años del string SIN partir (evita re-introducir el sobre-split).
  if (!matches.length && /\b(OEP|OPE|OPS|oferta de empleo)\b/i.test(t)) {
    for (const y of [...new Set((t.match(/20\d{2}/g) || []).map(Number))]) {
      matches.push({ pos: t.indexOf(String(y)), año: y, decreto: t.replace(/\s+/g, ' ').trim().slice(0, 120), ambito: ambitoDe(t), numbered: false });
    }
  }
  if (!matches.length) return [];
  matches.sort((a, b) => a.pos - b.pos);
  const best = new Map(); const firstPos = new Map();
  for (const mt of matches) {
    if (!firstPos.has(mt.año)) firstPos.set(mt.año, mt.pos);
    const cur = best.get(mt.año);
    if (!cur || (mt.numbered && !cur.numbered)) best.set(mt.año, mt);
  }
  return [...best.values()]
    .sort((a, b) => firstPos.get(a.año) - firstPos.get(b.año))
    .map((e) => ({ año: e.año, decreto: e.decreto.replace(/\s+/g, ' ').trim().slice(0, 120), ambito: e.ambito }));
}

// Expande una lista/rango de años: "2022 y 2023"→[2022,2023]; "2023-2025"→[2023,2024,2025].
function expandYears(str) {
  const nums = [...new Set((str.match(/20\d{2}/g) || []).map(Number))];
  const range = str.match(/(20\d{2})\s*(?:[-–]|\ba\b)\s*(20\d{2})/);
  if (range) {
    const a = +range[1], b = +range[2];
    if (b >= a && b - a <= 8) { const out = []; for (let y = a; y <= b; y++) out.push(y); return [...new Set([...out, ...nums])].sort(); }
  }
  return nums;
}

module.exports = { parseOepDecreto, ambitoDe };

// ── backfill ─────────────────────────────────────────────────────────────────────────────────
async function main() {
  const DRY = !process.argv.includes('--apply');
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const { rows } = await c.query(`
      SELECT cv.id AS convocatoria_id, cv.oposicion_id, cv.oep_decreto, cv.oep_fecha,
             cv.plazas_libres, cv.plazas_discapacidad, cv.plazas_promocion_interna, cv.estado_proceso
      FROM convocatorias cv
      WHERE cv.oep_decreto IS NOT NULL AND btrim(cv.oep_decreto) <> ''`);
    const convocada = new Set(['convocada','inscripcion_abierta','inscripcion_cerrada','lista_admitidos','pendiente_examen','examen_realizado','resultados','nombramientos']);
    let oepCreadas = 0, links = 0, filas = 0, multi = 0;
    for (const r of rows) {
      const oeps = parseOepDecreto(r.oep_decreto);
      if (!oeps.length) continue;
      filas++;
      if (oeps.length > 1) multi++;
      const estado = convocada.has(r.estado_proceso) ? 'convocada' : 'aprobada';
      // si el decreto es una sola OEP, hereda fecha+plazas de la convocatoria; si son varias, no
      // atribuimos plazas por OEP (no consta el reparto) → quedan en la convocatoria.
      const unica = oeps.length === 1;
      for (const o of oeps) {
        if (DRY) { oepCreadas++; links++; continue; }
        // find-or-insert por (oposición, año): UNA OEP por oposición+año (no duplicar la misma OEP
        // referenciada de dos formas en dos convocatorias). El decreto NUMERADO gana al "OEP AAAA".
        const isNum = /\d+\s*\/\s*\d{4}/.test(o.decreto || '');
        const ex = await c.query(
          `SELECT id, (decreto ~ '\\d+\\s*/\\s*\\d{4}') AS numbered FROM oep WHERE oposicion_id=$1 AND "año_oep"=$2 LIMIT 1`,
          [r.oposicion_id, o.año]);
        let oepId;
        if (ex.rows.length) {
          oepId = ex.rows[0].id;
          await c.query(`
            UPDATE oep SET
              decreto = CASE WHEN $2 AND NOT $3 THEN $4 ELSE decreto END,
              ambito  = COALESCE(ambito, $5),
              fecha   = COALESCE(fecha, $6),
              plazas_libres            = COALESCE(plazas_libres, $7),
              plazas_discapacidad      = COALESCE(plazas_discapacidad, $8),
              plazas_promocion_interna = COALESCE(plazas_promocion_interna, $9),
              estado  = CASE WHEN estado='aprobada' THEN $10 ELSE estado END
            WHERE id=$1`,
            [oepId, isNum, ex.rows[0].numbered, o.decreto, o.ambito,
             unica ? r.oep_fecha : null, unica ? r.plazas_libres : null,
             unica ? r.plazas_discapacidad : null, unica ? r.plazas_promocion_interna : null, estado]);
        } else {
          const ins = await c.query(`
            INSERT INTO oep (oposicion_id, "año_oep", decreto, fecha, ambito, plazas_libres,
              plazas_discapacidad, plazas_promocion_interna, estado)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [r.oposicion_id, o.año, o.decreto, unica ? r.oep_fecha : null, o.ambito,
             unica ? r.plazas_libres : null, unica ? r.plazas_discapacidad : null,
             unica ? r.plazas_promocion_interna : null, estado]);
          oepId = ins.rows[0].id;
        }
        oepCreadas++;
        const lk = await c.query(`
          INSERT INTO convocatoria_oep (convocatoria_id, oep_id, plazas_aportadas)
          VALUES ($1,$2,$3) ON CONFLICT (convocatoria_id, oep_id) DO NOTHING`,
          [r.convocatoria_id, oepId, unica ? r.plazas_libres : null]);
        links += lk.rowCount;
      }
    }
    console.log(`${DRY ? 'DRY-RUN' : 'APLICADO'}: ${filas} convocatorias con OEP (${multi} multi-OEP) → ${oepCreadas} filas oep, ${links} enlaces convocatoria_oep`);
    if (DRY) {
      console.log('\nMuestra de parseo:');
      for (const r of rows.slice(0, 6)) {
        const p = parseOepDecreto(r.oep_decreto);
        console.log(`  "${(r.oep_decreto||'').slice(0,60)}" → ${p.map(x => `${x.año}[${x.ambito||'?'}]`).join(' · ')}`);
      }
    }
  } finally { await c.end(); }
}

if (require.main === module) main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
