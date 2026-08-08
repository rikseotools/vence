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
 * ── EL FALSO VERDE QUE ESTO ARREGLA (T-574) ────────────────────────────────────────────────
 * `SELECT 1 FROM tabla LIMIT 1` con RLS activo y CERO políticas no lanza error: el motor filtra
 * en silencio y da 0 filas, siempre — indistinguible de una tabla vacía de verdad si solo se mira
 * "¿lanzó?". Medido en prod: `test_questions` y `tests` (dos de las tablas de `DEBE_LEER`) están
 * en ese estado y el canario las daba por buenas. La comprobación ahora cruza el CATÁLOGO
 * (`pg_class.relrowsecurity` + `pg_policies`, legible por cualquier rol sin GRANT explícito) con
 * el intento real de lectura — núcleo puro en `lib/db/rlsSelectBlocked.cjs`, con tests propios.
 *
 * Uso:  VENCE_LECTOR_URL=postgres://vence_lector:…@… npm run canary:rol-lector
 */
const fs = require('fs')
const path = require('path')
const { seleccionBloqueadaPorRls } = require('../lib/db/rlsSelectBlocked.cjs')

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
  // [T-038] relink de needs_human + reescritura de explicaciones: sin esto no se sabe qué campaña
  // marcó cada pregunta ni con qué sugerencia de artículo. Ver 20260805_rls_ai_verification_results_lector.sql.
  ['ai_verification_results', 'qué campaña marcó cada pregunta needs_human y con qué sugerencia'],
  // [T-220] triar los checks de seguimiento con cambio sin revisar: sin esto no se puede ver QUÉ
  // cambió (hash/preview/status), solo que `oposiciones.seguimiento_change_status='changed'`.
  // Ver 20260806_rls_convocatoria_seguimiento_checks_lector.sql.
  ['convocatoria_seguimiento_checks', 'el histórico de checks de seguimiento, para triar qué cambió'],
  // [T-639] canario de T-450 (cupo vs respuestas reales): sin esto no se puede comparar el cupo
  // consumido contra las respuestas de verdad. Ver 20260807_rls_daily_question_usage_lector.sql.
  ['daily_question_usage', 'el cupo diario consumido, para diagnosticar fugas de cupo'],
  // [T-108] "Claude en el bucle" del runbook OEP: sin esto ninguna sesión puede ver una sola
  // señal pendiente para triar (RLS activo, cero políticas — mismo mecanismo que test_questions/
  // tests). Ver 20260807_rls_oep_detection_signals_lector.sql.
  // [T-237] llegó por su lado a la MISMA necesidad (contrastar cuántas señales produjo un sensor
  // y triar una concreta, docs/runbooks/salud-radar.md) con la migración 20260806. La tabla se
  // declara UNA vez: dos entradas de la misma tabla no dan más permiso, solo hacen creer que son
  // controles distintos.
  ['oep_detection_signals', 'las señales del radar de OEP pendientes de revisar (y el histórico, para contrastar sensores)'],
  ['detection_sources', 'qué fuentes vigila el radar y si están sanas (salud del radar)'],
  // [T-638] fuente única de verdad del audit trail de lifecycle (CLAUDE.md) — sin esto un
  // worker no puede COMPROBAR que una transición pasó de verdad, solo fiarse de la prosa de
  // otra sesión. Ver 20260807_rls_question_lifecycle_history_lector.sql.
  ['question_lifecycle_history', 'el audit trail de transiciones de estado de las preguntas'],
  // [T-168] cruzar version_check_reload_immediate/deferred contra tests.is_completed=false
  // es la métrica que la propia ficha pide para medir el daño real de un reload en caliente.
  // Ver 20260807_rls_user_interactions_lector.sql.
  ['user_interactions', 'los eventos de interacción (version-check, tests…), para medir daño de reloads'],
  // [T-530] antifraude por dispositivo (T-372, T-418, T-304): sin esto no se puede medir por qué
  // la huella de hardware no reconoce la misma máquina. Ver 20260807_rls_user_devices_lector.sql.
  ['user_devices', 'huella de hardware y etiquetas de dispositivo, para diagnosticar el antifraude'],
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
        // No basta con que no lanzara: si RLS está activo y no hay política para este rol,
        // el SELECT anterior "tuvo éxito" devolviendo 0 filas SIEMPRE, tenga la tabla datos
        // o no. Eso es lo que daba el falso verde — se comprueba contra el catálogo.
        const cat = await sql`
          SELECT c.relrowsecurity AS rls
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = ${tabla}`
        const pol = await sql`
          SELECT cmd, roles FROM pg_policies WHERE schemaname = 'public' AND tablename = ${tabla}`
        const bloqueada = cat.length && seleccionBloqueadaPorRls(cat[0].rls, pol, quien[0].u)
        afirmar(`lee ${tabla} (${para})`, !bloqueada,
          bloqueada ? 'RLS activo SIN política para este rol — lee 0 filas siempre, sin error' : '')
      } catch (e) {
        afirmar(`lee ${tabla} (${para})`, false, String(e.message).slice(0, 70))
      }
    }

    // ── EL ALCANCE TOTAL (T-574) ──────────────────────────────────────────────────────────
    // `DEBE_LEER` es la lista de lo que el trabajo YA usa; esto es la foto completa. La
    // mayoría de estas tablas está bloqueada A PROPÓSITO (son operativas/con PII y nunca han
    // tenido política pública) — no es un fallo del canario, es el diseño "deniega por
    // defecto". Se imprime como INFORMACIÓN, sin contar para el veredicto, para que no vuelva
    // a pasar 24h sin que nadie lo vea (así se llegó a 87 sin que ningún canario lo dijera).
    const rlsSinPolicy = await sql`
      SELECT c.relname AS tabla
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname
        )
      ORDER BY c.relname`
    console.log(`\nℹ️  alcance total: ${rlsSinPolicy.length} tablas con RLS activo y CERO políticas (bloqueadas para TODOS los roles, no solo éste)`)
    const enDebeLeer = new Set(DEBE_LEER.map(([t]) => t))
    const inesperadas = rlsSinPolicy.filter((r) => enDebeLeer.has(r.tabla))
    if (inesperadas.length) {
      console.log(`   ⚠️  de ellas, ${inesperadas.length} están en DEBE_LEER y ya se contaron arriba como fallo: ${inesperadas.map((r) => r.tabla).join(', ')}`)
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
