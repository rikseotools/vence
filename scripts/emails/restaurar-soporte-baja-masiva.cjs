#!/usr/bin/env node
// scripts/emails/restaurar-soporte-baja-masiva.cjs
//
// T-373 (cabo de T-369) — devuelve las RESPUESTAS por email a quien nunca pidió perderlas.
//
// ## Qué pasó
//
// Hasta el 31/07/2026 el botón «Desactivar TODOS los emails» de /unsubscribe apagaba
// también `email_soporte_disabled`, que es la puerta de NUESTRA contestación a lo que el
// usuario nos escribe (impugnaciones y soporte) y del aviso de renovación de quien paga.
// Resultado medido: 79 usuarios en ese estado sin haberlo elegido, frente a 1 solo que lo
// eligió de verdad marcando su categoría. Entre los 79, 3 personas tienen 27 respuestas
// escritas que nunca les llegaron.
//
// El código ya está arreglado (la baja masiva solo lo apaga si se marca la casilla), pero
// arreglar el código no deshace el estado que dejó: eso es lo que hace este script.
//
// ## A quién toca, y por qué ese criterio y no otro
//
// Solo a quien tiene la FIRMA del botón rojo: `email_soporte_disabled = true` **Y**
// `unsubscribed_all = true`. Quien lo eligió por la categoría «Soporte y transaccional»
// tiene `unsubscribed_all = false` y NO se toca — su preferencia es real y es suya.
//
// NO les reactiva nada más: `unsubscribed_all` y la newsletter se quedan como están. Se
// dieron de baja de la publicidad y siguen de baja de la publicidad. Lo único que se
// devuelve es la respuesta a lo que ellos mismos escriban.
//
// ## Uso
//
//   DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/emails/restaurar-soporte-baja-masiva.cjs
//   DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/emails/restaurar-soporte-baja-masiva.cjs --apply
//
// (sin `--apply` es dry-run y no escribe nada)
//
// Antes de escribir vuelca el estado previo a un JSON con marca de tiempo: revertir es
// releer ese fichero. Un cambio de preferencias sobre 79 personas reales no se hace sin
// poder deshacerlo.

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const APLICAR = process.argv.includes('--apply')

// La firma del botón rojo. Es UNA sola condición y vive aquí, no repartida por el script:
// si mañana cambia el criterio, cambia en un sitio.
const FIRMA_BOTON_ROJO = `email_soporte_disabled = true AND unsubscribed_all = true`

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    const { rows: afectados } = await client.query(`
      SELECT ep.user_id,
             up.email,
             ep.unsubscribed_at,
             (SELECT count(*) FROM question_disputes d
               WHERE d.user_id = ep.user_id
                 AND d.admin_response IS NOT NULL AND d.admin_response <> ''
                 AND d.resolved_at > ep.unsubscribed_at) AS respuestas_perdidas
      FROM email_preferences ep
      JOIN user_profiles up ON up.id = ep.user_id
      WHERE ${FIRMA_BOTON_ROJO}
      ORDER BY respuestas_perdidas DESC, ep.unsubscribed_at DESC`)

    // Contraste obligatorio: quien SÍ lo eligió. Si este número se mueve, el criterio
    // está mal y estaríamos pisando una preferencia real.
    const { rows: [eligieron] } = await client.query(`
      SELECT count(*)::int AS n FROM email_preferences
      WHERE email_soporte_disabled = true AND unsubscribed_all = false`)

    const conPerdidas = afectados.filter((a) => Number(a.respuestas_perdidas) > 0)

    console.log(`\n${APLICAR ? '🔴 APLICANDO' : '🔍 DRY-RUN (no escribe nada)'}\n`)
    console.log(`  A restaurar (firma del botón rojo): ${afectados.length}`)
    console.log(`  De ellos, con respuestas que nunca les llegaron: ${conPerdidas.length}`)
    console.log(`  INTACTOS — eligieron la categoría 'soporte' a propósito: ${eligieron.n}\n`)

    if (conPerdidas.length > 0) {
      console.log('  Los que se quedaron sin contestación:')
      for (const a of conPerdidas) {
        console.log(`    · ${a.email} — ${a.respuestas_perdidas} respuesta(s) sin entregar`)
      }
      console.log('')
    }

    if (afectados.length === 0) {
      console.log('  Nada que hacer.\n')
      return
    }

    if (!APLICAR) {
      console.log('  Para escribir:  node scripts/emails/restaurar-soporte-baja-masiva.cjs --apply\n')
      return
    }

    // Copia de seguridad ANTES de tocar nada.
    //
    // FUERA DEL REPO a propósito, y por dos motivos que se contradicen si se elige mal:
    // lleva 79 correos de personas reales (no puede acabar en git, y `scratchpad/` NO
    // está ignorado), pero tampoco puede vivir en un fichero ignorado dentro del worktree
    // — al borrar el worktree se perdería, que es exactamente la lección del 20/07 con
    // los `out-NN.json`. En el home sobrevive a las dos cosas.
    const dir = path.join(require('os').homedir(), 'vence-backups')
    fs.mkdirSync(dir, { recursive: true })
    const backup = path.join(dir, `t373-estado-previo-${Date.now()}.json`)
    fs.writeFileSync(backup, JSON.stringify(afectados, null, 2))
    console.log(`  💾 Estado previo guardado en ${backup}`)

    const { rowCount } = await client.query(`
      UPDATE email_preferences
      SET email_soporte_disabled = false, updated_at = NOW()
      WHERE ${FIRMA_BOTON_ROJO}`)

    // Verificar el arreglo, no declararlo: se vuelve a preguntar a la BD.
    const { rows: [quedan] } = await client.query(`
      SELECT count(*)::int AS n FROM email_preferences WHERE ${FIRMA_BOTON_ROJO}`)
    const { rows: [intactos] } = await client.query(`
      SELECT count(*)::int AS n FROM email_preferences
      WHERE email_soporte_disabled = true AND unsubscribed_all = false`)

    console.log(`\n  ✅ ${rowCount} fila(s) restauradas`)
    console.log(`  ✅ quedan con la firma del botón rojo: ${quedan.n} (debe ser 0)`)
    console.log(
      `  ${intactos.n === eligieron.n ? '✅' : '❌'} los que lo eligieron siguen intactos: ` +
      `${intactos.n} (antes ${eligieron.n})\n`)

    if (quedan.n !== 0 || intactos.n !== eligieron.n) {
      process.exitCode = 1
    }
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
