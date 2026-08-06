#!/usr/bin/env node
/**
 * ¿EXCLUYE DE VERDAD?  →  npm run sim:candado-deploy        (T-485)
 *
 * Lo que se está afirmando aquí es exclusión mutua entre máquinas, y eso no lo demuestra un test
 * que lea el SQL: hay que lanzar DOS adquisiciones de verdad contra la BD real y ver que solo una
 * entra. Un guardarraíl de texto habría dado verde con el `flock` local, que era justo el fallo.
 *
 * No toca producción: escribe en `deploy_runs` con superficie `sim-candado`, y limpia al salir
 * (incluso si algo revienta). Nunca despliega nada.
 */
const path = require('path')
const { execFileSync } = require('child_process')
const REPO = path.join(__dirname, '..', '..')
const CLI = path.join(REPO, 'scripts', 'deploy', 'candado.cjs')
const { TTL_MINUTOS } = require(path.join(REPO, 'lib', 'deploy', 'candado.cjs'))

const SUP = 'sim'
let fallos = 0
const ok = (m) => console.log(`  ✅ ${m}`)
const mal = (m) => { console.log(`  ❌ ${m}`); fallos++ }
const comprobar = (c, bien, malo) => (c ? ok(bien) : mal(malo || bien))

function cli(args, { esperaFallo = false } = {}) {
  try {
    return { salida: execFileSync('node', [CLI, ...args], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(), codigo: 0 }
  } catch (e) {
    if (!esperaFallo && e.status === 4) throw new Error('el candado no pudo comprobar la BD: ' + String(e.stderr || '').slice(0, 120))
    return { salida: String(e.stdout || '').trim(), err: String(e.stderr || ''), codigo: e.status }
  }
}

function sql(q, params = []) {
  const pg = require(path.join(REPO, 'node_modules', 'postgres'))
  const fs = require('fs')
  const u = process.env.DATABASE_URL || (fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m) || [])[1].trim()
  const s = pg(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
  return s.unsafe(q, params).then(async (r) => { await s.end({ timeout: 3 }); return r })
}

const creados = []
async function limpiar() {
  if (creados.length) await sql(`DELETE FROM public.deploy_runs WHERE id = ANY($1::bigint[])`, [creados])
  await sql(`DELETE FROM public.deploy_runs WHERE surface = $1`, [SUP])
}

;(async () => {
  console.log('\n🔒 sim:candado-deploy — dos adquisiciones REALES contra la BD\n')
  await limpiar()

  console.log('── 1. el segundo NO entra mientras el primero tiene el arriendo')
  const a = cli(['adquirir', '--superficie', SUP, '--sha', 'aaa', '--pid', String(process.pid)])
  comprobar(a.codigo === 0 && /^\d+$/.test(a.salida), 'el primero adquiere', `el primero NO adquirió (${a.codigo}) ${a.err || ''}`)
  if (a.salida) creados.push(Number(a.salida))
  const b = cli(['adquirir', '--superficie', SUP, '--sha', 'bbb', '--pid', String(process.pid)], { esperaFallo: true })
  comprobar(b.codigo === 3, 'el segundo se queda fuera (salida 3)', `el segundo TAMBIÉN entró: no hay exclusión (código ${b.codigo})`)
  comprobar(/DEPLOY EN CURSO/.test(b.err || ''), 'y le dice quién lo tiene, no solo que no')

  console.log('── 2. al soltar, el siguiente entra')
  cli(['soltar', a.salida, '--outcome', 'ok'])
  const c = cli(['adquirir', '--superficie', SUP, '--sha', 'ccc', '--pid', String(process.pid)])
  comprobar(c.codigo === 0, 'tras soltar, el siguiente adquiere', 'quedó bloqueado tras soltar')
  if (c.salida) creados.push(Number(c.salida))

  console.log('── 3. cerrar la fila SUELTA el arriendo aunque nadie lo pida (trigger)')
  const [f] = await sql(`SELECT lease_until FROM public.deploy_runs WHERE id = $1`, [Number(a.salida)])
  comprobar(f && f.lease_until === null, 'al cerrarse, lease_until queda a NULL',
    'la fila cerrada conserva el arriendo: bloquearía para siempre')

  console.log('── 4. si el proceso muere sin soltar, el arriendo CADUCA (no bloquea eternamente)')
  await sql(`UPDATE public.deploy_runs SET lease_until = now() - interval '1 minute' WHERE id = $1`, [Number(c.salida)])
  const d = cli(['adquirir', '--superficie', SUP, '--sha', 'ddd', '--pid', String(process.pid)])
  comprobar(d.codigo === 0, 'con el arriendo vencido, otro puede entrar', 'un deploy muerto bloquearía para siempre')
  if (d.salida) creados.push(Number(d.salida))

  console.log('── 5. …pero NO antes de caducar')
  cli(['renovar', String(d.salida)])
  const e = cli(['adquirir', '--superficie', SUP, '--sha', 'eee', '--pid', String(process.pid)], { esperaFallo: true })
  comprobar(e.codigo === 3, 'renovado, sigue excluyendo', 'renovar no mantuvo la exclusión')

  console.log('── 6. renovar EXTIENDE de verdad la caducidad')
  const [antes] = await sql(`SELECT lease_until FROM public.deploy_runs WHERE id = $1`, [Number(d.salida)])
  await sql(`UPDATE public.deploy_runs SET lease_until = now() + interval '1 minute' WHERE id = $1`, [Number(d.salida)])
  cli(['renovar', String(d.salida)])
  const [despues] = await sql(`SELECT lease_until, lease_until > now() + interval '5 minutes' AS lejos FROM public.deploy_runs WHERE id = $1`, [Number(d.salida)])
  comprobar(despues && despues.lejos, `renovar deja el arriendo a ~${TTL_MINUTOS} min vista`,
    'renovar no extendió: el arriendo caducaría a mitad de un build largo')

  console.log('── 7. el trinquete: el candado no puede aprender a fallar en abierto')
  const src = require('fs').readFileSync(CLI, 'utf8')
  comprobar(/process\.exit\(4\)/.test(src) && /Fail-closed/.test(src),
    'sin poder comprobar la BD, no deja pasar (salida 4)',
    'el candado dejaría desplegar a ciegas si se cae la BD')

  await limpiar()
  console.log(fallos === 0 ? '\n✅ CANDADO VERIFICADO EJECUTÁNDOLO: 0 fallos\n' : `\n❌ ${fallos} fallo(s)\n`)
  process.exit(fallos === 0 ? 0 : 1)
})().catch(async (e) => { try { await limpiar() } catch {} ; console.error('ERR', e.message); process.exit(1) })
