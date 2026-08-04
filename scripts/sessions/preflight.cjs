#!/usr/bin/env node
/**
 * preflight.cjs — ¿esta sesión está completa para trabajar? (T-539)
 *
 * El que OBSERVA. La decisión es pura y vive en `lib/sessions/preflight.cjs`; aquí solo se tocan
 * disco, red y BD. Ver ese fichero para el porqué.
 *
 * Uso:
 *   npm run sesion:preflight              # persona: avisa
 *   VENCE_SESSION_ROLE=trabajador npm run sesion:preflight    # trabajador: exit 1 si no está listo
 *
 * Dos cosas que NO hace, a propósito:
 *   · **No escribe el latido él mismo.** `scripts/sessions/latir.cjs` es el escritor ÚNICO de
 *     `worktree_sessions` (registro de herramientas). Un segundo escritor sería exactamente la
 *     avería que el registro existe para impedir. Lo invoca y luego MIRA si la fila está.
 *   · **No arregla nada.** Un preflight que se auto-repara no puede avisar de que algo falla.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const { resolverSid, rol } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
const { evaluarPreflight, mensajePreflight, severidadPreflight } =
  require(path.join(REPO, 'lib', 'sessions', 'preflight.cjs'))

const VERBOSE = process.argv.includes('--verbose')

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
  } catch { return null }
}

/** Un `--sid` explícito manda sobre todo (sid.cjs), así que hay que pasárselo también al latido:
 *  si no, el preflight comprobaría una identidad y el latido escribiría otra. */
function argSid() {
  const i = process.argv.indexOf('--sid')
  return i >= 0 && process.argv[i + 1] ? ['--sid', process.argv[i + 1]] : []
}

/** El latido lo escribe SU dueño; aquí solo se le pide que lata. */
function pedirLatido() {
  try {
    execFileSync(process.execPath,
      [path.join(REPO, 'scripts', 'sessions', 'latir.cjs'), '--cmd', 'preflight', ...argSid()],
      { cwd: process.cwd(), stdio: VERBOSE ? 'inherit' : 'ignore', timeout: 15000 })
  } catch { /* que no late ya lo dirá la comprobación de abajo, que MIRA la BD */ }
}

async function main() {
  const { sid, host } = resolverSid({ repo: REPO })
  const miRol = rol()

  let coordinacion = null
  let latido = null
  const u = url()

  if (!u) {
    coordinacion = false                       // no hay ni con qué intentarlo
  } else {
    let s = null
    try {
      s = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8, idle_timeout: 2 })
      await s`SELECT 1`
      coordinacion = true
    } catch (e) {
      coordinacion = false
      if (VERBOSE) console.error(`   (BD: ${String(e.message || e).slice(0, 120)})`)
    }

    // El latido solo tiene sentido comprobarlo si la BD responde y sé quién soy.
    if (coordinacion && sid) {
      pedirLatido()
      try {
        const f = await s`SELECT sid FROM public.worktree_sessions
                           WHERE sid = ${sid} AND last_signal_at > now() - interval '5 minutes'`
        latido = f.length > 0
      } catch { latido = false }
    }

    // El veredicto se emite con la MISMA conexión que acaba de probarse: si no se pudo emitir, la
    // sesión tampoco estaba completa, así que no se pierde información por callarlo.
    if (s) {
      const v = evaluarPreflight({ sid, host, coordinacion, latido, rol: miRol })
      if (coordinacion) {
        try {
          await s`
            INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
            VALUES ('fargate', ${severidadPreflight(v)}, 'sesion_preflight', 'sesiones',
                    ${v.motivo},
                    ${s.json({ sid, host, rol: miRol, veredicto: v.veredicto,
                               faltas: v.faltas.map((f) => f.clave), cwd: process.cwd() })})`
        } catch { /* la observabilidad nunca decide si se puede trabajar */ }
      }
      try { await s.end({ timeout: 3 }) } catch {}
    }
  }

  const v = evaluarPreflight({ sid, host, coordinacion, latido, rol: miRol })
  console.log(mensajePreflight(v))
  return v.puedeTrabajar ? 0 : 1
}

main().then((c) => process.exit(c)).catch((e) => {
  // Un bug del propio preflight no puede dejar tirada a una persona; a un trabajador SÍ lo para,
  // porque un preflight que no sabe responder es indistinguible de uno que respondería que no.
  const grave = rol() === 'trabajador'
  console.log(`⚠️  preflight: ${String(e.message || e).slice(0, 160)}`)
  process.exit(grave ? 1 : 0)
})
