#!/usr/bin/env node
/**
 * EJECUTA la reanimación de un trabajador contra tmux de verdad.  →  npm run sim:presencia-flota
 *
 * POR QUÉ EXISTE
 * Los tests de `__tests__/flota/encargo.test.ts` comprueban que `presenciaDelPanel` DECIDE bien y
 * que `ordenDeArranque` DICE `restart` y no `start`. Eso demuestra el criterio. Lo que no demuestra
 * es lo único que importaba el 07/08: que la orden, ejecutada de verdad, **levante una sesión que
 * ya no está** — que es justo donde falló el comando anterior. Un guardarraíl de texto no es una
 * ejecución (misma razón que `sim-rescate.cjs`).
 *
 * Reproduce los TRES casos medidos ese día, cada uno con su contraste:
 *   1. sesión que desaparece  → se detecta como `sin_sesion` y la orden la devuelve
 *   2. sesión sana            → se detecta `libre`/`trabajando` y NADIE la toca
 *   3. no se puede preguntar  → `invisible`, y NO se resucita (un ssh caído no es un turno muerto)
 *
 * Usa la orden REAL (`ordenDeArranque` de `lib/flota/encargo.cjs`), no una reconstrucción: si
 * alguien la cambia, esto cambia con ella o falla.
 *
 * No toca la flota: crea sus propias sesiones de tmux **en su propio socket** (`-L`, igual que los
 * trabajadores de verdad desde T-647) con un prefijo propio, y las mata al salir.
 * La rama de systemd no se ejecuta aquí a propósito —no hay unidad que arrancar en un portátil—,
 * pero SÍ se comprueba que la orden que se mandaría es `restart`, que es el defecto que se arregló.
 */
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')
const { presenciaDelPanel, ordenDeArranque } = require(path.join(__dirname, '..', '..', 'lib', 'flota', 'encargo.cjs'))

const PREFIJO = `simpres-${process.pid}`
const sesiones = []
process.on('exit', () => {
  for (const s of sesiones) { try { execSync(`tmux -L ${s} kill-server 2>/dev/null || true`) } catch {} }
})

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', shell: '/bin/bash' }).trim()

/** Igual que el supervisor: pregunta de forma que el comando SIEMPRE salga bien. */
function sesionExiste(nombre) {
  try {
    const r = sh(`tmux -L ${nombre} has-session -t ${nombre} 2>/dev/null && echo SI || echo NO`)
    if (r.endsWith('SI')) return true
    if (r.endsWith('NO')) return false
    return null
  } catch { return null }
}

function panel(nombre) {
  try { return sh(`tmux -L ${nombre} list-panes -t ${nombre} -F '#{pane_current_command}' 2>/dev/null | head -1`) } catch { return '' }
}

const casos = []
const comprobar = (nombre, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado)
  casos.push({ nombre, ok, real, esperado })
  console.log(`  ${ok ? '✅' : '❌'} ${nombre}`)
  if (!ok) console.log(`       esperado ${JSON.stringify(esperado)}\n       obtenido ${JSON.stringify(real)}`)
}

function main() {
  try { sh('command -v tmux') } catch {
    console.error('⚠️  tmux no está instalado: la simulación no puede ejecutar nada. No se da por buena.')
    return 2
  }
  console.log(`\n🧪 reanimación de trabajadores — casos reales del 07/08 (prefijo ${PREFIJO})\n`)

  // ── CASO 1: la sesión desaparece (w2 y w4) ────────────────────────────────────────────────
  const w = `${PREFIJO}-caido`
  sesiones.push(w)
  sh(`tmux -L ${w} new-session -d -s ${w} -c ${os.tmpdir()} /bin/bash`)
  comprobar('recién creada, se ve como libre', presenciaDelPanel({ sesionExiste: sesionExiste(w), paneCommand: panel(w), reparte: true }).estado, 'libre')

  sh(`tmux -L ${w} kill-server`)
  const caido = presenciaDelPanel({ sesionExiste: sesionExiste(w), paneCommand: panel(w), reparte: true })
  comprobar('desaparecida, se ve como sin_sesion (antes: se saltaba en silencio)', caido.estado, 'sin_sesion')
  comprobar('y lleva ACCIÓN, que es lo que faltaba', caido.accion, 'resucitar')

  // Y la orden REAL la devuelve. En local no hay unidad de systemd, así que se ejecuta la rama
  // local — la del VPS se comprueba por su forma, más abajo.
  sh(ordenDeArranque({ trabajador: w, systemd: false }).replace('"$HOME/vence-sessions/' + w + '"', os.tmpdir()))
  comprobar('la orden real la devuelve a la vida', sesionExiste(w), true)

  // ── CASO 2: sesión SANA con algo corriendo — nadie la toca ────────────────────────────────
  const s = `${PREFIJO}-sana`
  sesiones.push(s)
  // Sin comillas: con `'sleep 30'` tmux lo lanza a través de una shell y el panel reporta `sh`,
  // que ES un shell y saldría «libre» — un falso negativo de la propia simulación.
  sh(`tmux -L ${s} new-session -d -s ${s} -c ${os.tmpdir()} sleep 60`)
  const sana = presenciaDelPanel({ sesionExiste: sesionExiste(s), paneCommand: panel(s), reparte: true })
  comprobar('ocupada: se ve trabajando', sana.estado, 'trabajando')
  comprobar('y NO se resucita (resucitar mataría el turno de dentro)', sana.accion, null)

  // ── CASO 3: no se puede preguntar ─────────────────────────────────────────────────────────
  comprobar('sin poder preguntar: invisible', presenciaDelPanel({ sesionExiste: null, reparte: true }).estado, 'invisible')
  comprobar('y tampoco se resucita a ciegas', presenciaDelPanel({ sesionExiste: null, reparte: true }).accion, null)

  // ── La forma de la orden del VPS, que es el defecto que se arregló ────────────────────────
  const vps = ordenDeArranque({ trabajador: 'w2', systemd: true })
  comprobar('en el VPS la orden es restart (start es un no-op sobre active/exited)', /restart/.test(vps) && !/systemctl start/.test(vps), true)

  // ── Y el portátil apagado NO es una avería ───────────────────────────────────────────────
  comprobar('máquina que no reparte y sin sesión: apagado, no avería', presenciaDelPanel({ sesionExiste: false, reparte: false }).estado, 'apagado')

  const malos = casos.filter((c) => !c.ok)
  console.log(`\n${malos.length ? '❌' : '✅'} ${casos.length - malos.length}/${casos.length} casos\n`)
  return malos.length ? 1 : 0
}

process.exit(main())
