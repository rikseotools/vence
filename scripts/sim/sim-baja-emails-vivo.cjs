#!/usr/bin/env node
/**
 * ¿El SERVIDOR DESPLEGADO respeta la casilla de la baja masiva? (T-369)
 *
 *   npm run sim:baja-emails-vivo            # contra https://www.vence.es
 *   npm run sim:baja-emails-vivo -- --base http://localhost:3000
 *
 * ## Por qué existe, teniendo ya `sim:baja-emails`
 *
 * Aquel llama a `processUnsubscribeByToken` **en proceso**: ejercita la lógica con el
 * código de TU árbol. Es la capa correcta para lo que vigila (el UPDATE con columnas
 * dinámicas, que los tests no pueden ver porque mockean Drizzle), y no sirve para lo
 * que se pregunta aquí: **si lo que hay VIVO en producción se comporta así**.
 *
 * La diferencia no es teórica en esta tarea concreta. El arreglo estuvo escrito y en
 * `main` desde el 31/07 sin llegar a desplegarse, y la ficha se quedó parada esperando
 * un deploy —o sea, con el defecto vivo y el arreglo en verde en local—. Y el mismo día
 * [T-450] enseñó la versión cara de esa distancia: un arreglo desplegado, con sus tests
 * y su guardarraíl en verde, que en producción no hacía absolutamente nada.
 *
 * ## Qué comprueba, y por qué son DOS casos y no uno
 *
 *   1. baja masiva SIN marcar la casilla  → `email_soporte_disabled` sigue en `false`
 *      (el usuario seguirá recibiendo la respuesta a lo que él nos escriba)
 *   2. baja masiva MARCANDO la casilla    → pasa a `true`
 *
 * El segundo no es adorno: sin él, un endpoint que ignorase el campo por completo —o que
 * hubiera dejado de escribir esa columna— pasaría el primero con nota. Cada rechazo va
 * emparejado con su contraste; si no, no se está midiendo la condición, se está midiendo
 * que no pasa nada.
 *
 * En los dos casos se comprueba además que la baja SÍ ha surtido efecto
 * (`unsubscribed_all = true`): si el token fuera inválido el endpoint no escribiría nada
 * y el caso 1 saldría verde por el motivo equivocado.
 *
 * Usa usuarios EFÍMEROS que crea y borra él mismo (mismo patrón que `sim:baja-emails`):
 * nunca toca datos de un cliente. Es seguro correrlo contra producción.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })
const { Client } = require('pg')
const { pgConfig } = require(path.join(__dirname, '..', '..', 'lib', 'db', 'pgSsl.cjs'))

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const BASE = (arg('--base', 'https://www.vence.es')).replace(/\/$/, '')
const PREFIJO = 'sim-baja-vivo'

let fallos = 0
const comprobar = (nombre, ok, detalle = '') => {
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos++
}

async function crearCaso(c, slug) {
  const email = `${PREFIJO}-${slug}@vence.es`
  const { rows: [u] } = await c.query(
    `INSERT INTO user_profiles (id, email, full_name, plan_type)
     VALUES (gen_random_uuid(), $1, 'Sim Baja Emails Vivo', 'free')
     ON CONFLICT (email) DO UPDATE SET full_name = 'Sim Baja Emails Vivo'
     RETURNING id`, [email])
  const userId = u.id

  await c.query(
    `INSERT INTO email_preferences (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE
       SET unsubscribed_all = false, email_newsletter_disabled = false, email_soporte_disabled = false`,
    [userId])

  const token = `${PREFIJO}-${slug}-${Date.now()}`
  await c.query(
    `INSERT INTO email_unsubscribe_tokens (user_id, token, email, email_type, expires_at)
     VALUES ($1, $2, $3, 'newsletter', NOW() + INTERVAL '1 day')`, [userId, token, email])

  return { userId, email, token }
}

async function prefs(c, userId) {
  const { rows: [p] } = await c.query(
    `SELECT unsubscribed_all, email_soporte_disabled FROM email_preferences WHERE user_id = $1`, [userId])
  return p
}

async function limpiar(c) {
  await c.query(`DELETE FROM email_unsubscribe_tokens WHERE email LIKE $1`, [`${PREFIJO}-%`])
  await c.query(
    `DELETE FROM email_preferences WHERE user_id IN (SELECT id FROM user_profiles WHERE email LIKE $1)`,
    [`${PREFIJO}-%`])
  await c.query(`DELETE FROM user_profiles WHERE email LIKE $1`, [`${PREFIJO}-%`])
}

;(async () => {
  console.log(`\n🕯️  Baja de emails contra el servidor VIVO — ${BASE}\n`)

  // Qué versión está sirviendo: sin esto, un verde no dice CONTRA QUÉ se ha verificado.
  try {
    const salud = await fetch(`${BASE}/api/health`).then((r) => r.json())
    console.log(`   deploy vivo: ${salud.deploy ?? '(desconocido)'}\n`)
  } catch {
    console.log('   (no se pudo leer /api/health)\n')
  }

  const c = new Client(pgConfig())
  await c.connect()
  try {
    await limpiar(c)   // por si una corrida anterior murió a medias

    for (const [slug, marcada, esperado] of [
      ['sin-casilla', false, false],
      ['con-casilla', true, true],
    ]) {
      const { userId, token } = await crearCaso(c, slug)

      const cuerpo = { token, unsubscribeAll: true }
      // La casilla DESMARCADA no manda el campo, igual que un cliente viejo: el caso 1
      // comprueba a la vez la casilla y el valor por defecto del servidor.
      if (marcada) cuerpo.includeSoporte = true

      const res = await fetch(`${BASE}/api/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const json = await res.json().catch(() => ({}))

      const etiqueta = marcada ? 'MARCANDO la casilla' : 'SIN marcar la casilla'
      console.log(`   ── baja masiva ${etiqueta} (HTTP ${res.status})`)
      comprobar('el endpoint acepta la baja', res.ok && json.success === true, json.error || '')

      const p = await prefs(c, userId)
      comprobar('la baja surte efecto (unsubscribed_all)', p?.unsubscribed_all === true,
        `vale ${p?.unsubscribed_all}`)
      comprobar(
        marcada
          ? 'corta también las respuestas a lo que el usuario escribe'
          : 'NO toca las respuestas a lo que el usuario escribe',
        p?.email_soporte_disabled === esperado,
        `email_soporte_disabled = ${p?.email_soporte_disabled} (se esperaba ${esperado})`)
      console.log('')
    }
  } finally {
    await limpiar(c)
    await c.end()
  }

  if (fallos > 0) {
    console.error(`❌ ${fallos} comprobación(es) fallida(s) — ficha: [T-369]`)
    process.exit(2)
  }
  console.log('✅ el servidor vivo respeta la casilla en las dos direcciones.\n')
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
