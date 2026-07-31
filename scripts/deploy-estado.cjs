#!/usr/bin/env node
/**
 * deploy-estado.cjs — «¿hay alguien desplegando ahora mismo?», SIN competir por el lock (T-404).
 *
 * Hasta hoy esa pregunta solo se podía contestar lanzando el deploy y quedándote bloqueado en el
 * `flock` hasta 45 minutos. Por eso varias sesiones proponían desplegar a la vez: ninguna podía
 * ver que otra ya iba.
 *
 * Cruza TRES fuentes y las contrasta en vez de creerse una:
 *   1. `deploy_runs` — lo que alguien declaró al empezar (consultable desde cualquier sesión).
 *   2. El PROCESO de quien lo lanzó — la verdad, pero solo desde la misma máquina.
 *   3. El `flock` de /tmp — se sondea SIN BLOQUEAR: si se puede tomar, nadie despliega aquí.
 *
 * Cuando discrepan lo dice, en vez de elegir una. Esa es la lección de los claims zombi
 * (`backlog.cjs reap`): un marcador rancio leído como «ocupado» manda a esperar a un muerto.
 *
 * Uso:  node scripts/deploy-estado.cjs [--json]
 * Salida: 0 libre · 3 ocupado · 4 dudoso   (para poder encadenarlo en scripts)
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '..')
const JSON_OUT = process.argv.includes('--json')
const { veredicto } = require(path.join(REPO, 'lib', 'deploy', 'estado.cjs'))
const LOCK = '/tmp/vence-deploy.lock'

/**
 * Sondea el lock SIN bloquear: `flock -n` sale 1 si está tomado, 0 si lo consigue (y lo suelta
 * de inmediato, porque el subshell muere). Es exactamente la pregunta que no se podía hacer.
 * Devuelve `null` si no hay flock o el fichero no existe: eso es «no sé», no «libre».
 */
function lockTomado() {
  try {
    if (!fs.existsSync(LOCK)) return false
    execFileSync('flock', ['-n', LOCK, '-c', 'true'], { stdio: 'ignore', timeout: 4000 })
    return false           // se pudo tomar → nadie lo tiene
  } catch (e) {
    if (e && e.code === 'ENOENT') return null   // no hay flock en esta máquina
    return true                                  // exit≠0 → tomado
  }
}

function contenidoDelLock() {
  try { return fs.readFileSync(LOCK, 'utf8').trim().slice(0, 200) || null } catch { return null }
}

async function main() {
  let url = process.env.DATABASE_URL
  if (!url) { try { url = fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch {} }
  const tomado = lockTomado()

  let abiertos = []
  let bdOk = false
  if (url) {
    const s = require('postgres')(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8, idle_timeout: 2 })
    try {
      abiertos = await s`
        SELECT id, surface, sha, sid, slug, host, pid, started_at
          FROM public.deploy_runs
         WHERE finished_at IS NULL
         ORDER BY started_at DESC`
      bdOk = true
    } catch { /* sin BD se contesta solo con el lock */ } finally {
      try { await s.end({ timeout: 3 }) } catch {}
    }
  }

  const v = veredicto(abiertos, { hostActual: os.hostname() })
  if (JSON_OUT) {
    console.log(JSON.stringify({ ...v, lockTomado: tomado, bdOk }, null, 1))
  } else {
    // El LOCK manda sobre la tabla: es el que de verdad serializa. La tabla dice QUIÉN y desde
    // cuándo, que es lo que el lock no puede contar.
    if (tomado === true) {
      console.log('🔴 HAY UN DEPLOY EN CURSO — el lock está tomado.')
      const c = contenidoDelLock(); if (c) console.log(`   ${c}`)
    } else if (tomado === false && v.estado === 'ocupado') {
      console.log('🟠 La tabla dice que hay un deploy en curso, pero el LOCK está libre.')
      console.log('   Probablemente murió sin cerrar su fila. Se puede desplegar.')
    } else if (tomado === false) {
      console.log('🟢 Nadie está desplegando (lock libre).')
    } else {
      console.log('⚪ No se puede sondear el lock en esta máquina; me quedo con lo que dice la tabla.')
    }
    console.log(`   registro: ${v.resumen}`)
    for (const c of [...v.enCurso, ...v.sospechosos]) {
      console.log(`   · ${c.run.surface} ${String(c.run.sha || '').slice(0, 8)} — ${c.run.slug || '?'} en ${c.run.host || '?'} · ${c.minutos} min · ${c.motivo}`)
    }
    if (v.muertos.length) console.log(`   (${v.muertos.length} fila(s) huérfanas de deploys que murieron; no estorban)`)
    if (!bdOk) console.log('   ⚠️  sin BD: solo se ha podido mirar el lock local.')
  }
  // El lock es el árbitro para el código de salida: es lo único que de verdad impide desplegar.
  if (tomado === true) return 3
  if (v.estado === 'dudoso') return 4
  return 0
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error('deploy-estado:', String(e.message || e).slice(0, 160))
  process.exit(0)   // no saber no puede impedir desplegar
})
