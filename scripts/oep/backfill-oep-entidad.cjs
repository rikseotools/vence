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
function parseOepDecreto(texto) {
  const t = String(texto || '').trim();
  if (!t) return [];
  // separadores de nivel superior; conservar el texto para la etiqueta
  const frags = t.split(/\s*(?:\+|,|;|\by\b)\s*/i).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const frag of frags) {
    // rango "2023-2025" o "2023 a 2025"
    const range = frag.match(/(20\d{2})\s*(?:-|–|\ba\b)\s*(20\d{2})/);
    if (range) {
      const a = +range[1], b = +range[2];
      if (b >= a && b - a <= 8) {
        for (let y = a; y <= b; y++) out.push({ año: y, decreto: `${frag} (${y})`.replace(/\s+/g, ' '), ambito: ambitoDe(frag) });
        continue;
      }
    }
    // años sueltos en el fragmento
    const years = (frag.match(/20\d{2}/g) || []).map(Number);
    if (!years.length) continue;
    // etiqueta de decreto = el fragmento tal cual (recortado); año = el más representativo
    // (si hay "Decreto 12/2026 (OEP 2026)" el año es 2026; si "RD 625/2023" → 2023)
    const año = years[years.length - 1]; // el último suele ser el año del decreto citado
    out.push({ año, decreto: frag.replace(/\s+/g, ' ').slice(0, 200), ambito: ambitoDe(frag) });
  }
  // dedup por (año, decreto normalizado)
  const seen = new Set();
  return out.filter((o) => { const k = `${o.año}|${o.decreto.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function ambitoDe(frag) {
  if (/\b(RD|RDL|real decreto)\b/i.test(frag)) return 'estatal';
  if (/\bdecreto\b/i.test(frag)) return 'autonomico';
  return null;
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
        const ins = await c.query(`
          INSERT INTO oep (oposicion_id, "año_oep", decreto, fecha, ambito, plazas_libres,
            plazas_discapacidad, plazas_promocion_interna, estado)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (oposicion_id, "año_oep", COALESCE(decreto,'')) DO UPDATE
            SET estado = CASE WHEN oep.estado='aprobada' THEN EXCLUDED.estado ELSE oep.estado END,
                fecha  = COALESCE(oep.fecha, EXCLUDED.fecha),
                updated_at = now()
          RETURNING id`,
          [r.oposicion_id, o.año, o.decreto, unica ? r.oep_fecha : null, o.ambito,
           unica ? r.plazas_libres : null, unica ? r.plazas_discapacidad : null,
           unica ? r.plazas_promocion_interna : null, estado]);
        const oepId = ins.rows[0].id;
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
