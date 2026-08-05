// lib/flota/maquinas.cjs — dónde vive la flota. (T-486)
//
// ── POR QUÉ UN REGISTRO ──────────────────────────────────────────────────────────────────────
// La misma forma que `cuentas.cjs` y que el multi-cuenta de Stripe: **añadir una máquina es UNA
// fila**. Sin esto, la IP del servidor acaba copiada en cinco scripts y el día que cambie —o que
// se añada la segunda máquina— hay que encontrarlos todos.
//
// Lo que NO va aquí: credenciales. La llave SSH se referencia por RUTA, no por contenido, y los
// tokens de Claude Code viven en el propio servidor (`/etc/vence-flota/<w>.env`, 0600). Un
// registro versionado con secretos dentro es un secreto publicado.

const path = require('path')
const os = require('os')

/**
 * Las máquinas de la flota. **Añadir una = una fila.**
 *
 * `trabajadores` es la lista de los que se esperan en esa máquina: sirve para que `estado` pueda
 * decir «falta w2» en vez de enseñar solo lo que hay, que es la diferencia entre notar una caída
 * y no notarla.
 */
const MAQUINAS = {
  // El PORTÁTIL es una máquina más, y eso es lo que quita las pantallas múltiples (T-486, 05/08).
  // El reparto ya era común —todo pasa por RDS—, así que una sesión local y una del VPS son lo
  // mismo para el sistema; lo único que las diferenciaba era que a las remotas se les podía dar
  // trabajo con un comando y a las locales no.
  //
  // `local: true` significa «sin SSH»: los comandos se ejecutan aquí mismo. Y `trabajadores` es
  // la lista de los AUTÓNOMOS, no de todas tus sesiones: las que abras tú a mano siguen siendo
  // tuyas, salen en el parte como personas y nadie les manda encargos.
  // Los nombres van en minúscula porque `crear-worktree.sh` exige kebab-case y el árbol se llama
  // como el trabajador: con 'L1' el arranque muere en la validación del slug.
  portatil: {
    local: true,
    proveedor: 'este portátil (fedora, 14 núcleos)',
    trabajadores: ['l1', 'l2'],
  },
  'flota-1': {
    host: '167.233.249.187',
    usuario: 'root',
    llave: path.join(os.homedir(), '.ssh', 'koigrid_runner'),
    proveedor: 'hetzner/nbg1 cx33 (4 núcleos, 8 GB)',
    trabajadores: ['w1', 'w2'],
  },
}

const NOMBRES = Object.keys(MAQUINAS)

/** Todos los trabajadores esperados, con la máquina en la que deberían estar. */
function trabajadoresEsperados(reg = MAQUINAS) {
  const out = []
  for (const [maquina, m] of Object.entries(reg)) {
    for (const w of m.trabajadores || []) out.push({ trabajador: w, maquina })
  }
  return out
}

/** La máquina de un trabajador, o null si no está declarado en ninguna. */
function maquinaDe(trabajador, reg = MAQUINAS) {
  for (const [nombre, m] of Object.entries(reg)) {
    if ((m.trabajadores || []).includes(trabajador)) return { nombre, ...m }
  }
  return null
}

/**
 * Cruza lo ESPERADO con lo que de verdad está latiendo.
 *
 * @param sesiones  filas de `worktree_sessions` ({ slug, host, last_signal_at })
 * @returns [{ trabajador, maquina, estado, antiguedadMin }]
 *
 * `estado`: 'vivo' | 'callado' | 'ausente'
 *
 * **La ausencia es el dato que importa.** Un panel que solo pinta lo que existe no puede avisar de
 * lo que falta: si `w2` se cae, sin esta comparación simplemente deja de salir y nadie lo nota. Es
 * el mismo principio del parte con las tareas paradas.
 */
function comparar(sesiones, { ahora = new Date(), calladoMin = 15, reg = MAQUINAS } = {}) {
  const vivas = new Map()
  for (const s of sesiones || []) {
    if (!s || !s.slug) continue
    vivas.set(s.slug, s)
  }
  return trabajadoresEsperados(reg).map(({ trabajador, maquina }) => {
    const s = vivas.get(trabajador)
    if (!s || !s.last_signal_at) return { trabajador, maquina, estado: 'ausente', antiguedadMin: null }
    const min = Math.round((new Date(ahora).getTime() - new Date(s.last_signal_at).getTime()) / 60000)
    return { trabajador, maquina, estado: min > calladoMin ? 'callado' : 'vivo', antiguedadMin: min }
  })
}

module.exports = { MAQUINAS, NOMBRES, trabajadoresEsperados, maquinaDe, comparar }
