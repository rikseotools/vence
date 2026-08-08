#!/usr/bin/env node
/**
 * sim-huerfanos.cjs — simulación del detector de trabajo huérfano contra git DE VERDAD. (T-431)
 *
 *   node scripts/sessions/sim-huerfanos.cjs [--conservar]
 *
 * Monta un repo desechable con **los cinco worktrees del caso raíz del 31/07** y comprueba que el
 * detector separa el uno que importa de los cuatro que son ruido. Exit 1 si algún caso falla.
 *
 * ── POR QUÉ ESTA CAPA Y NO SOLO UNITARIOS ────────────────────────────────────────────────────
 * La clasificación es pura y se testea sin git (`__tests__/sessions/trabajoHuerfano.test.ts`).
 * Pero el fallo real que se coló al estrenar esto **no estaba ahí**: estaba en QUÉ se le pregunta
 * a git. Con `git diff origin/main` a dos puntos, mi propio worktree salía con 14 ficheros
 * «únicos» de los que 12 eran de OTRAS sesiones y a mí me faltaban. Un unitario con datos
 * inventados nunca lo habría visto, porque el dato inventado ya venía bien.
 *
 * Por eso la simulación llama a `datosDeWorktree` del script real, no a una copia.
 *
 * Y el detector NACE EN SILENCIO (hoy los 8 worktreesnacen vivos y no hay ningún huérfano), así
 * que sin esto no habría **ninguna** prueba de que sabe encontrar algo.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { clasificarWorktree } = require('../../lib/sessions/trabajoHuerfano.cjs')
const { datosDeWorktree } = require('./huerfanos.cjs')

const CONSERVAR = process.argv.includes('--conservar')
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-huerfanos-'))
const origen = path.join(raiz, 'origen')

const g = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const escribir = (cwd, rel, txt) => {
  fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true })
  fs.writeFileSync(path.join(cwd, rel), txt)
}
const commit = (cwd, msg) => { g(['add', '-A'], cwd); g(['-c', 'user.email=s@x', '-c', 'user.name=sim', 'commit', '-q', '-m', msg], cwd) }

function nuevoWorktree(nombre, rama, desde = 'main') {
  const ruta = path.join(raiz, nombre)
  g(['worktree', 'add', '-q', '-b', rama, ruta, desde], origen)
  return ruta
}

const casos = []
const caso = (nombre, esperado, detalle, construir) => casos.push({ nombre, esperado, detalle, construir })

// ── Los cinco del 31/07, más dos de control ─────────────────────────────────────────────────

caso('sesion-28jul-d', 'contenido_unico', 'el ÚNICO real: 43 líneas de documentación nunca subidas', () => {
  const w = nuevoWorktree('sesion-28jul-d', 'sesion/28jul-d')
  escribir(w, 'docs/gotchas.md', 'catalogar exige escribir también convocatorias\nel BOE por txt.php clona el armazón\n')
  commit(w, 'docs: dos gotchas con coste medido')
  return { ruta: w, rama: 'sesion/28jul-d' }
})

caso('vence-clean', 'solo_desfasado', '47 commits sin pushear cuyo contenido YA está en la principal', () => {
  const w = nuevoWorktree('vence-clean', 'sesion/clean')
  // Aplica exactamente el mismo cambio que después entra en la principal por otro camino:
  // `git cherry` lo reconoce por PARCHE y el contenido de hoy es idéntico.
  escribir(w, 'app/pagina.js', 'export const x = 1\n')
  commit(w, 'feat: la misma mejora')
  escribir(origen, 'app/pagina.js', 'export const x = 1\n')
  commit(origen, 'feat: la misma mejora (por otro camino)')
  g(['update-ref', 'refs/remotes/origin/main', 'main'], origen)
  return { ruta: w, rama: 'sesion/clean' }
})

caso('pagos-planes', 'sin_trabajo', '7 ficheros, idénticos a la principal byte a byte', () => {
  const w = nuevoWorktree('pagos-planes', 'sesion/pagos')
  // Los toca, pero los deja con el MISMO contenido: tocar no es cambiar.
  escribir(w, 'app/pagina.js', fs.readFileSync(path.join(origen, 'app/pagina.js'), 'utf8'))
  return { ruta: w, rama: 'sesion/pagos' }
})

caso('umu-golive', 'sin_trabajo', 'versión DESFASADA de algo que la principal ya tiene más nuevo', () => {
  const w = nuevoWorktree('umu-golive', 'sesion/umu')
  // La principal avanza DESPUÉS; este worktree se queda atrás. Ir por detrás no es tener trabajo:
  // fue el falso positivo que destapó la simulación (a dos puntos salían como «únicos»).
  escribir(origen, 'app/nuevo.js', 'contenido más nuevo\n')
  commit(origen, 'feat: algo posterior')
  g(['update-ref', 'refs/remotes/origin/main', 'main'], origen)
  return { ruta: w, rama: 'sesion/umu' }
})

caso('scrape-opositatest', 'contenido_unico', 'limpieza a medias SIN COMMITEAR — lo más frágil', () => {
  const w = nuevoWorktree('scrape-opositatest', 'sesion/scrape')
  escribir(w, 'docs/limpieza.md', 'a medias\n')   // ni commiteado ni rastreado
  return { ruta: w, rama: 'sesion/scrape' }
})

// ── Los dos defectos que se encontraron USANDO la herramienta el 08/08 ([T-707]) ────────────

caso('rescatado-y-pusheado', 'solo_desfasado',
  'commiteado aquí y YA EMPUJADO a origin: no se pierde nada si se borra', () => {
  // El caso real: `t486-flota` salía como «4 ficheros que solo existen aquí (sin commitear)»
  // teniendo el árbol LIMPIO y su commit a salvo en `origin/rescate/t486-flota-<sha>` — que es
  // justo lo que el rescate de una sesión caída deja hecho. Avisar de eso gasta la atención de
  // quien lee, y con trece worktrees señalados el que SÍ guarda algo pasa desapercibido.
  const w = nuevoWorktree('rescatado-y-pusheado', 'sesion/rescatado')
  escribir(w, 'lib/rescatado.js', 'export const y = 2\n')
  commit(w, 'chore: rescate de una sesion caida')
  // Publicado: una referencia remota que ya lo contiene.
  g(['update-ref', 'refs/remotes/origin/rescate/rescatado', 'sesion/rescatado'], w)
  return { ruta: w, rama: 'sesion/rescatado' }
})

caso('primer-fichero-intacto', 'contenido_unico',
  'el nombre del PRIMER fichero sin commitear no se mutila', () => {
  // `git()` hacía `.trim()` de la salida, así que la primera línea de `--porcelain` perdía su
  // espacio inicial y `slice(3)` se comía la primera letra: en el informe real salía
  // `ocs/roadmap/tareas-pendientes.md`, un fichero que no existe. Solo pasaba con la primera
  // línea y solo con los códigos que empiezan por espacio (` M`), que son los cambios sin
  // preparar — los más frecuentes.
  const w = nuevoWorktree('primer-fichero-intacto', 'sesion/primero')
  escribir(w, 'docs/roadmap/tareas-pendientes.md', 'contenido base\n')
  commit(w, 'docs: base')
  g(['update-ref', 'refs/remotes/origin/main', 'sesion/primero'], w)
  escribir(w, 'docs/roadmap/tareas-pendientes.md', 'contenido base\nlinea nueva sin commitear\n')
  return { ruta: w, rama: 'sesion/primero', esperaFichero: 'docs/roadmap/tareas-pendientes.md' }
})

caso('viva-con-trabajo', 'en_uso', 'tiene contenido único y hay un PROCESO real dentro: no se opina', () => {
  const w = nuevoWorktree('viva-con-trabajo', 'sesion/viva')
  escribir(w, 'lib/en-curso.js', 'trabajo en marcha\n')
  // El proceso confirmado es lo que representa "sigue viva" de verdad (T-577): un latido fresco
  // por sí solo YA NO basta si se puede comprobar que no hay nadie dentro. En un repo desechable
  // no hay ningún proceso real trabajando, así que aquí se simula pasando `procesos:1` — es la
  // única forma honesta de representar "vivo" sin mentir sobre lo que `/proc` vería de verdad.
  return { ruta: w, rama: 'sesion/viva', minSinSenal: 2, procesos: 1 }
})

caso('l2-recien-muerta', 'contenido_unico', 'T-577: el turno terminó (procesos:0) con latido AÚN fresco — ya no cuela como "en uso"', () => {
  // El caso raíz del incidente: el supervisor entró en el worktree de otra sesión que acababa de
  // terminar su turno (proceso muerto) pero cuyo latido en worktree_sessions todavía tenía solo
  // un par de minutos -- muy por debajo de las 3 horas que hacían falta para que el barrido lo
  // mirara como huérfano -- y le hizo un `git checkout HEAD -- .` que borró 6 ficheros. Antes de
  // T-577 este caso salía "en_uso" (nadie avisaba); ahora sale "contenido_unico" de inmediato.
  const w = nuevoWorktree('l2-recien-muerta', 'sesion/l2')
  escribir(w, 'lib/temario/badgeProvenance.cjs', 'trabajo de T-518 sin commitear\n')
  return { ruta: w, rama: 'sesion/l2', minSinSenal: 2, procesos: 0 }
})

caso('recien-creada', 'sin_trabajo', 'worktree limpio, recién sincronizado', () => {
  const w = nuevoWorktree('recien-creada', 'sesion/limpia')
  return { ruta: w, rama: 'sesion/limpia' }
})

function main() {
  fs.mkdirSync(origen, { recursive: true })
  g(['init', '-q', '-b', 'main'], origen)
  escribir(origen, 'README.md', 'repo de simulación\n')
  commit(origen, 'init')
  g(['update-ref', 'refs/remotes/origin/main', 'main'], origen)

  console.log(`\n═══ SIM — trabajo huérfano en worktrees (T-431) ═══\n${raiz}\n`)
  let fallos = 0
  for (const c of casos) {
    // `procesos` por defecto es 0 (nada corre de verdad en un repo desechable) y CADA caso puede
    // pisarlo -- necesario desde T-577: el único caso que de verdad está "viva" (`viva-con-trabajo`)
    // ya no lo puede fingir solo con un latido reciente, hace falta declarar un proceso real.
    const { ruta, rama, minSinSenal = null, procesos = 0 } = c.construir()
    const r = clasificarWorktree({
      slug: c.nombre,
      ...datosDeWorktree(ruta, rama),
      minSinSenal,          // null = nunca latió → sesión muerta
      procesos,
    })
    const ok = r.veredicto === c.esperado
    if (!ok) fallos++
    console.log(`  ${ok ? '✅' : '❌'} ${c.nombre.padEnd(20)} ${r.veredicto.padEnd(16)} ${ok ? '' : `(esperado ${c.esperado}) `}` +
      `[únicos=${r.ficherosUnicos.length} ahead=${r.commitsAhead} cherry=${r.commitsUnicos}]`)
    console.log(`     ${c.detalle}`)
    if (!ok) console.log(`     ⤷ ${r.motivo} · ${JSON.stringify(r.ficherosUnicos)}`)
    // Un veredicto correcto con el NOMBRE mal sigue mandando a mirar un fichero que no existe.
    if (c.esperaFichero && !(r.ficherosUnicos || []).includes(c.esperaFichero)) {
      fallos++
      console.log(`     ⤷ ❌ esperaba el fichero ${c.esperaFichero}, salió ${JSON.stringify(r.ficherosUnicos)}`)
    }
  }

  const reales = casos.filter((c) => c.esperado === 'contenido_unico').length
  console.log(`\n  ${casos.length} casos · ${reales} con trabajo real · ${casos.length - reales} que NO deben avisar`)
  if (fallos) {
    console.error(`\n🔴 ${fallos} caso(s) mal clasificado(s).`)
    console.error('   Si falla uno de los "que NO deben avisar", el detector se ha vuelto ruidoso y morirá ignorado.')
    console.error('   Si falla uno de los reales, deja pasar trabajo que se puede perder para siempre.')
  } else {
    console.log('\n🟢 VERDE: encuentra los reales y no grita por los cuatro que son ruido.')
  }
  if (!CONSERVAR) fs.rmSync(raiz, { recursive: true, force: true })
  else console.log(`\n   (--conservar) el repo de simulación queda en ${raiz}`)
  return fallos ? 1 : 0
}

try { process.exit(main()) } catch (e) {
  console.error('❌ la simulación no pudo correr:', e.message)
  if (!CONSERVAR) fs.rmSync(raiz, { recursive: true, force: true })
  process.exit(1)
}
