#!/usr/bin/env node
/**
 * Drenaje del cluster `scope_titulo_huerfano`: CE Título V (108-116).
 *
 * El Título V ("De las relaciones entre el Gobierno y las Cortes Generales":
 * responsabilidad del Gobierno, interpelaciones, cuestión de confianza, moción de
 * censura, disolución, estados de alarma/excepción/sitio) sale como huérfano en 36
 * oposiciones, con 227 preguntas activas en BD que nadie puede practicar.
 *
 * ADJUDICADO UNA A UNA contra el epígrafe (20/07): solo **3 de las 36** lo piden.
 * Las otras 33 son exclusiones LEGÍTIMAS (sus programas cubren la CE parcialmente:
 * derechos, organización territorial, Cortes-composición…) → NO se tocan. Confirma que
 * el detector es un upper bound ruidoso (~8% de precisión en este cluster).
 *
 *   · administrativo_seguridad_social T7 (97-107) — "El poder ejecutivo. […] Relaciones
 *     entre el Gobierno y las Cortes Generales. Designación, causas de cese y
 *     responsabilidad del Gobierno."                            → 156 usuarios
 *   · administrativo_canarias T4 (97-107) — "El Gobierno de la Nación: composición,
 *     funciones y relaciones con las Cortes Generales."          → 24 usuarios
 *   · administrativo_cantabria T3 (56-107) — enumera los títulos: "[…] De las relaciones
 *     entre el Gobierno y las Cortes Generales (Título V)."      → 13 usuarios
 *
 * Ninguna pregunta se crea ni se borra: se REUSA banco ya en BD ampliando el scope al
 * rango que el epígrafe pide.
 *
 * Uso: node scripts/scope/huecos-ce-titulo-v-apply.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const TIT_V = Array.from({ length: 9 }, (_, i) => String(108 + i)) // 108..116

const TARGETS = [
  { ts: '3073d1c0-d36e-445c-af28-2f304acf44a3', label: 'administrativo_seguridad_social T7' },
  { ts: '9523c185-32f3-4ace-b254-dae6d2f85dfb', label: 'administrativo_canarias T4' },
  { ts: '59dfb30e-1e10-4f51-8067-973ed93bd72d', label: 'administrativo_cantabria T3' },
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
    for (const t of TARGETS) {
      const r = await c.query('SELECT article_numbers FROM topic_scope WHERE id=$1', [t.ts])
      if (!r.rows.length) { console.log(`⚠️  ${t.label}: fila no encontrada — saltada`); continue }
      const cur = r.rows[0].article_numbers || []
      const merged = Array.from(new Set([...cur, ...TIT_V])).sort((a, b) => (+a) - (+b))
      if (merged.length === cur.length) { console.log(`· ${t.label}: ya tenía el Tít.V (idempotente)`); continue }
      console.log(`· ${t.label}: ${cur.length} → ${merged.length} arts (+Título V 108-116)`)
      await c.query('UPDATE topic_scope SET article_numbers=$1 WHERE id=$2', [merged, t.ts])
    }
    if (DRY) { await c.query('ROLLBACK'); console.log('\n--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('\n✅ COMMIT — CE Título V escopado donde el epígrafe lo pide') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main()
