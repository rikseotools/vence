#!/usr/bin/env node
/**
 * sim-identidad-maquina.cjs — la identidad de sesión lleva MÁQUINA, y se comprueba EJECUTÁNDOLA.
 * (T-484, 02/08/2026)
 *
 * ## Por qué existe, además de los unitarios
 *
 * Los tests de `__tests__/sessions/sid.test.ts` e `indiceCompartido.test.ts` ejercitan los núcleos
 * puros, que es donde vive el criterio. Pero lo que de verdad puede romperse aquí NO está en el
 * núcleo: está en el latido, que es un script suelto con una sentencia SQL dentro de una plantilla
 * de JavaScript y que ningún test carga. Al construir esto, un comentario SQL con comillas
 * invertidas cerró la plantilla y dejó `latir.cjs` **sin poder ni arrancar** — con las 84 pruebas
 * en verde. Lo cazó ejecutarlo, y nada más podía cazarlo.
 *
 * Es la regla de la casa: un guardarraíl de TEXTO no es una comprobación de EJECUCIÓN.
 *
 * ## Qué afirma, contra la BD real
 *   1. el latido escribe la máquina en `worktree_sessions.host`;
 *   2. el mismo sid latiendo desde OTRA máquina refresca el host **y avisa** (identidad
 *      compartida: dos sesiones con un sid comparten claim y lease, y como la PK es el sid, las
 *      dos escriben sobre la misma fila y el mapa enseña UNA donde hay dos);
 *   3. desde la MISMA máquina no vuelve a avisar (o el aviso se volvería ruido y se ignoraría);
 *   4. queda serie temporal en `observable_events` con severidad `warn`.
 *
 * Usa un sid desechable y **borra su fila al terminar**, pase lo que pase. No toca ninguna otra.
 *
 *   node scripts/sim/sim-identidad-maquina.cjs
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '../..')
const SID = 'sim-identidad-maquina-desechable'

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

/**
 * stdout Y stderr: el aviso de identidad compartida sale por stderr a propósito (no es la salida
 * normal del comando), así que mirar solo stdout lo daría por ausente estando.
 */
function latir(host) {
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/sessions/latir.cjs'), '--sid', SID, '--verbose'],
    { cwd: REPO, encoding: 'utf8', env: { ...process.env, VENCE_SESSION_HOST: host } })
  return String(r.stdout || '') + String(r.stderr || '')
}

const casos = []
const afirmar = (nombre, ok, detalle = '') => {
  casos.push({ nombre, ok })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`)
}

async function main() {
  const u = url()
  if (!u) { console.log('⏭️  sin DATABASE_URL: no se puede simular contra la BD real'); return 0 }
  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })

  try {
    console.log('\n▸ 1. el latido publica en qué máquina corre')
    latir('sim-maquina-a')
    let f = await sql`SELECT host FROM worktree_sessions WHERE sid = ${SID}`
    afirmar('host escrito en worktree_sessions', f[0] && f[0].host === 'sim-maquina-a', JSON.stringify(f[0] && f[0].host))

    console.log('\n▸ 2. el MISMO sid desde otra máquina: identidad compartida')
    const salida = latir('sim-maquina-b')
    afirmar('avisa por stderr', /IDENTIDAD DE SESIÓN COMPARTIDA/.test(salida))
    afirmar('el aviso nombra las DOS máquinas', /sim-maquina-a/.test(salida) && /sim-maquina-b/.test(salida))
    f = await sql`SELECT host FROM worktree_sessions WHERE sid = ${SID}`
    // Hasta T-484 el host solo se escribía al INSERT: la fila conservaba para siempre el de la
    // primera vez, así que un sid que empezara a latir desde otro sitio se veía igual que uno
    // que no se hubiera movido — y entonces esto no se podría detectar nunca.
    afirmar('el host se REFRESCA (no se queda el del primer latido)', f[0] && f[0].host === 'sim-maquina-b', JSON.stringify(f[0] && f[0].host))

    console.log('\n▸ 3. desde la misma máquina no vuelve a avisar (un aviso repetido se ignora)')
    afirmar('sin falso positivo', !/IDENTIDAD DE SESIÓN COMPARTIDA/.test(latir('sim-maquina-b')))

    console.log('\n▸ 4. deja serie temporal, no solo una línea en una terminal')
    await new Promise((r) => setTimeout(r, 2500))   // el emisor va desacoplado (spawn detached)
    const ev = await sql`
      SELECT severity, error_message FROM observable_events
       WHERE event_type = 'sesion_friccion' AND metadata->>'clase' = 'identidad_compartida'
         AND created_at > now() - interval '2 minutes' ORDER BY created_at DESC LIMIT 1`
    afirmar('evento en observable_events', ev.length > 0, ev.length ? ev[0].error_message : '')
    // `warn` y no `info` a propósito: esto no es fricción rutinaria, es el reparto roto.
    afirmar('con severidad warn', ev.length > 0 && ev[0].severity === 'warn', ev.length ? ev[0].severity : '')
  } finally {
    const del = await sql`DELETE FROM worktree_sessions WHERE sid = ${SID} RETURNING sid`
    console.log(`\n🧹 fila desechable borrada: ${del.length}`)
    try { await sql.end({ timeout: 5 }) } catch {}
  }

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  return fallos.length ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌', e); process.exit(1) })
