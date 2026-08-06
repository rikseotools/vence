#!/usr/bin/env node
/**
 * Escribirle a UNA persona por algo que hemos detectado NOSOTROS. (T-601)
 *
 * Es el hueco que faltaba entre las cuatro vías de envío que ya existían, y todas ellas RESPONDEN a
 * algo que la persona escribió primero: impugnación, feedback, o una newsletter a una lista. No
 * había forma de decirle nada a alguien que **no ha reclamado**.
 *
 * El caso que lo estrena: `cnicolau2024@gmail.com` llevaba **19 días** intentando comprar (6
 * suscripciones `incomplete`, ni un cobro) porque su banco rechaza la tarjeta que tiene guardada en
 * el pago rápido, y él no tiene forma de saberlo. No había escrito a soporte: se limitaba a
 * reintentar. Las alternativas eran malas — `broadcast` filtra por oposición (le habría llegado a
 * todo Subalterno GVA) y colgarlo de un hilo de feedback exigía **fabricar un feedback suyo**, o
 * sea poner palabras en su boca en un registro.
 *
 * ⚠️ NO es para campañas: eso es `scripts/newsletters/`. Aquí va UNA persona y UN motivo concreto,
 * y por eso el motivo es obligatorio y queda escrito en `email_events`.
 *
 *   node scripts/soporte/avisar-usuario.cjs --a <email> --asunto "…" --texto <fichero.md> \
 *        --motivo "por qué le escribimos" [--preview <email>] [--enviar]
 *
 * Sin `--enviar` SOLO SIMULA (enseña el correo entero y no toca nada).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') })
const { Client } = require('pg')
const fs = require('fs')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
// Lo que sale hacia una persona lo aprueba una persona (T-486).
const { exigirPersona } = require('../../lib/sessions/aprobacion.cjs')

const arg = (n) => {
  const i = process.argv.indexOf(n)
  return i > -1 ? process.argv[i + 1] : null
}
const A = arg('--a')
const ASUNTO = arg('--asunto')
const TEXTO = arg('--texto')
const MOTIVO = arg('--motivo')
const PREVIEW = arg('--preview')
const ENVIAR = process.argv.includes('--enviar')

if (!A || !ASUNTO || !TEXTO || !MOTIVO) {
  console.error('Uso: --a <email> --asunto "…" --texto <fichero.md> --motivo "…" [--preview <email>] [--enviar]')
  console.error('     El MOTIVO es obligatorio: queda en email_events y es lo que explica, dentro de seis meses,')
  console.error('     por qué le escribimos a alguien que no había pedido nada.')
  process.exit(1)
}
if (!process.env.RESEND_API_KEY) { console.error('❌ Falta RESEND_API_KEY en .env.local'); process.exit(1) }

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Vence.es'
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'

/**
 * El cuerpo se escribe en texto plano y se envuelve en HTML sobrio a propósito.
 *
 * Un aviso de soporte no es una campaña: llevar cabecera de marca, botones y pie de baja lo hace
 * parecer publicidad justo cuando queremos que se lea como una persona escribiendo. El enlace de
 * baja tampoco corresponde — no es marketing, es soporte sobre algo suyo.
 */
function aHtml(txt) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const parrafos = esc(txt.trim()).split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, '<br>')}</p>`).join('\n')
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;` +
    `font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;">\n${parrafos}\n</div>`
}

;(async () => {
  const cuerpo = fs.readFileSync(TEXTO, 'utf8')
  const html = aHtml(cuerpo)
  const destino = PREVIEW || A

  console.log(`\n📧 AVISO A UNA PERSONA`)
  console.log(`   para:   ${A}${PREVIEW ? `   (PREVIEW → ${PREVIEW})` : ''}`)
  console.log(`   asunto: ${ASUNTO}`)
  console.log(`   motivo: ${MOTIVO}`)
  console.log(`   ─────────────────────────────────────────────`)
  console.log(cuerpo.trim().split('\n').map((l) => '   ' + l).join('\n'))
  console.log(`   ─────────────────────────────────────────────`)

  if (!ENVIAR && !PREVIEW) {
    console.log('\n🔍 SIMULACIÓN — no se ha enviado nada. Añade --enviar (o --preview <tu email>).')
    process.exit(0)
  }

  // La puerta va DESPUÉS de enseñar el borrador (para poder revisarlo sin permiso) y ANTES de
  // cualquier escritura o envío.
  if (!exigirPersona('aviso')) process.exit(4)

  const c = new Client(pgConfig())
  await c.connect()
  const { rows } = await c.query('SELECT id, email, full_name FROM user_profiles WHERE email = $1', [A])
  if (!rows.length) { console.error(`❌ No hay ningún usuario con ${A}`); await c.end(); process.exit(2) }
  const u = rows[0]

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [destino], subject: ASUNTO, html }),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) { console.error('❌ Resend:', resp.status, JSON.stringify(data)); await c.end(); process.exit(3) }

  if (PREVIEW) {
    console.log(`\n✅ PREVIEW enviada a ${PREVIEW} (no se registra en email_events).`)
  } else {
    // Sin registro, dentro de un mes nadie sabe que le escribimos ni por qué — y se le vuelve a
    // escribir. El motivo va en el propio registro, no en la cabeza de quien lo mandó.
    await c.query(
      `INSERT INTO email_events (user_id, event_type, email_type, email_address, subject, email_content_preview)
       VALUES ($1, 'sent', 'aviso_soporte', $2, $3, $4)`,
      [u.id, u.email, ASUNTO, `[${MOTIVO}] ${cuerpo.trim().slice(0, 400)}`],
    )
    console.log(`\n✅ Enviado a ${u.full_name || u.email} y registrado en email_events (id Resend: ${data.id || '?'}).`)
  }
  await c.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
