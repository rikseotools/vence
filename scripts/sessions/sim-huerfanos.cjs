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

caso('viva-con-trabajo', 'en_uso', 'tiene contenido único pero SIGUE VIVA: no se opina', () => {
  const w = nuevoWorktree('viva-con-trabajo', 'sesion/viva')
  escribir(w, 'lib/en-curso.js', 'trabajo en marcha\n')
  return { ruta: w, rama: 'sesion/viva', minSinSenal: 2 }
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
    const { ruta, rama, minSinSenal = null } = c.construir()
    const r = clasificarWorktree({
      slug: c.nombre,
      ...datosDeWorktree(ruta, rama),
      minSinSenal,          // null = nunca latió → sesión muerta
      procesos: 0,
    })
    const ok = r.veredicto === c.esperado
    if (!ok) fallos++
    console.log(`  ${ok ? '✅' : '❌'} ${c.nombre.padEnd(20)} ${r.veredicto.padEnd(16)} ${ok ? '' : `(esperado ${c.esperado}) `}` +
      `[únicos=${r.ficherosUnicos.length} ahead=${r.commitsAhead} cherry=${r.commitsUnicos}]`)
    console.log(`     ${c.detalle}`)
    if (!ok) console.log(`     ⤷ ${r.motivo} · ${JSON.stringify(r.ficherosUnicos)}`)
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
