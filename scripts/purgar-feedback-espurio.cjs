#!/usr/bin/env node
/**
 * scripts/purgar-feedback-espurio.cjs — borra apuntes de `cancellation_feedback` que NO los
 * escribió la persona, dejando el respaldo y el rastro dentro de la propia base de datos.
 *
 * ## Por qué existe (T-340, 30-31/07/2026)
 *
 * Durante una suplantación de **solo lectura**, un clic en «Reactivar suscripción» se ejecutó
 * de verdad sobre la cuenta de una usuaria. No hubo daño en facturación (se reactivó y se
 * volvió a cancelar en 37 segundos), pero dejó **3 apuntes en su historial visible** que no
 * son suyos: dos `reactivated` y un `pending_feedback`. Ella los ve al entrar en su cuenta.
 *
 * ## Por qué un script y no un DELETE a mano
 *
 * Borrar filas de producción a pelo no deja ni respaldo ni explicación: si mañana alguien
 * pregunta por qué faltan tres apuntes, no hay respuesta. Aquí:
 *
 *   1. El criterio es EXPLÍCITO (persona + ventana + motivos), y se imprime antes de tocar nada.
 *   2. Las filas completas se guardan en `observable_events` (`dato_espurio_purgado`) ANTES
 *      de borrarlas, en la MISMA transacción. Si el respaldo falla, no se borra.
 *   3. El borrado es por id, nunca por criterio: lo que se enseña es exactamente lo que cae.
 *
 * Reconstruir una fila borrada = leer su evento de purga. Por eso el respaldo va a la BD y no
 * a un fichero suelto, que se pierde con el primer reinicio.
 *
 * ## Uso
 *
 *   node scripts/purgar-feedback-espurio.cjs                  # DRY-RUN: enseña y no toca
 *   node scripts/purgar-feedback-espurio.cjs --apply
 *
 * NUNCA ampliar la ventana «por si acaso»: la fila legítima de esa misma usuaria (su baja
 * real de febrero) está a un mes de distancia y no se toca.
 */
const postgres = require('postgres')

// El caso concreto para el que se escribió. Si aparece otro, se añade aquí con su motivo:
// un criterio en la línea de comandos invita a borrar de más.
const CASOS = [
  {
    email: 'daluamva@gmail.com',
    desde: '2026-07-30T21:15:00Z',
    hasta: '2026-07-30T21:45:00Z',
    motivos: ['reactivated', 'pending_feedback'],
    porQue:
      'clic de «Reactivar» ejecutado durante una suplantación de solo lectura (T-340). ' +
      'La usuaria no pulsó nada: los apuntes son de la sesión del admin.',
  },
]

async function main() {
  const aplicar = process.argv.includes('--apply')
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Falta DATABASE_URL')
    process.exit(2)
  }
  const sql = postgres(url, { ssl: 'require' })
  let total = 0

  try {
    for (const caso of CASOS) {
      const [persona] = await sql`SELECT id, email FROM user_profiles WHERE email = ${caso.email}`
      if (!persona) {
        console.log(`⚠️  ${caso.email}: no existe, se salta`)
        continue
      }

      const filas = await sql`
        SELECT * FROM cancellation_feedback
         WHERE user_id = ${persona.id}
           AND created_at >= ${caso.desde} AND created_at <= ${caso.hasta}
           AND reason = ANY(${caso.motivos})
         ORDER BY created_at
      `
      // Contraste obligatorio: enseñar SIEMPRE lo que se conserva. Sin esto, un criterio
      // demasiado ancho se lee igual que uno correcto.
      const conserva = await sql`
        SELECT id, created_at, reason FROM cancellation_feedback
         WHERE user_id = ${persona.id}
           AND NOT (created_at >= ${caso.desde} AND created_at <= ${caso.hasta} AND reason = ANY(${caso.motivos}))
         ORDER BY created_at
      `

      console.log(`\n── ${caso.email} (${persona.id})`)
      console.log(`   motivo: ${caso.porQue}`)
      console.log(`   A BORRAR (${filas.length}):`)
      for (const f of filas) console.log(`     · ${f.created_at.toISOString()} | ${f.reason} | ${f.id}`)
      console.log(`   SE CONSERVA (${conserva.length}):`)
      for (const f of conserva) console.log(`     · ${f.created_at.toISOString()} | ${f.reason} | ${f.id}`)

      if (!filas.length) continue
      if (!aplicar) {
        console.log('   (dry-run — nada tocado; añade --apply)')
        total += filas.length
        continue
      }

      const ids = filas.map((f) => f.id)
      await sql.begin(async (tx) => {
        // El respaldo va PRIMERO y en la misma transacción: si esto falla, no se borra nada.
        await tx`
          INSERT INTO observable_events (source, severity, event_type, endpoint, user_id, metadata)
          VALUES ('fargate', 'info', 'dato_espurio_purgado', '/scripts/purgar-feedback-espurio',
                  ${persona.id}, ${tx.json({
                    tabla: 'cancellation_feedback',
                    porQue: caso.porQue,
                    tarea: 'T-340',
                    filas,
                  })})
        `
        await tx`DELETE FROM cancellation_feedback WHERE id = ANY(${ids})`
      })
      console.log(`   ✅ ${filas.length} purgadas (respaldo en observable_events → dato_espurio_purgado)`)
      total += filas.length
    }

    console.log(
      aplicar
        ? `\n✅ ${total} fila(s) purgada(s). Para reconstruirlas: SELECT metadata FROM observable_events WHERE event_type='dato_espurio_purgado';`
        : `\n${total} fila(s) se purgarían. Repite con --apply.`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
