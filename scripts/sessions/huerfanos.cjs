#!/usr/bin/env node
/**
 * huerfanos.cjs — barrido de worktrees ABANDONADOS con trabajo que solo existe ahí. (T-431)
 *
 *   node scripts/sessions/huerfanos.cjs            informe legible
 *   node scripts/sessions/huerfanos.cjs --json     crudo (lo consume `latidos.cjs`)
 *   node scripts/sessions/huerfanos.cjs --slug X   solo ese; exit 3 si tiene contenido único
 *
 * Solo LEE (git + `worktree_sessions`). El criterio vive en `lib/sessions/trabajoHuerfano.cjs`,
 * compartido con el guard de `borrar-worktree.sh` — el barrido que avisa y el guard que impide
 * borrar tienen que opinar lo mismo o uno de los dos miente.
 *
 * **Por qué es LOCAL y no entra en el barrido nocturno**, que es lo primero que uno piensa: los
 * worktrees viven en la máquina de quien trabaja, y el sweep de salud corre en Fargate. Un cron en
 * la nube no puede ver un directorio que no existe ahí. Por eso se engancha donde ya se mira a las
 * sesiones (`latidos.cjs`) y, sobre todo, en el punto donde la pérdida es IRREVERSIBLE (el
 * borrado del worktree).
 *
 * Fail-open en todo: informar nunca puede impedir trabajar.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { clasificarWorktree, resumenBarrida } = require('../../lib/sessions/trabajoHuerfano.cjs')

const REPO = path.resolve(__dirname, '../..')
const JSON_OUT = process.argv.includes('--json')
const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }
const SLUG = arg('--slug')

function git(args, cwd = REPO) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim()
  } catch { return '' }
}

/**
 * Datos de git de UN worktree, listos para `clasificarWorktree`. Exportado para que la simulación
 * (`sim-huerfanos.cjs`) interrogue worktrees de verdad con ESTE código y no con una copia: el
 * fallo que se coló al estrenar esto no estaba en la clasificación —que se testea sin git— sino
 * justo aquí, en qué se le preguntaba a git.
 */
function datosDeWorktree(ruta, rama) {
  const perdida = loQueSePerderia(ruta)
  return {
    ficherosUnicos: perdida.ficheros,
    // Para que el informe pueda decir la VERDAD sobre cada fichero en vez de llamarlos a todos
    // «sin commitear»: son dos cosas distintas y se arreglan distinto ([T-707]).
    sinCommitear: perdida.sinCommitear,
    soloCommiteadoAqui: perdida.soloCommiteadoAqui,
    publicadoEn: perdida.publicadoEn,
    commitsAhead: Number(git(['rev-list', '--count', `origin/main..${rama || 'HEAD'}`], ruta) || 0),
    // `git cherry` compara por PARCHE: '+' = no está en la principal ni por contenido.
    commitsUnicos: git(['cherry', 'origin/main', rama || 'HEAD'], ruta)
      .split('\n').filter((l) => l.startsWith('+')).length,
  }
}

/** Worktrees del repo (todos, no solo los de `~/vence-sessions`: el trabajo se pierde igual). */
function listarWorktrees() {
  const out = []
  let cur = {}
  for (const linea of git(['worktree', 'list', '--porcelain']).split('\n')) {
    if (linea.startsWith('worktree ')) cur = { ruta: linea.slice(9) }
    else if (linea.startsWith('branch ')) cur.rama = linea.slice(7).replace('refs/heads/', '')
    else if (linea.startsWith('detached')) cur.rama = null
    else if (linea === '' && cur.ruta) { out.push(cur); cur = {} }
  }
  if (cur.ruta) out.push(cur)
  return out
}

