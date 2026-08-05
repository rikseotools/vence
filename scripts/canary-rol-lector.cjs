#!/usr/bin/env node
/**
 * canary-rol-lector.cjs — el rol de LECTURA de la flota, ejercitado de verdad. (T-486)
 *
 * ── LAS DOS MITADES, Y LA SEGUNDA ES LA QUE NO SE PUEDE LEER EN EL .sql ──────────────────────
 * Un `GRANT` es una afirmación sobre producción. Que el rol PUEDA leer lo que necesita se ve en el
 * fichero; que NO pueda leer lo demás, no — los privilegios se acumulan por vías que no están ahí.
 * Aquí se intenta de verdad y se exige que el motor lo rechace con 42501.
 *
 * ── LA LÍNEA QUE VIGILA ─────────────────────────────────────────────────────────────────────
 * Se deniega el IDENTIFICADOR DIRECTO (correo, nombre, teléfono, IP, pago, tokens) y se permite la
 * ACTIVIDAD por `user_id`, que es un UUID. Un trabajador necesita saber que el usuario `a3f2…`
 * respondió 500 preguntas para diagnosticar una divergencia; no necesita saber cómo se llama.
 *
 * Y comprueba lo que un canario menos estricto pasaría por alto: que **no puede escribir**. Un rol
 * llamado «lector» que pudiera hacer UPDATE sería exactamente el fallo que nadie mira.
 *
 * Uso:  VENCE_LECTOR_URL=postgres://vence_lector:…@… npm run canary:rol-lector
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')

const casos = []
function afirmar(nombre, ok, detalle = '') {
  casos.push({ nombre, ok })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`)
}

const esDenegado = (e) => e && (e.code === '42501' || /permission denied|permiso denegado/i.test(String(e.message)))

async function debeDenegar(nombre, fn) {
  try {
    await fn()
    afirmar(nombre, false, 'NO fue denegado — el rol puede más de lo que debe')
  } catch (e) {
    afirmar(nombre, esDenegado(e), esDenegado(e) ? 'denegado por el motor' : `falló por otra causa: ${String(e.message).slice(0, 70)}`)
  }
}

/** Lo que el trabajo REAL necesita. Salió de la primera tarea de la flota (T-476), no de una lista a ojo. */
const DEBE_LEER = [
  ['observable_events', 'las alertas de salud que tiene que triar'],
  ['test_questions', 'la actividad con la que se diagnostican los contadores'],
  ['questions', 'el banco, para auditar contenido'],
  ['topic_scope', 'el temario, para las auditorías de scope'],
  ['articles', 'los artículos, para generar preguntas'],
  ['laws', 'las leyes'],
  ['topics', 'los temas'],
]

/** Dónde vive un identificador directo. Esto es lo que NO puede ver. */
const NO_DEBE_LEER = [
  ['user_profiles', 'correo y nombre de cada usuario'],
  ['public_user_profiles', 'nombres visibles'],
  ['user_subscriptions', 'quién paga y con qué cliente de Stripe'],
  ['payment_settlements', 'liquidaciones'],
  ['user_sessions', 'tokens de sesión'],
  ['email_events', 'direcciones de correo e IPs'],
  ['user_feedback', 'correos de quien escribe'],
  ['fraud_confirmations', 'hashes de correo'],
]

async function main() {
  const u = process.env.VENCE_LECTOR_URL
  if (!u) {
    console.log('\n⏭️  falta VENCE_LECTOR_URL: el rol aún no está provisionado.')
    // «No puedo mirar» NO es «está bien»: un verde aquí sin credencial sería el falso verde que
    // este repo persigue.
    return 0
  }
  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })

  console.log('\nCANARIO — el rol de LECTURA de la flota (T-486)')
  console.log('='.repeat(62))
  try {
    const quien = await sql`SELECT current_user AS u`
    afirmar('conecta con su propio rol', quien[0].u === 'vence_lector', quien[0].u)

    console.log('\n▸ lo que el trabajo REAL necesita leer')
    for (const [tabla, para] of DEBE_LEER) {
      try {
        await sql.unsafe(`SELECT 1 FROM public.${tabla} LIMIT 1`)
        afirmar(`lee ${tabla} (${para})`, true)
      } catch (e) {
        afirmar(`lee ${tabla} (${para})`, false, String(e.message).slice(0, 70))
      }
    }

    console.log('\n▸ lo que NO puede ver: el identificador directo')
    for (const [tabla, que] of NO_DEBE_LEER) {
      await debeDenegar(`${tabla} (${que})`, () => sql.unsafe(`SELECT 1 FROM public.${tabla} LIMIT 1`))
    }

    console.log('\n▸ y que un rol llamado «lector» NO pueda escribir')
    await debeDenegar('escribir en questions', () =>
      sql`UPDATE public.questions SET updated_at = now() WHERE false`)
    await debeDenegar('escribir en observable_events', () =>
      sql`INSERT INTO public.observable_events (source, severity, event_type) VALUES ('x','info','x')`)
    await debeDenegar('borrar de topic_scope', () => sql`DELETE FROM public.topic_scope WHERE false`)
  } catch (e) {
    console.error(`\n❌ el canario no pudo completarse: ${String(e.message || e).slice(0, 180)}`)
    casos.push({ nombre: 'ejecución completa', ok: false })
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  if (fallos.length) console.log('   ' + fallos.map((f) => f.nombre).join('\n   '))
  return fallos.length ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌', e); process.exit(1) })
