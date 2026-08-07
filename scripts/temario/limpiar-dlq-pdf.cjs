#!/usr/bin/env node
/**
 * scripts/temario/limpiar-dlq-pdf.cjs — retira de la DLQ de PDFs los fallos de un defecto YA
 * ARREGLADO, con la prueba delante. (T-648)
 *
 * ── POR QUÉ HACE FALTA UNA HERRAMIENTA Y NO UN `DELETE` A MANO ───────────────────────────────
 * Borrar filas de producción «porque ya no valen» es exactamente como se pierde algo que sí valía.
 * Este script **no borra por antigüedad ni por motivo**: exige que se cumpla la única condición
 * que hace inofensivo el borrado — **que el defecto haya dejado de producirse**. Si aparece UN
 * solo fallo de ese motivo posterior a la fecha del arreglo, aborta: significa que el defecto
 * sigue vivo y esas filas son una avería, no un cadáver.
 *
 * ── EL CASO QUE LO ESTRENA ───────────────────────────────────────────────────────────────────
 * 112 jobs con `oposicion_desconocida`, del 31/07 al 06/08, del defecto que [T-648] arregló hoy.
 * **Cero desde el arreglo** — comprobado antes de tocar nada. Mientras estén ahí, el canario de la
 * cola denuncia cada 15 minutos una avería que ya no existe, y un canario así se aprende a
 * ignorar.
 *
 * NO toca los `tema_no_encontrado`: esos son el fallo legítimo de una personalizada sin temas y
 * siguen siendo una señal real. Para que no paginen está `lib/temario/pdf/dlqTriage.cjs`, que es
 * otra cosa: no se borran, se dejan de gritar.
 *
 * Uso:
 *   node scripts/temario/limpiar-dlq-pdf.cjs --motivo oposicion_desconocida --desde "2026-08-07 17:00"
 *   … --aplicar     (sin esto, solo cuenta y enseña)
 */
'use strict'
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null }
const APLICAR = process.argv.includes('--aplicar')
const MOTIVO = arg('--motivo')
const DESDE = arg('--desde')

async function main() {
  if (!MOTIVO || !DESDE) {
    console.error('Uso: --motivo <texto del last_error> --desde "<fecha del arreglo>" [--aplicar]')
    process.exit(2)
  }
  const c = new Client(pgConfig())
  await c.connect()

  const like = `%${MOTIVO}%`
  const { rows: [antes] } = await c.query(
    `SELECT count(*)::int n, min(updated_at) primero, max(updated_at) ultimo
       FROM temario_pdf_jobs WHERE status='failed' AND last_error LIKE $1 AND updated_at <= $2`,
    [like, DESDE])
  const { rows: [despues] } = await c.query(
    `SELECT count(*)::int n, max(updated_at) ultimo
       FROM temario_pdf_jobs WHERE status='failed' AND last_error LIKE $1 AND updated_at > $2`,
    [like, DESDE])

  console.log(`\n🧹 DLQ de PDFs — motivo «${MOTIVO}», arreglo declarado el ${DESDE}\n`)
  console.log(`   candidatos (anteriores al arreglo): ${antes.n}`)
  if (antes.n) console.log(`     de ${String(antes.primero).slice(4, 21)} a ${String(antes.ultimo).slice(4, 21)}`)
  console.log(`   POSTERIORES al arreglo:             ${despues.n}`)

  // ── LA PUERTA: si el defecto sigue produciéndose, esto NO es limpieza ──────────────────────
  if (despues.n > 0) {
    console.error(
      `\n❌ ABORTADO: hay ${despues.n} fallo(s) de «${MOTIVO}» DESPUÉS del arreglo ` +
      `(el último, ${String(despues.ultimo).slice(4, 21)}).\n` +
      '   El defecto sigue vivo, así que estas filas son una avería y no cadáveres.\n' +
      '   Arréglalo antes de limpiar; si no, borrarías la única prueba de que sigue pasando.\n')
    await c.end()
    process.exit(1)
  }
  if (antes.n === 0) { console.log('\n✅ nada que limpiar.\n'); await c.end(); return }

  if (!APLICAR) {
    const { rows } = await c.query(
      `SELECT oposicion, tema, updated_at FROM temario_pdf_jobs
        WHERE status='failed' AND last_error LIKE $1 AND updated_at <= $2
        ORDER BY updated_at LIMIT 5`, [like, DESDE])
    console.log('\n   muestra de lo que se retiraría:')
    rows.forEach((r) => console.log(`     ${String(r.oposicion).slice(0, 40)} T${r.tema}  ${String(r.updated_at).slice(4, 21)}`))
    console.log('\n(simulación: nada borrado — repite con --aplicar)\n')
    await c.end()
    return
  }

  const r = await c.query(
    `DELETE FROM temario_pdf_jobs
      WHERE status='failed' AND last_error LIKE $1 AND updated_at <= $2`, [like, DESDE])
  console.log(`\n   🗑️  retiradas ${r.rowCount} fila(s).`)

  const { rows: [queda] } = await c.query(
    `SELECT count(*)::int n FROM temario_pdf_jobs WHERE status='failed'`)
  console.log(`   quedan ${queda.n} fallido(s) en la cola (los que sí significan algo).\n`)
  await c.end()
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
