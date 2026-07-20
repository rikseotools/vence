#!/usr/bin/env node
/**
 * Fix scope↔epígrafe de auxiliar_administrativo_madrid (verificación 20/07).
 *
 * Pipeline de 2 agentes independientes (analista+escéptico) sobre el dump de scope.
 * Consenso → 12 correct, 3 issues (ambos), 6 needs_human (discrepan). Este script
 * aplica los 4 fixes ACCIONABLES verificados contra la estructura de la ley; el resto
 * de discrepancias quedan needs_human (juicio humano / cobertura a generar).
 *
 *   T4  «Las fuentes del ordenamiento jurídico»
 *        → QUITAR Ley 40/2015 entera (arts 1,12-15,25-31,37,128-129 = competencia de
 *          órganos, potestad sancionadora y fundaciones del sector público: NADA es
 *          "fuentes del ordenamiento"). 126 preg off-programa (Madrid no tiene tema de
 *          potestad sancionadora ni de órganos → no se orfanan de ningún tema legítimo;
 *          las preguntas siguen en BD para las oposiciones que sí escopan esos arts).
 *          Reglamentos ya cubiertos por Ley 39/2015 128-133 (escopada, correcta).
 *
 *   T9  «Los contratos en el Sector Público … Procedimientos de contratación y formas
 *        de adjudicación: Aspectos principales»
 *        → AÑADIR arts 131-187 de Ley 9/2017 (Cap. de la adjudicación de los contratos:
 *          normas generales 131-155, abierto 156-159, restringido 160-165, negociado
 *          166-171, diálogo competitivo 172-176, asociación innovación 177-182,
 *          concursos de proyectos 183-187). El epígrafe los pide EXPLÍCITAMENTE y el
 *          banco ya existe → reuso. Antes solo 1-35 (elementos + tipos).
 *
 *   T10 «… Derechos, deberes e incompatibilidades …»
 *        → AÑADIR Ley 53/1984 (Incompatibilidades del Personal al Servicio de las AAPP,
 *          estatal, aplicable a las CCAA). El epígrafe pide "incompatibilidades" y ni
 *          TREBEP ni la Ley 1/1986 CM FP tienen articulado de incompatibilidades en BD.
 *          49 preg reusables (arts con banco).
 *
 *   T14 «Información administrativa y Administración electrónica»
 *        → QUITAR RD 829/2023 (solo art.15 "Ministerio de Cultura", mal vinculado,
 *          0 preguntas activas: materia ajena al tema).
 *
 * Uso:  node scripts/scope/madrid-aux-admin-scope-fix.cjs [--dry-run]
 * BD:   RDS prod (DATABASE_URL de .env.local). Idempotente y transaccional.
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const PT = 'auxiliar_administrativo_madrid'

// IDs verificados en BD (20/07)
const TS_T4_LEY40 = '3a6f2972-30c0-4efa-ad52-34adeb1f45ba' // Ley 40/2015 en T4 (a borrar)
const TS_T9_LEY9 = '167332dd-170a-451d-9e1a-12f05455be5b'  // Ley 9/2017 en T9 (a ampliar)
const TS_T14_RD829 = '7d99d9c3-e22d-4b42-a2c1-0ee38f65087f' // RD 829/2023 en T14 (a borrar)
const TOPIC_T10 = 'ab2a1111-d221-4523-8f11-faffbaca2edd'
const LAW_LEY53 = 'f6f4da4d-845f-45d0-b69f-3554524e23e7'   // Ley 53/1984

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i))
const T9_NEW = [...range(1, 35), ...range(131, 187)]
const T10_LEY53_ARTS = ['2', '3', '4', '5', '7', '8', '9', '10', '11', '12', '13', '14', '16', '18', '19', '20']

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')

    // --- T4: borrar Ley 40/2015 (off-fuentes) ---
    const t4 = await c.query('SELECT article_numbers FROM topic_scope WHERE id=$1', [TS_T4_LEY40])
    if (t4.rows.length) {
      console.log(`T4  · Ley 40/2015 arts=[${t4.rows[0].article_numbers.join(',')}] → DELETE`)
      await c.query('DELETE FROM topic_scope WHERE id=$1', [TS_T4_LEY40])
    } else console.log('T4  · Ley 40/2015 ya no está (ok, idempotente)')

    // --- T9: ampliar Ley 9/2017 con 131-187 ---
    const t9 = await c.query('SELECT article_numbers FROM topic_scope WHERE id=$1', [TS_T9_LEY9])
    if (t9.rows.length) {
      const cur = t9.rows[0].article_numbers || []
      const merged = Array.from(new Set([...cur, ...T9_NEW])).sort((a, b) => (+a) - (+b))
      console.log(`T9  · Ley 9/2017 ${cur.length} arts → ${merged.length} arts (+adjudicación 131-187)`)
      await c.query('UPDATE topic_scope SET article_numbers=$1 WHERE id=$2', [merged, TS_T9_LEY9])
    } else throw new Error('No existe la fila Ley 9/2017 en T9 — abortando')

    // --- T10: añadir Ley 53/1984 (incompatibilidades) ---
    const exists = await c.query('SELECT id FROM topic_scope WHERE topic_id=$1 AND law_id=$2', [TOPIC_T10, LAW_LEY53])
    if (exists.rows.length) {
      console.log('T10 · Ley 53/1984 ya escopada (ok, idempotente)')
    } else {
      console.log(`T10 · INSERT Ley 53/1984 arts=[${T10_LEY53_ARTS.join(',')}] (49 preg reusadas)`)
      await c.query(
        'INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES ($1,$2,$3,1.0)',
        [TOPIC_T10, LAW_LEY53, T10_LEY53_ARTS]
      )
    }

    // --- T14: borrar RD 829/2023 (stray, 0 preg) ---
    const t14 = await c.query('SELECT article_numbers FROM topic_scope WHERE id=$1', [TS_T14_RD829])
    if (t14.rows.length) {
      console.log(`T14 · RD 829/2023 arts=[${t14.rows[0].article_numbers.join(',')}] → DELETE`)
      await c.query('DELETE FROM topic_scope WHERE id=$1', [TS_T14_RD829])
    } else console.log('T14 · RD 829/2023 ya no está (ok, idempotente)')

    if (DRY) {
      await c.query('ROLLBACK')
      console.log('\n--dry-run → ROLLBACK (nada persistido)')
    } else {
      await c.query('COMMIT')
      console.log('\n✅ COMMIT — scope de Madrid actualizado')
    }
  } catch (e) {
    await c.query('ROLLBACK')
    console.error('❌ ROLLBACK:', e.message)
    process.exitCode = 1
  } finally {
    await c.end()
  }
}
main()
