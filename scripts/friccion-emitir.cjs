#!/usr/bin/env node
/**
 * friccion-emitir.cjs — deja constancia de un roce entre sesiones. (T-423)
 *
 * Lo llaman los guardarraíles y el CLI del backlog. Escribe en `observable_events`, el bus que ya
 * usa todo el proyecto, para que la fricción entre sesiones tenga SERIE TEMPORAL y no solo
 * respuestas puntuales. Ver `lib/observability/friccionSesiones.cjs` para el porqué.
 *
 * **Best-effort ABSOLUTO.** Esto corre dentro de hooks de git y del camino de deploy: sale con 0
 * pase lo que pase y no imprime nada salvo `--verbose`. Una avería del bus de observabilidad no
 * puede impedirle a nadie commitear, pushear ni desplegar — es la misma regla que el latido.
 *
 * Uso:
 *   node scripts/friccion-emitir.cjs --clase guard_bloqueo --guard backlog-push --detalle "…"
 *   node scripts/friccion-emitir.cjs --clase deploy_espera --segundos 420
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')
const VERBOSE = process.argv.includes('--verbose')
const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

async function main() {
  const { EVENT_TYPE, esClase } = require(path.join(REPO, 'lib', 'observability', 'friccionSesiones.cjs'))
  const clase = arg('--clase')
  if (!esClase(clase)) return
  const u = url()
  if (!u) return

  const { resolverSid } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
  const s = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 6, idle_timeout: 2 })
  try {
    await s`
      INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
      VALUES ('fargate',
              -- Un escape es SIEMPRE 'warn' aunque el guardarraíl haya dejado pasar a propósito:
              -- lo que interesa vigilar no es el bloqueo, es cuántas veces se rodea (ver el
              -- núcleo). Un escape en 'info' se perdería entre el ruido, que es justo cómo un
              -- guardarraíl se muere sin que nadie se entere.
              ${clase === 'guard_escape' ? 'warn' : 'info'},
              ${EVENT_TYPE}, 'sesiones',
              ${arg('--detalle') || clase},
              ${s.json({
                clase,
                guard: arg('--guard') || null,
                segundos: arg('--segundos') ? Number(arg('--segundos')) : null,
                sid: resolverSid({ repo: REPO }).sid,
                cwd: process.cwd(),
              })})`
    if (VERBOSE) console.log(`✅ fricción registrada: ${clase}`)
  } finally { try { await s.end({ timeout: 3 }) } catch {} }
}

main().catch((e) => { if (VERBOSE) console.error('fricción no registrada:', String(e.message || e).slice(0, 120)) })
  .then(() => process.exit(0))
