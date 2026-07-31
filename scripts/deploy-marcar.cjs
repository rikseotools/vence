#!/usr/bin/env node
/**
 * deploy-marcar.cjs — deja constancia de que ESTE deploy empezó / terminó (T-404).
 *
 * Lo llaman `deploy-frontend.sh` y `deploy-backend.sh`. Su único propósito es que las DEMÁS
 * sesiones puedan preguntar «¿hay alguien desplegando?» sin tener que competir por el `flock` y
 * quedarse esperando hasta 45 minutos.
 *
 * REGLA DE ORO, la misma que el latido: **jamás falla hacia fuera**. Sale con 0 pase lo que pase.
 * Un deploy es la operación más cara y delicada que hacemos; que se caiga porque la telemetría no
 * pudo escribir sería un intercambio ridículo. Si esto no puede hablar, el deploy sigue igual —
 * simplemente nadie verá que está en curso, que es exactamente la situación de antes.
 *
 * Uso:
 *   node scripts/deploy-marcar.cjs --inicio --superficie backend --sha <sha>   # imprime el id
 *   node scripts/deploy-marcar.cjs --fin <id> --outcome ok|fail|abortado
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const REPO = path.resolve(__dirname, '..')
const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

// Misma identidad que el resto del andamiaje (T-407). Esta era la SEXTA copia del resolvedor,
// escrita el mismo día que se descubrió el problema — de ahí que el arreglo sea un módulo y no
// una corrección puntual.
const { resolverSid } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
function sesion() { return resolverSid({ repo: REPO }).sid }

async function main() {
  const u = url()
  if (!u) return
  const s = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8, idle_timeout: 2 })
  try {
    if (process.argv.includes('--inicio')) {
      const superficie = arg('--superficie')
      if (!superficie) return
      // El PID que se guarda es el del SHELL que lanzó el deploy (se pasa explícito), no el de
      // este proceso efímero de node: es el que sigue vivo mientras dura el build y el que
      // permite decir «sigue en curso» con certeza en vez de deducirlo por antigüedad.
      const pid = Number(arg('--pid') || process.ppid) || null
      const [r] = await s`
        INSERT INTO public.deploy_runs (surface, sha, sid, slug, host, pid)
        VALUES (${superficie}, ${arg('--sha')}, ${sesion()},
                ${path.basename(process.cwd())}, ${os.hostname()}, ${pid})
        RETURNING id`
      if (r) console.log(String(r.id))
    } else if (arg('--fin')) {
      await s`
        UPDATE public.deploy_runs
           SET finished_at = now(), outcome = ${arg('--outcome') || 'ok'}, note = ${arg('--note')}
         WHERE id = ${Number(arg('--fin'))} AND finished_at IS NULL`
    }
  } finally {
    try { await s.end({ timeout: 3 }) } catch {}
  }
}

// Fail-open TOTAL (ver la cabecera): cualquier avería sale con 0 y en silencio.
main().catch(() => {}).then(() => process.exit(0))