/**
 * Lo que se PERDERÍA al borrar este worktree. NO es «ficheros tocados» ni «commits por delante»:
 * de los 5 worktrees medidos el 31/07, cuatro tenían commits o ficheros y **nada** que perder.
 *
 * Hacen falta las TRES preguntas, y cada una tumba un falso positivo distinto:
 *
 *  1. `origin/main...HEAD` (**tres puntos**, desde la base común) — trabajo COMMITEADO propio.
 *     A dos puntos entrarían también los ficheros en los que voy por DETRÁS de la principal, que
 *     no son míos: son los de las otras sesiones que aún no tengo. Medido al estrenar esto — mi
 *     propio worktree salía con 14 ficheros «únicos» de los que 12 eran de otros. Y de paso
 *     resuelve el `umu-golive` (versión desfasada de algo que ya está arriba): si la rama no
 *     aporta commits, la base común es su propio HEAD y no hay diferencia que reclamar.
 *  2. …pero solo los que **de verdad difieren** hoy del contenido de la principal (dos puntos).
 *     Ese es el `vence-clean`: 47 commits sin pushear cuyo contenido ya estaba arriba, aplicado
 *     por otro camino. Commitear algo no lo hace único.
 *  3. Lo que no está commiteado ni rastreado (`status`), que no aparece en ningún diff y es
 *     justo lo más frágil.
 */
function loQueSePerderia(ruta) {
  const commiteado = git(['diff', '--name-only', 'origin/main...HEAD'], ruta).split('\n').filter(Boolean)
  const difiereHoy = new Set(git(['diff', '--name-only', 'origin/main'], ruta).split('\n').filter(Boolean))
  const sinCommitear = ficherosSinCommitear(ruta)

  // ── «COMMITEADO AQUÍ» NO ES «SOLO EXISTE AQUÍ» (T-707, 08/08) ────────────────────────────
  // Lo que este worktree ha commiteado y `main` no tiene puede estar PUSHEADO —de hecho el
  // rescate de [T-560] existe justo para eso: empujar a `origin/rescate/<slug>-<sha>` lo que solo
  // vivía en una máquina—. Medido: `t486-flota` salía con «4 ficheros que solo existen aquí (sin
  // commitear)» teniendo el árbol LIMPIO y su commit a salvo en `origin/rescate/t486-flota-…`, y
  // encima su contenido ya estaba en `main` por otra vía. Avisar de eso es gastar la atención de
  // quien lo lea; y con 13 worktrees señalados, el que de verdad guarde algo pasa desapercibido.
  const contenidos = commiteado.length ? ramasQueLoContienen(ruta) : []
  const publicado = contenidos.some((r) => r.startsWith('origin/'))
  const soloCommiteadoAqui = publicado ? [] : commiteado.filter((f) => difiereHoy.has(f))

  return {
    sinCommitear,
    soloCommiteadoAqui,
    publicadoEn: publicado ? contenidos.filter((r) => r.startsWith('origin/'))[0] : null,
    // Lo que se pierde de verdad si alguien borra el worktree ahora mismo.
    ficheros: [...new Set([...soloCommiteadoAqui, ...sinCommitear])],
  }
}

/**
 * Ficheros con cambios sin commitear, leyendo `--porcelain` como es (T-707).
 *
 * **El defecto que arregla:** `git()` hace `.trim()` de la salida, así que la PRIMERA línea perdía
 * su espacio inicial — y `slice(3)` se comía entonces el primer carácter del nombre. Se veía en el
 * informe real como `ocs/roadmap/tareas-pendientes.md` (sin la `d`): un fichero que no existe, así
 * que quien fuera a mirarlo no lo encontraba. Solo pasaba con la primera línea y solo con los
 * códigos que empiezan por espacio (` M`, ` D`), que son justo los cambios sin preparar — los más
 * frecuentes. Ahora se parte por el patrón real (`XY<espacio>RUTA`) en vez de por posición fija, y
 * se resuelve el `ORIG -> DESTINO` de los renombrados, que también salía pegado.
 */
function ficherosSinCommitear(ruta) {
  return git(['status', '--porcelain', '--untracked-files=all'], ruta)
    .split('\n')
    .map((l) => {
      const m = /^(..)[ ]?(.*)$/.exec(l)
      if (!m) return ''
      const camino = m[2].trim()
      // Renombrado/copiado: `R  viejo -> nuevo`. Lo que existe hoy es el destino.
      return camino.includes(' -> ') ? camino.split(' -> ').pop().trim() : camino
    })
    // El `.session-id` lo escribe la propia herramienta de worktrees: es artefacto, no trabajo.
    .filter((f) => f && f !== '.session-id')
}

