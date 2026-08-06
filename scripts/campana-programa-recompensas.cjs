#!/usr/bin/env node
// scripts/campana-programa-recompensas.cjs
//
// Inserta el aviso del Programa de Recompensas en la campana de los premium que NUNCA lo han
// abierto. Nace del dato del 28/07/2026: solo 11 de 258 premium (4,3%) habían entrado alguna vez
// — el programa no falla por el incentivo, falla porque casi nadie sabe que existe.
//
// DRY-RUN POR DEFECTO. Solo escribe con --commit, y el destinatario se decide en SQL (no a mano):
//   · premium
//   · sin haber abierto NUNCA el panel (sin referral_earnings_seen_at, sin referral_codes,
//     y sin ningún evento referral_page_view suyo)
//   · con actividad real este mes (>= MIN_DIAS días distintos), para que la frase del mensaje
//     («estás haciendo muchos tests») sea VERDAD para todos. Sin ese filtro, es mentira.
//
// Uso:  node scripts/campana-programa-recompensas.cjs [--commit] [--limit N]

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const { exigirPersona } = require('../lib/sessions/aprobacion.cjs')

const COMMIT = process.argv.includes('--commit')
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : null })()
const MIN_DIAS = 10
const MIN_PREG = 100

// Nombre de pila presentable. Un nombre que es un email, lleva números o es de 1-2 letras NO se
// usa: «Hola renguita2@yahoo.es» delata un envío automático mejor que ninguna otra cosa.
function saludo(nombre) {
  const n = String(nombre || '').trim()
  const primero = n.split(/\s+/)[0] || ''
  const inservible = !primero || primero.length <= 2 || /@/.test(primero) || /[0-9]{2,}/.test(primero) ||
    /^(smoke|test|prueba|confirmaci)/i.test(primero)
  if (inservible) return 'Hola,'
  return `Hola ${primero.charAt(0).toUpperCase()}${primero.slice(1).toLowerCase()},`
}

// El aviso ES clicable (tipo 'programa_recompensas' → /recompensas?src=aviso-mencion), así que el
// texto dice "pincha aquí" y no "busca el 🎁 de arriba": describir un camino más largo del que hay
// pierde por el camino a parte de los que lo habrían hecho.
const cuerpo = (nombre) => `${saludo(nombre)}

Estás haciendo muchos tests estos días.

Un favor de un minuto: cuando en un grupo de opositores alguien pregunte dónde hacer tests o de dónde sacar el temario, nómbranos. Nos mandas la captura y te damos 5 € en tarjeta regalo de Amazon.

Pincha aquí y verás más información.

Muchas gracias.

Equipo de Vence`

;(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 3 })
  try {
    const destinatarios = await sql`
      with act as (
        select t.user_id,
          count(distinct (tq.created_at at time zone 'Europe/Madrid')::date)::int dias,
          count(*)::int preg
        from test_questions tq join tests t on t.id = tq.test_id
        where tq.created_at >= date_trunc('month', now() at time zone 'Europe/Madrid')
        group by 1
      )
      select u.id, u.full_name, u.email, a.dias, a.preg
      from user_profiles u
      join act a on a.user_id = u.id
      where u.plan_type = 'premium'
        and u.referral_earnings_seen_at is null
        and not exists (select 1 from referral_codes rc where rc.owner_user_id = u.id)
        and not exists (select 1 from observable_events oe
                        where oe.user_id = u.id and oe.event_type = 'referral_page_view')
        and not exists (select 1 from notification_logs nl
                        where nl.user_id = u.id and nl.context_data->>'type' = 'programa_recompensas')
        and u.email <> 'smoke@vence.es'
        and a.dias >= ${MIN_DIAS} and a.preg >= ${MIN_PREG}
      order by a.dias desc, a.preg desc
      ${LIMIT ? sql`limit ${LIMIT}` : sql``}`

    console.log(`${COMMIT ? '🚀 ENVIANDO' : '🔍 DRY-RUN'} — ${destinatarios.length} destinatario(s)\n`)
    for (const u of destinatarios) {
      console.log(`  ${saludo(u.full_name).padEnd(20)} ${String(u.email).padEnd(38)} ${u.dias}d · ${u.preg} preg`)
    }
    if (destinatarios.length) {
      console.log('\n─── mensaje (ejemplo, el primero) ───\n')
      console.log(cuerpo(destinatarios[0].full_name))
    }

    if (!COMMIT) {
      console.log('\n(dry-run: no se ha escrito nada. Repite con --commit para enviarlo)')
      return
    }

    // La puerta va DESPUÉS de enseñar el borrador (para poder revisarlo sin permiso) y ANTES de
    // cualquier escritura: esto es un aviso PERSONALIZADO a usuarios reales prometiendo dinero,
    // exactamente lo que la regla de aprobación protege. Mismo patrón que
    // scripts/soporte/avisar-usuario.cjs (T-486).
    if (!exigirPersona('aviso')) process.exit(4)

    let n = 0
    for (const u of destinatarios) {
      await sql`
        insert into notification_logs (user_id, message_sent, delivery_status, sent_at, created_at, context_data)
        values (${u.id}, ${cuerpo(u.full_name)}, 'sent', now(), now(),
                ${sql.json({ type: 'programa_recompensas', title: '🎁 Un favor de un minuto', campaign: 'mencion-2026-07' })})`
      n++
    }
    console.log(`\n✅ ${n} aviso(s) insertado(s). Se verán en la campana; al pincharlos van a /recompensas?src=aviso-mencion.`)
    console.log('   Seguimiento: opened_at y clicked_at en notification_logs + referral_page_view con src=aviso-mencion.')
  } finally {
    await sql.end()
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
