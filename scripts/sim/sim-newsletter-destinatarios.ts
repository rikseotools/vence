// scripts/sim/sim-newsletter-destinatarios.ts
//
// SIMULACIÓN del filtro de destinatarios de newsletter (T-457) contra la BD REAL.
// Los unitarios fijan el criterio con datos de mentira; esto ejerce el SQL de verdad:
// que `getNewsletterRecipientsByIds` **excluya** a quien se dio de baja o apagó la
// newsletter aunque venga explícitamente en la selección manual del admin.
//
// NO ENVÍA NADA. Solo resuelve destinatarios y compara con lo que dice la BD.
// Es seguro correrlo contra producción: no escribe ni una fila.
//
//   npx tsx --env-file=.env.local scripts/sim/sim-newsletter-destinatarios.ts
import postgres from 'postgres'
import { getNewsletterRecipientsByIds, getBlockedNewsletterUserIds } from '../../lib/api/newsletters'

const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false }, max: 2 })

let fallos = 0
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) fallos++
}

async function main() {
  console.log('🧪 SIM T-457 — filtro de destinatarios en la vía de SELECCIÓN MANUAL\n')

  // 1. Usuarios REALES bloqueados por cada causa (con email: si no lo tienen, se
  //    caerían igual por otro motivo y la prueba no demostraría nada).
  const bajaTotal = await sql<{ user_id: string }[]>`
    SELECT ep.user_id FROM email_preferences ep
      JOIN user_profiles up ON up.id = ep.user_id
     WHERE ep.unsubscribed_all IS TRUE AND up.email IS NOT NULL LIMIT 2`
  const soloNewsletter = await sql<{ user_id: string }[]>`
    SELECT ep.user_id FROM email_preferences ep
      JOIN user_profiles up ON up.id = ep.user_id
     WHERE ep.email_newsletter_disabled IS TRUE
       AND (ep.unsubscribed_all IS NOT TRUE) AND up.email IS NOT NULL LIMIT 2`
  const libres = await sql<{ id: string }[]>`
    SELECT up.id FROM user_profiles up
     WHERE up.email IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM email_preferences ep
          WHERE ep.user_id = up.id
            AND (ep.unsubscribed_all IS TRUE OR ep.email_newsletter_disabled IS TRUE))
     LIMIT 3`

  console.log(`   baja de todo: ${bajaTotal.length} · solo newsletter off: ${soloNewsletter.length} · sin bloqueo: ${libres.length}\n`)

  const bloqueados = [...bajaTotal.map(r => r.user_id), ...soloNewsletter.map(r => r.user_id)]
  const sanos = libres.map(r => r.id)

  if (!bloqueados.length || !sanos.length) {
    console.log('⚠️  No hay datos suficientes en esta BD para simular (haría falta al menos 1 bloqueado y 1 libre)')
    await sql.end()
    process.exit(2)
  }

  // 2. El admin "selecciona" a todos a la vez, como haría desde el panel.
  const seleccion = [...bloqueados, ...sanos]
  const r = await getNewsletterRecipientsByIds(seleccion)
  const idsDestino = new Set(r.users.map(u => u.id))

  console.log(`   seleccionados: ${seleccion.length} → destinatarios: ${r.users.length} (excluidos por preferencias: ${r.skippedBlocked})\n`)

  ok(bloqueados.every(id => !idsDestino.has(id)),
    'ningún usuario dado de baja / con la newsletter apagada llega a la lista de envío')
  ok(sanos.every(id => idsDestino.has(id)),
    'los que no han pedido nada SIGUEN recibiendo (el filtro no se pasa de frenada)')
  ok(r.skippedBlocked === bloqueados.length,
    `el recuento de excluidos cuadra (${r.skippedBlocked} = ${bloqueados.length}), no se cae nadie en silencio`)

  // 3. Coherencia con la fuente: el conjunto bloqueado que usa el filtro tiene que
  //    ser exactamente el que dice la tabla.
  const set = await getBlockedNewsletterUserIds()
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM email_preferences
     WHERE unsubscribed_all IS TRUE OR email_newsletter_disabled IS TRUE`
  ok(set.size === n, `el conjunto bloqueado coincide con la BD (${set.size} = ${n})`)

  // 4. Caso degenerado: selección vacía no explota ni "cae en abierto".
  const vacio = await getNewsletterRecipientsByIds([])
  ok(vacio.users.length === 0 && vacio.skippedBlocked === 0, 'selección vacía → envío vacío')

  console.log(`\n${fallos === 0 ? '✅ SIM OK' : `❌ ${fallos} comprobación(es) fallida(s)`}`)
  await sql.end()
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch(async e => { console.error(e); await sql.end(); process.exit(1) })