/** Ramas (locales y remotas) que ya contienen el HEAD de este worktree. */
function ramasQueLoContienen(ruta) {
  return git(['branch', '-a', '--contains', 'HEAD', '--format=%(refname:short)'], ruta)
    .split('\n').map((l) => l.replace(/^remotes\//, '').trim()).filter(Boolean)
}

/**
 * Quién está vivo, según `worktree_sessions`. `null` = NO SE PUDO SABER (no «nadie vivo»).
 *
 * **Se intenta también la RÉPLICA, y no es un lujo:** esto es una lectura pura, así que la
 * réplica sirve igual de bien, y el 06/08 el primario dio `CONNECT_TIMEOUT` durante minutos
 * mientras la réplica respondía a la primera. Con una sola vía, ese rato el barrido se quedaba
 * ciego — que es justo cuando más falta hace (una sesión que muere no avisa).
 */
async function senales() {
  const urls = []
  for (const nombre of ['DATABASE_URL', 'DATABASE_URL_REPLICA']) {
    try {
      const u = process.env[nombre] ||
        fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(new RegExp(`^${nombre}=(.*)$`, 'm'))[1].trim()
      if (u) urls.push(u)
    } catch { /* la que no esté, se salta */ }
  }
  for (const url of urls) {
    try {
      const s = require('postgres')(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8 })
      try {
        return await s`SELECT slug, worktree_path, last_signal_at FROM worktree_sessions`
      } finally { try { await s.end({ timeout: 3 }) } catch {} }
    } catch { /* se prueba la siguiente */ }
  }
  return null   // sin BD no se puede saber quién está vivo → se dice, no se supone
}

/** Procesos con el cwd dentro (señal local, sin BD). `null` si no es Linux: no miente. */
function procesosDentro(dir) {
  let n = 0
  try {
    for (const pid of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(pid)) continue
      try { if (fs.readlinkSync(`/proc/${pid}/cwd`).startsWith(dir)) n++ } catch {}
    }
  } catch { return null }
  return n
}

/** Deja serie temporal en el bus que ya existe (T-423). Best-effort absoluto. */
function emitirFriccion(n) {
  try {
    const a = ['--clase', 'trabajo_huerfano', '--guard', 'worktrees', '--detalle', `${n} worktree(s) con contenido único`]
    require('child_process')
      .spawn(process.execPath, [path.join(REPO, 'scripts', 'friccion-emitir.cjs'), ...a], { detached: true, stdio: 'ignore' })
      .unref()
  } catch { /* la telemetría nunca estorba */ }
}

/**
 * Minutos desde el último latido de esa sesión, para `clasificarWorktree`. `null` = NO SE SABE,
 * que es distinto de «lleva mucho sin latir» y **muy** distinto de «acaba de latir».
 *
 * Aquí vivía el fallo que motiva [T-615]. Sin BD se devolvía `0` —o sea, «señal recién vista»—,
 * y como la señal de vida manda sobre todo lo demás, los 28 worktrees salían `en_uso`: el barrido
 * no llegaba a mirar el contenido de ninguno y aun así firmaba «✅ nada en peligro». Dos daños,
 * y el segundo es el caro:
 *   · el informe daba un VERDE que no había evaluado nada (06/08: `sesion/colas-feedback` llevaba
 *     18 h muerta con un arreglo de `db/schema.ts` que no estaba en `main`, y salía «en uso»);
 *   · `borrar-worktree.sh` consulta esto con `--slug` y borra si no hay hallazgo, así que sin BD
 *     el guard **dejaba borrar un worktree con trabajo dentro** — y ese borrado no se deshace.
 * Devolviendo `null` la decisión recae en `procesosDentro`, que es una señal LOCAL y real.
 */
function minutosSinSenal(ses, ahora) {
  if (!ses || !ses.last_signal_at) return null
  const t = new Date(ses.last_signal_at).getTime()
  if (!Number.isFinite(t)) return null
  return Math.round((ahora - t) / 60000)
}

