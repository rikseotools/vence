#!/usr/bin/env node
/**
 * El candado de deploy ENTRE MÁQUINAS. (T-485)  ·  núcleo: lib/deploy/candado.cjs
 *
 *   candado.cjs adquirir --superficie <frontend|backend|both> --sha <sha> --pid <pid>
 *       → imprime el id del run y sale 0.  OCUPADO → explica quién lo tiene y sale 3.
 *   candado.cjs renovar <id>      → extiende el arriendo (lo llama el renovador del deploy)
 *   candado.cjs soltar <id> [--outcome ok|fallo] [--note "…"]
 *   candado.cjs estado            → informativo, no toca nada
 *
 * ── FAIL-CLOSED, Y ES LA DIFERENCIA CON `deploy-marcar.cjs` ─────────────────────────────────
 * `deploy-marcar.cjs` es TELEMETRÍA y falla en abierto a propósito: si no puede escribir, el
 * deploy sigue. Esto es una PUERTA: si no puede comprobar que está libre, NO deja pasar. Un
 * candado que se abre cuando se cae la red no es un candado.
 *
 * La única excepción es `soltar`, que falla en abierto: no poder soltar no puede impedir que
 * termine el deploy, y el arriendo caduca solo de todas formas.
 */
const path = require('path')
const os = require('os')
const REPO = path.join(__dirname, '..', '..')
const { TTL_MINUTOS, puedeAdquirir, sqlCandadoLibre, mensajeOcupado } = require(path.join(REPO, 'lib', 'deploy', 'candado.cjs'))

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }

// El árbol de deploy no tiene `node_modules` ni `.env.local`: los dos se resuelven con fallback al
// checkout principal. Vive en `lib/deploy/entorno.cjs` porque `deploy-marcar.cjs` ya lo había
// resuelto y copiarlo habría sido la segunda copia — de hecho el primer intento de este candado
// cometió justo el error del que aquel comentario avisaba, y lo cazó el primer deploy real.
const { cargarPg, urlBd } = require(path.join(REPO, 'lib', 'deploy', 'entorno.cjs'))
const url = () => urlBd(REPO)

function sid() {
  try { return require(path.join(REPO, 'lib', 'sessions', 'sid.cjs')).resolverSid({ repo: REPO }).sid }
  catch { return process.env.CLAUDE_CODE_SESSION_ID || 'desconocida' }
}

async function main() {
  const cmd = process.argv[2]
  const u = url()
  if (!u) {
    // Sin BD no se puede afirmar que esté libre. Fail-closed, salvo para soltar.
    if (cmd === 'soltar') process.exit(0)
    console.error('⛔ candado de deploy: sin DATABASE_URL no se puede comprobar si otra máquina está desplegando.')
    console.error('   No se despliega a ciegas: dos update-service solapados es el incidente del 24/07 (T-075).')
    process.exit(4)
  }
  const pg = cargarPg(REPO)
  const s = pg(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
  try {
    if (cmd === 'adquirir') {
      const superficie = arg('--superficie')
      if (!superficie) { console.error('falta --superficie'); process.exit(2) }
      const pid = Number(arg('--pid')) || process.ppid
      // ── ATÓMICO: la decisión va DENTRO del INSERT ────────────────────────────────────────
      // Leer y luego escribir dejaría la ventana en la que dos máquinas leen «libre» a la vez.
      const [fila] = await s.unsafe(
        `INSERT INTO public.deploy_runs (surface, sha, sid, slug, host, pid, lease_until)
         SELECT $1, $2, $3, $4, $5, $6, now() + interval '${TTL_MINUTOS} minutes'
          WHERE ${sqlCandadoLibre()}
         RETURNING id`,
        [superficie, arg('--sha'), sid(), path.basename(process.cwd()), os.hostname(), pid])
      if (fila) { console.log(String(fila.id)); return 0 }
      // No entró: alguien lo tiene. Se informa con el JUICIO del núcleo (quién y desde cuándo).
      const abiertos = await s`
        SELECT id, surface, sha, sid, host, pid, started_at
          FROM public.deploy_runs
         WHERE finished_at IS NULL AND lease_until IS NOT NULL AND lease_until > now()
         ORDER BY started_at`
      const v = puedeAdquirir(abiertos, { hostActual: os.hostname() })
      console.error(mensajeOcupado(v))
      return 3
    }

    if (cmd === 'renovar') {
      const id = Number(process.argv[3])
      if (!id) { console.error('falta el id'); process.exit(2) }
      const [r] = await s`
        UPDATE public.deploy_runs
           SET lease_until = now() + (${TTL_MINUTOS} || ' minutes')::interval
         WHERE id = ${id} AND finished_at IS NULL
         RETURNING id`
      // Si la fila ya se cerró, renovar no tiene sentido: se dice y se sale sin ruido.
      return r ? 0 : 1
    }

    if (cmd === 'soltar') {
      const id = Number(process.argv[3])
      if (!id) return 0
      // `lease_until` lo pone a NULL el trigger: soltar es cerrar, y cerrar libera siempre,
      // venga de este script o de cualquier otro sitio.
      await s`
        UPDATE public.deploy_runs
           SET finished_at = now(), outcome = ${arg('--outcome') || 'ok'}, note = ${arg('--note')}
         WHERE id = ${id} AND finished_at IS NULL`
      return 0
    }

    // estado
    const abiertos = await s`
      SELECT id, surface, sha, sid, host, pid, started_at, lease_until
        FROM public.deploy_runs
       WHERE finished_at IS NULL AND lease_until IS NOT NULL AND lease_until > now()
       ORDER BY started_at`
    const v = puedeAdquirir(abiertos, { hostActual: os.hostname() })
    console.log(v.libre ? '🟢 candado LIBRE' : mensajeOcupado(v))
    return v.libre ? 0 : 3
  } finally {
    try { await s.end({ timeout: 3 }) } catch {}
  }
}

main().then((c) => process.exit(c || 0)).catch((e) => {
  if (process.argv[2] === 'soltar') process.exit(0)
  console.error('⛔ candado de deploy: no se pudo comprobar —', String(e.message || e).slice(0, 140))
  console.error('   Fail-closed a propósito: sin comprobar, no se despliega.')
  process.exit(4)
})
