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
    // Seis en el portátil: 14 núcleos y 31 GB, con la carga real medida el 05/08 en 3,91 y la RAM
    // al 51 % con dos vivos. El techo declarado por Manuel es el 80 % de RAM, no el número.
    trabajadores: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'],
    // Un trabajador local es un WORKTREE aislado, uno por trabajador.
    arbol: (w) => `"$HOME/vence-sessions/${w}"`,
    // ── ¿PUEDE CERRAR EL CICLO ENTERO? ────────────────────────────────────────────────────
    // Un trabajador local corre como el propio usuario: alcanza AWS (verificado con
    // `sts get-caller-identity`) y **comparte el candado del deploy** con las sesiones de Manuel,
    // que es un `flock` sobre `/tmp/vence-deploy.lock`. O sea: no puede pisar a nadie.
    // Por eso aquí sí hace el ciclo completo — ejecutar, desplegar, verificar en producción y
    // cerrar—, que es como trabajan las sesiones del portátil.
    puedeDesplegar: true,
  },
  'flota-1': {
    host: '167.233.249.187',
    usuario: 'root',
    llave: path.join(os.homedir(), '.ssh', 'koigrid_runner'),
    proveedor: 'hetzner/nbg1 cx33 (4 núcleos, 8 GB)',
    // Cuatro: medido el 05/08 con dos vivos — carga 1,85 sobre 4 núcleos y 4,6 GB libres de 8.
    trabajadores: ['w1', 'w2', 'w3', 'w4'],
    // En el VPS hay UN clon, del usuario `flota`, y los trabajadores comparten máquina.
    // `~flota` y no `$HOME`: bajo `sudo -u` sin `-H`, HOME sigue siendo el de root y el `cd` cae
    // en un sitio que no es un repo — costó el primer intento de la puerta del clon (05/08).
    arbol: () => '~flota/vence',
    // ⚠️ NO puede desplegar, y NO es una decisión de política: el candado del deploy es un `flock`
    // sobre un fichero LOCAL, así que entre máquinas no hay exclusión ninguna y dos deploys a la
    // vez son posibles. Es [T-485]. Mientras siga así, un trabajador de aquí deja la tarea en
    // `pause --tras-deploy` y la despierta el propio deploy cuando alguien lo lance.
    puedeDesplegar: false,
    porQueNoDespliega: 'el candado del deploy es un flock LOCAL: entre máquinas no hay exclusión (T-485)',
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

/**
 * Dónde vive el clon/worktree de un trabajador, tal cual se escribe en un shell de SU máquina.
 *
 * Va en el registro y no en quien lo usa porque **es distinto por máquina** (worktree por
 * trabajador en el portátil, un clon compartido en el VPS) y porque así sigue valiendo que añadir
 * una máquina sea UNA fila.
 */
function arbolDe(trabajador, reg = MAQUINAS) {
  const m = maquinaDe(trabajador, reg)
  if (!m || typeof m.arbol !== 'function') return null
  return m.arbol(trabajador)
}

/** ¿Este trabajador puede cerrar el ciclo entero, deploy incluido? */
function puedeDesplegar(trabajador, reg = MAQUINAS) {
  const m = maquinaDe(trabajador, reg)
  return { puede: !!(m && m.puedeDesplegar), porQueNo: m ? m.porQueNoDespliega || null : 'no está declarado' }
}

module.exports = { MAQUINAS, NOMBRES, trabajadoresEsperados, maquinaDe, arbolDe, puedeDesplegar, comparar }
