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
    // ── APAGADA PARA EL REPARTO AUTOMÁTICO (05/08/2026) ──────────────────────────────────
    // Orden de Manuel: «no uses trabajadores locales porque voy a abrir consolas y sesiones y se
    // me va a colgar el ordenador». El portátil es SU sitio de trabajo, y seis autónomos
    // compitiendo por los mismos 14 núcleos con sus sesiones abiertas no es un problema de
    // capacidad media, es que se le queda parado cuando lo está usando.
    //
    // `reparte: false` los saca de `vigilar` y de `repartir`, pero NO los borra: siguen
    // declarados, siguen saliendo en el panel, y `flota -- encargar l3 --tarea T-nnn` los usa
    // igual. Es «no le des trabajo tú solo», no «no existen» — borrarlos habría perdido el
    // registro de sus árboles y con él la capacidad de rescatarlos.
    reparte: false,
    proveedor: 'este portátil (fedora, 14 núcleos)',
    // Seis en el portátil: 14 núcleos y 31 GB, con la carga real medida el 05/08 en 3,91 y la RAM
    // al 51 % con dos vivos. El techo declarado por Manuel es el 80 % de RAM, no el número.
    trabajadores: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'],
    // Un trabajador local es un WORKTREE aislado, uno por trabajador.
    arbol: (w) => `"$HOME/vence-sessions/${w}"`,
    // Dónde vive el `<w>.env` de cada trabajador. Es una convención DE LA MÁQUINA, no de si el
    // proceso corre aquí o no (T-617): en el portátil los crea `flota lanzar` bajo el HOME; en el
    // VPS los pone `arrancar-trabajador.sh` en /etc con permisos 0600. Estaba deducido de
    // `local`, lo que fue accidentalmente correcto mientras «local» solo podía ser el portátil —
    // al permitir que el supervisor corra en el VPS, esa deducción pasa a apuntar al sitio
    // equivocado y el supervisor no encontraría el entorno de sus propios trabajadores.
    dirEntorno: path.join(os.homedir(), '.vence-flota'),
    // ── ¿PUEDE CERRAR EL CICLO ENTERO? ────────────────────────────────────────────────────
    // Un trabajador local corre como el propio usuario: alcanza AWS (verificado con
    // `sts get-caller-identity`) y **comparte el candado del deploy** con las sesiones de Manuel,
    // que es un `flock` sobre `/tmp/vence-deploy.lock`. O sea: no puede pisar a nadie.
    // Por eso aquí sí hace el ciclo completo — ejecutar, desplegar, verificar en producción y
    // cerrar—, que es como trabajan las sesiones del portátil.
    puedeDesplegar: true,
    // El usuario ya tiene sus credenciales de git de siempre: nunca hizo falta nada especial.
    tieneCredencialesGit: true,
  },
  'flota-1': {
    host: '167.233.249.187',
    usuario: 'root',
    llave: path.join(os.homedir(), '.ssh', 'koigrid_runner'),
    proveedor: 'hetzner/nbg1 cx33 (4 núcleos, 8 GB)',
    // Cuatro: medido el 05/08 con dos vivos — carga 1,85 sobre 4 núcleos y 4,6 GB libres de 8.
    trabajadores: ['w1', 'w2', 'w3', 'w4'],
    // ── UN CLON, PERO UN ÁRBOL POR TRABAJADOR (T-592) ───────────────────────────────────
    // En el VPS los trabajadores comparten `~flota/vence` como base (ahí vive `.git`, y de ahí
    // sale `npm ci`), pero **cada uno trabaja en su PROPIO worktree**, igual que en el portátil:
    // `arrancar-trabajador.sh` los crea en `~flota/vence-sessions/<w>` (`crear-worktree.sh`), no
    // en la base. Antes esto devolvía `~flota/vence` para TODOS — la puerta del clon
    // (`actualizacion.cjs`) y el rescate automático (`flota.cjs rescatar`) llevaban desde el
    // 05/08 mirando ese árbol compartido, que no tiene dueño, nunca se ensucia y siempre está en
    // `main`. Resultado medido: SIEMPRE «al día», así que ni actualizaban ni rescataban el árbol
    // real de NINGÚN trabajador — w2 llegó a ir 127 commits por detrás sin que nada lo notara, y
    // un turno que terminó con el árbol a medias se quedó así indefinidamente, invisible para el
    // supervisor porque miraba un árbol que no era el suyo.
    // `~flota` y no `$HOME`: bajo `sudo -u` sin `-H`, HOME sigue siendo el de root y el `cd` cae
    // en un sitio que no es un repo — costó el primer intento de la puerta del clon (05/08).
    arbol: (w) => `~flota/vence-sessions/${w}`,
    // Aquí los escribe `arrancar-trabajador.sh`, en /etc y con permisos 0600 (T-617).
    dirEntorno: '/etc/vence-flota',
    // ⚠️ NO puede desplegar, y NO es una decisión de política: el candado del deploy es un `flock`
    // sobre un fichero LOCAL, así que entre máquinas no hay exclusión ninguna y dos deploys a la
    // vez son posibles. Es [T-485]. Mientras siga así, un trabajador de aquí deja la tarea en
    // `pause --tras-deploy` y la despierta el propio deploy cuando alguien lo lance.
    puedeDesplegar: false,
    porQueNoDespliega: 'el candado del deploy es un flock LOCAL: entre máquinas no hay exclusión (T-485)',
    // ── ESTA MÁQUINA no puede empujar, tenga quien la llame credenciales o no (T-628) ────────
    // Es una propiedad DE LA MÁQUINA, no de quien pregunta — y esa distinción es la que faltaba.
    // `necesitaSegundaFase` (rescate.cjs) usaba `.local` para decidir si el push del propio
    // trabajador iba a funcionar, pero `.local` responde "¿el que llama está en la misma
    // máquina que el trabajador?", no "¿esta máquina tiene con qué empujar?". Coinciden siempre
    // en el portátil (quien llama TIENE sus credenciales) pero NO aquí: el supervisor systemd
    // corre con `VENCE_FLOTA_AQUI=flota-1` (T-617, valor real verificado en
    // `/etc/vence-flota/supervisor.env`), así que para él `maquinaDe('w1').local` da `true` —
    // y con la lógica vieja eso bastaba para decir "no hace falta rematar, su propio push vale",
    // cuando ese push NUNCA vale aquí. Medido ejecutando `maquinaDe('w1')` con ese mismo
    // `VENCE_FLOTA_AQUI` (el de producción, no uno de prueba): `.local` sale `true` y
    // `necesitaSegundaFase` decía `hace_falta:false` con 2 commits fuera de todo remoto.
    tieneCredencialesGit: false,
    porQueNoTieneCredencialesGit: 'los trabajadores no tienen credencial de git en esta máquina (T-628)',
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

/**
 * Los que reciben trabajo POR SU CUENTA (`vigilar` y `repartir`).
 *
 * Distinto de `trabajadoresEsperados`, que son todos los declarados: una máquina con
 * `reparte: false` sigue existiendo, sigue en el panel y sigue aceptando un encargo explícito
 * (`flota -- encargar l3 --tarea T-nnn`) — lo que no hace es recibirlo sola. Separarlo importa
 * porque el panel y el rescate tienen que seguir viendo a TODOS: un trabajador que desaparece
 * del registro se lleva con él la ruta de su árbol, y con ella lo que hubiera sin empujar.
 */
function trabajadoresQueReciben(reg = MAQUINAS) {
  return trabajadoresEsperados(reg).filter(({ maquina }) => reg[maquina].reparte !== false)
}

// ── ¿DESDE QUÉ MÁQUINA SE ESTÁ EJECUTANDO ESTO? (T-617, 06/08) ────────────────────────────
// `local: true` estaba CLAVADO en el portátil, lo que daba por hecho que el supervisor corre
// siempre ahí. Y esa suposición es justo lo que dejaba la flota parada: el programador es un
// proceso en primer plano en el portátil de Manuel, así que se para cuando él cierra el portátil
// —medido el 06/08: cuatro trabajadores ociosos siete horas, con los últimos encargos a las
// 11:17—. Para que el supervisor pueda vivir en el VPS, «local» tiene que ser una PREGUNTA
// (¿estoy en esa máquina?) y no una constante.
//
// **Lo declara quien arranca el proceso**, igual que `VENCE_SESSION_ROLE` y `VENCE_SESSION_HOME`
// [T-539], y por el mismo motivo: el proceso no puede averiguarlo de forma fiable por su cuenta.
// Se probó por `hostname` y no sirve — en un contenedor devuelve un id efímero (`32351262e6ed`),
// así que el portátil se habría declarado remoto a sí mismo y todo habría intentado ir por SSH.
//
// Sin declarar, el comportamiento es EXACTAMENTE el de antes (el portátil es local): esto no
// cambia nada para quien no lo use.
const aquiDeclarado = () => String(process.env.VENCE_FLOTA_AQUI || '').trim() || null

/**
 * ¿Este proceso corre EN esa máquina (y por tanto sus comandos van sin SSH)?
 * @param nombreMaquina  clave de MAQUINAS ('portatil', 'flota-1'…)
 */
function esLocal(nombreMaquina, reg = MAQUINAS) {
  const aqui = aquiDeclarado()
  if (aqui) return nombreMaquina === aqui
  return Boolean(reg[nombreMaquina] && reg[nombreMaquina].local)
}

/**
 * La máquina de un trabajador, o null si no está declarado en ninguna.
 *
 * `local` se RESUELVE aquí, en un solo sitio, para que los once puntos que lo consultan no tengan
 * que saber nada de esto — y para que no aparezca un segundo criterio de «¿estoy en casa?», que es
 * como nacieron los cinco escritores de `seguimiento_url` [T-130].
 */
function maquinaDe(trabajador, reg = MAQUINAS) {
  for (const [nombre, m] of Object.entries(reg)) {
    if ((m.trabajadores || []).includes(trabajador)) {
      return { nombre, ...m, local: esLocal(nombre, reg) }
    }
  }
  return null
}

/**
 * ¿Se puede alcanzar esta máquina desde donde estoy? Devuelve el motivo si NO.
 *
 * Una máquina que no es local y no declara `host` es INALCANZABLE: el portátil no tiene `host`
 * porque nunca hizo falta (siempre se ejecutaba desde él). Visto desde el VPS sí hace falta, y sin
 * esta comprobación se construiría un comando `ssh` sin destino que falla con un error críptico.
 * Mejor decirlo: es la diferencia entre «no puedo llegar ahí» y «algo raro con ssh».
 */
function inalcanzable(maquina) {
  if (!maquina) return 'el trabajador no está declarado en ninguna máquina'
  if (maquina.local) return null
  if (!maquina.host) {
    return `la máquina "${maquina.nombre}" no declara host, así que no se puede alcanzar por SSH `
      + `desde aquí (VENCE_FLOTA_AQUI=${aquiDeclarado() || 'sin declarar'})`
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
 * Dónde vive el WORKTREE PROPIO de un trabajador, tal cual se escribe en un shell de SU máquina.
 *
 * Va en el registro y no en quien lo usa porque **la ruta cambia por máquina** (bajo el `$HOME`
 * del usuario en el portátil, bajo `~flota` en el VPS) y porque así sigue valiendo que añadir una
 * máquina sea UNA fila. Lo que NO cambia entre máquinas es que cada trabajador tiene el SUYO: aquí
 * nunca se devuelve el clon base compartido (T-592) — quien lea esto para decidir si un árbol está
 * al día o sucio necesita el árbol donde ese trabajador de verdad escribe.
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

/**
 * ¿Puede la MÁQUINA de este trabajador empujar a git por su cuenta? (T-628)
 *
 * A propósito NO usa `.local`: esa pregunta es "¿quien llama está en la misma máquina que el
 * trabajador?", que depende de `VENCE_FLOTA_AQUI` del LLAMADOR — y en el VPS puede dar `true`
 * (el supervisor systemd corre con `VENCE_FLOTA_AQUI=flota-1`) sin que eso cambie en nada que
 * la máquina siga sin credencial. Esta función responde la pregunta que de verdad importa para
 * decidir si hace falta rematar el rescate desde otro sitio.
 */
function tieneCredencialesGit(trabajador, reg = MAQUINAS) {
  const m = maquinaDe(trabajador, reg)
  return {
    puede: !!(m && m.tieneCredencialesGit),
    porQueNo: m ? m.porQueNoTieneCredencialesGit || null : 'no está declarado',
  }
}

module.exports = {
  MAQUINAS, NOMBRES, trabajadoresEsperados, trabajadoresQueReciben, maquinaDe, arbolDe,
  puedeDesplegar, tieneCredencialesGit, comparar, esLocal, inalcanzable,
}
