#!/usr/bin/env node
/**
 * Drenaje de títulos huérfanos — LOTE 2 (clusters CE Tít.II/III/VI/IX y EBEP Tít.IV).
 *
 * Cada fila adjudicada UNA A UNA contra su epígrafe (`adjudica-cluster-huerfano.cjs` +
 * revisión humana). Se añade SOLO el título que el epígrafe nombra; nunca el cluster en
 * bloque. Se reusa banco ya en BD: no se crea ni se borra ninguna pregunta.
 *
 * Rechazados en este lote (para que no se re-intenten):
 *  · Ley 40/2015 Tít.I (AGE, 19 opos) → 0 reales: los candidatos piden "órganos
 *    administrativos / colegiados" (arts 5-22) o administración autonómica, no la AGE.
 *  · CE Tít.IV (21 opos) → 0 reales: el único casaba el Reglamento Orgánico del Gobierno
 *    del AYUNTAMIENTO de Madrid, no el Título IV de la CE.
 *  · EBEP Tít.IV en oposiciones cuyo tema cuelga de su ley autonómica (Andalucía 5/2023,
 *    Extremadura 13/2015, Murcia 1/2001, Estatuto Marco 55/2003): esa materia la cubre su
 *    propia norma. Discriminador: el tema debe ESCOPAR ya RDL 5/2015.
 *  · Falsos positivos de patrón cazados a mano: un tema de CARDIOLOGÍA casó "corona"
 *    (síndrome coronario); "El Poder Judicial EN ANDALUCÍA" es el Estatuto andaluz.
 *
 * Uso: node scripts/scope/huecos-clusters-lote2-apply.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const R = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i))

const TARGETS = [
  // ── CE ──
  { ts: 'da6b70fe-f995-429f-a2e2-1a4f63497c92', add: R(66, 96),
    label: 'auxiliar_administrativo_diputacion_huesca T1 · CE Tít.III Cortes Generales',
    why: 'epígrafe: "Las Cortes Generales: composición, atribuciones y funcionamiento" (ya tenía Corona, Poder Judicial y TC)' },
  { ts: '4b494e87-1c34-444c-9225-3f7ed3700de8', add: R(56, 65),
    label: 'auxiliar_administrativo_ayuntamiento_alcala_henares T1 · CE Tít.II Corona',
    why: 'epígrafe: "…Derechos y deberes fundamentales. Sus garantías. La Corona." — solo Corona; no nombra Cortes/Gobierno/PJ/TC' },
  { ts: '412a9c86-a46b-40a4-b855-8095644cbe2c', add: [...R(117, 127), ...R(159, 165)],
    label: 'administrativo_junta_general_asturias T2 · CE Tít.VI Poder Judicial + Tít.IX TC',
    why: 'epígrafe enumera "la Corona, las Cortes Generales, el Gobierno, el Poder Judicial y el Tribunal Constitucional"; tenía los 3 primeros' },

  // ── EBEP (RDL 5/2015) Título IV: Adquisición y pérdida de la relación de servicio ──
  // Todos escopan ya RDL 5/2015 y su epígrafe pide literalmente "Adquisición y pérdida".
  { ts: '8098f5bd-ffd1-48c9-b5b4-5d951d60ebbf', add: R(55, 68),
    label: 'auxiliar_administrativo_extremadura T3 · EBEP Tít.IV', why: '294 usuarios — "Adquisición y pérdida de la condición de funcionario"' },
  { ts: '926e4971-4d5f-4926-93f6-140e1280d378', add: R(55, 68),
    label: 'auxiliar_administrativo_ayuntamiento_madrid T15 · EBEP Tít.IV', why: '"Adquisición y pérdida de la relación de servicio"' },
  { ts: '8a4ce3ee-80b9-4ecd-ae05-f9720243af3e', add: R(55, 68),
    label: 'auxiliar_administrativo_ayuntamiento_granada T15 · EBEP Tít.IV', why: '"Adquisición y pérdida de la condición de personal funcionario"' },
  { ts: '7cdeeeab-f777-46d6-bd93-4833c7fe9e2c', add: R(55, 68),
    label: 'auxiliar_administrativo_ayuntamiento_alcala_henares T17 · EBEP Tít.IV', why: '"Adquisición y pérdida de la condición de funcionario"' },
  { ts: '2a7a6c02-bd84-48e5-a175-fe87d5184880', add: R(55, 68),
    label: 'auxiliar_administrativo_universidad_huelva T6 · EBEP Tít.IV', why: '"Adquisición y pérdida de la relación de servicio"' },
  { ts: '3441532d-ae02-4565-8ad1-405ffcbc338f', add: R(55, 68),
    label: 'agrupacion_profesional_servicios_publicos_carm T3 · EBEP Tít.IV', why: '"Adquisición y pérdida de la condición de funcionario"' },
]

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    let touched = 0
    for (const t of TARGETS) {
      const r = await c.query('SELECT article_numbers FROM topic_scope WHERE id=$1', [t.ts])
      if (!r.rows.length) { console.log(`⚠️  ${t.label}: fila no encontrada — saltada`); continue }
      const cur = r.rows[0].article_numbers || []
      const merged = Array.from(new Set([...cur, ...t.add])).sort((a, b) => (+a) - (+b))
      if (merged.length === cur.length) { console.log(`· ${t.label}: ya lo tenía (idempotente)`); continue }
      console.log(`· ${t.label}`)
      console.log(`    ${cur.length} → ${merged.length} arts · ${t.why}`)
      await c.query('UPDATE topic_scope SET article_numbers=$1 WHERE id=$2', [merged, t.ts])
      touched++
    }
    if (DRY) { await c.query('ROLLBACK'); console.log(`\n--dry-run → ROLLBACK (${touched} filas cambiarían)`) }
    else { await c.query('COMMIT'); console.log(`\n✅ COMMIT — ${touched} temas ampliados al título que su epígrafe pide`) }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main()