async function main() {
  const vivas = await senales()
  const porRuta = new Map((vivas || []).map((v) => [v.worktree_path, v]))
  const ahora = Date.now()
  const propio = REPO

  const clasificados = []
  for (const wt of listarWorktrees()) {
    if (!fs.existsSync(wt.ruta)) continue
    if (SLUG && path.basename(wt.ruta) !== SLUG) continue
    // El árbol desde el que se ejecuta esto está, por definición, en uso.
    const esMio = path.resolve(wt.ruta) === path.resolve(propio)
    const ses = porRuta.get(wt.ruta)
    const minSinSenal = minutosSinSenal(ses, ahora)

    clasificados.push(clasificarWorktree({
      slug: path.basename(wt.ruta),
      ...datosDeWorktree(wt.ruta, wt.rama),
      minSinSenal: esMio ? 0 : minSinSenal,
      procesos: esMio ? 1 : procesosDentro(wt.ruta),
    }))
  }

  const r = resumenBarrida(clasificados)
  if (JSON_OUT) { console.log(JSON.stringify({ ...r, clasificados }, null, 1)); return r }

  if (SLUG) {
    const c = clasificados[0]
    if (!c) { console.log(`⚪ ${SLUG}: no es un worktree de este repo`); return r }
    console.log(`${c.gravedad === 'warn' ? '⚠️ ' : '✅'} ${c.slug} — ${c.motivo}`)
    for (const f of c.ficherosUnicos.slice(0, 12)) console.log(`     ${f}`)
    if (c.ficherosUnicos.length > 12) console.log(`     …y ${c.ficherosUnicos.length - 12} más`)
    return r
  }

  console.log(`\nWORKTREES REVISADOS (${r.total}): ${r.en_uso} en uso · ${r.sin_trabajo} sincronizados · ${r.solo_desfasado} desfasados (borrables)`)
  // Un veredicto se DA cuando se ha podido mirar. Sin `worktree_sessions` la vida solo se deduce
  // de los procesos locales, así que el «en uso» de un worktree sin procesos dentro no está
  // comprobado — y decir ✅ ahí es firmar lo que no se ha visto.
  if (vivas === null) {
    console.log('⚠️  NO SE HA PODIDO COMPROBAR quién está vivo: ni el primario ni la réplica respondieron.')
    console.log('    La vida se ha deducido SOLO de los procesos locales; el resto no está verificado.')
  }
  if (!r.hallazgo) {
    console.log(vivas === null
      ? '   sin hallazgos con lo que se ha podido mirar — esto NO es «nada en peligro».'
      : '✅ ningún worktree guarda trabajo que solo exista ahí.')
    return r
  }
  console.log(`\n⚠️  ${r.huerfanos.length} WORKTREE(S) CON TRABAJO QUE SOLO EXISTE AHÍ:`)
  for (const c of r.huerfanos) {
    console.log(`\n   ${c.slug} — ${c.motivo}`)
    // Se separan porque se arreglan distinto: lo SIN COMMITEAR hay que commitearlo (o decidir que
    // era basura), y lo COMMITEADO Y NO PUBLICADO hay que empujarlo. Llamar «sin commitear» a las
    // dos cosas mandaba a mirar el árbol de un worktree que estaba limpio ([T-707]).
    const sin = c.sinCommitear || []
    const soloAqui = c.soloCommiteadoAqui || []
    if (sin.length) {
      console.log(`      · ${sin.length} sin commitear:`)
      for (const f of sin.slice(0, 8)) console.log(`          ${f}`)
      if (sin.length > 8) console.log(`          …y ${sin.length - 8} más`)
    }
    if (soloAqui.length) {
      console.log(`      · ${soloAqui.length} commiteado(s) aquí y sin publicar (empújalo: git -C <ruta> push origin HEAD):`)
      for (const f of soloAqui.slice(0, 8)) console.log(`          ${f}`)
      if (soloAqui.length > 8) console.log(`          …y ${soloAqui.length - 8} más`)
    }
    if (!sin.length && !soloAqui.length) {
      for (const f of c.ficherosUnicos.slice(0, 10)) console.log(`      ${f}`)
      if (c.ficherosUnicos.length > 10) console.log(`      …y ${c.ficherosUnicos.length - 10} más`)
    }
  }
  console.log('\n   Míralo antes de borrar nada:  git -C <ruta> diff origin/main')
  emitirFriccion(r.huerfanos.length)
  return r
}

if (require.main === module) {
  main()
    .then((r) => process.exit(SLUG && r && r.hallazgo ? 3 : 0))
    .catch((e) => { console.log(`⚠️  huerfanos: ${String(e.message || e).slice(0, 120)} (fail-open)`); process.exit(0) })
}

module.exports = { loQueSePerderia, datosDeWorktree, listarWorktrees, minutosSinSenal }
