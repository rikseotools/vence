// lib/sessions/recordatorio.cjs — que la regla llegue A MEDIA TAREA, no solo al empezar. PURO.
// (T-495, 03/08/2026)
//
// ── EL PROBLEMA, EN UNA FRASE DE MANUEL ──────────────────────────────────────────────────────
// *«A veces se les olvida, y me he dado cuenta de que si se lo pongo cada poco lo hacen mejor»*.
//
// El método ya se imprime: `claim` suelta el orden entero —¿ya existe? → ¿dónde encaja? → capas →
// vence-sim— con el comando `tools:buscar` ya escrito para esa tarea. Y el `pre-push` BLOQUEA el
// push sin una sola capa. Pero entre esos dos extremos hay horas, y la decisión de *«¿esto ya
// existe?»* o *«¿esto es un silo?»* se toma **en medio**, cuando el recordatorio del principio ya
// está sepultado. Es el principio 10 del sistema de sesiones incumpliéndose contra sí mismo.
//
// ── POR QUÉ NO ES UN TEMPORIZADOR ───────────────────────────────────────────────────────────
// Un texto cada N minutos llega en mitad de una edición, no aporta nada la mayoría de las veces y
// se aprende a saltar — que es como murieron tres guardarraíles el 31/07: no por ser falsos, por
// volverse indistinguibles del ruido. El recordatorio se cuelga de **momentos que ya existen** y
// en los que la regla es aplicable AHORA:
//
//   · **estrenar un fichero** → es exactamente cuando aplica «¿ya existe?». Lo ve el `pre-commit`,
//     que ya mira lo que está en el índice.
//   · **llevar rato trabajando** → lo dice el `heartbeat`, que una sesión invoca precisamente
//     cuando su lease se acerca al límite.
//
// Y el contenido es CONTEXTUAL: el comando de búsqueda va escrito con las palabras del fichero que
// se estrena. Un recordatorio genérico es papel pintado; uno que trae el comando hecho, no.

/** Palabras que no distinguen nada al buscar si algo ya existe. */
const PARADAS = new Set([
  'lib', 'src', 'app', 'test', 'tests', 'spec', 'index', 'utils', 'util', 'helpers', 'helper',
  'scripts', 'components', 'api', 'types', 'cjs', 'ts', 'tsx', 'js', 'jsx', 'sql', 'md', 'json',
  'new', 'nuevo', 'temp', 'tmp',
])

/**
 * Ficheros que estrenar NO significa construir una herramienta: documentación, fichas, migraciones
 * y pruebas. Preguntarles «¿ya existe?» sería ruido, y el ruido es lo que mata al recordatorio.
 */
const NO_ES_HERRAMIENTA = [
  /^docs\//, /\.md$/, /^supabase\/migrations\//, /^__tests__\//, /\.(spec|test)\.[jt]sx?$/,
  /^scratchpad\//, /^\.husky\//, /^public\//, /\.(png|jpg|svg|ico|csv|txt)$/,
]

const esHerramienta = (ruta) => !NO_ES_HERRAMIENTA.some((re) => re.test(String(ruta || '')))

/** Las palabras con las que buscar si eso ya está hecho. Del nombre del fichero, no de la ruta. */
function palabrasDe(ruta) {
  const base = String(ruta || '').split('/').pop() || ''
  return base
    .replace(/\.[^.]+$/, '')
    .split(/[-_.]|(?=[A-Z][a-z])/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !PARADAS.has(w))
    .slice(0, 3)
}

/**
 * ¿Hay que recordar algo por estrenar ficheros?
 *
 * @param añadidos rutas que el commit AÑADE (no las que modifica: modificar algo que ya existe no
 *                 plantea la pregunta «¿ya existe?»).
 * @returns null si no hay nada que decir — el silencio es la respuesta por defecto.
 */
function recordatorioPorFicherosNuevos(añadidos) {
  const nuevos = (añadidos || []).filter(esHerramienta)
  if (!nuevos.length) return null
  const palabras = [...new Set(nuevos.flatMap(palabrasDe))].slice(0, 3)
  return {
    motivo: 'ficheros_nuevos',
    ficheros: nuevos,
    lineas: [
      `📐 Estrenas ${nuevos.length} fichero(s). Antes de seguir, las dos preguntas que evitan rehacer trabajo:`,
      `   1. ¿YA EXISTE?    npm run tools:buscar -- ${palabras.join(' ') || '<palabra>'}`,
      '   2. ¿ES UN SILO?   intégralo en el runbook/sistema que ya lo cubre, y REGÍSTRALO si es una herramienta',
      '   Y las capas antes de pushear (el pre-push exige al menos una): unit · integración · simulación · canary · guardarraíl',
    ],
  }
}

/**
 * ¿Hay que recordar algo por llevar rato?
 *
 * El umbral es alto (90 min, el mismo que el lease) a propósito: recordar cada diez minutos es un
 * temporizador con otro nombre.
 */
/**
 * EL MÉTODO, en un solo sitio. (T-486, 05/08)
 *
 * Lo dijo Manuel dos veces con las mismas palabras: *«si se lo repito cada poco trabajan mejor»*.
 * Estaba escrito aquí dentro, dentro del recordatorio por tiempo, y por tanto solo llegaba a quien
 * pasara por el `heartbeat` — es decir, a las sesiones de persona. **Los trabajadores autónomos no
 * lo veían nunca**, y son justo los que nadie corrige a media tarea.
 *
 * Se saca aquí para que lo consuman los DOS caminos sin copiarlo:
 *   · `recordatorioPorTiempo` → a las 1,5 h de tarea, a una persona;
 *   · `lib/flota/encargo.cjs` → en CADA encargo, a un trabajador.
 *
 * Para un trabajador la cadencia es equivalente a la de una persona sin que haya que temporizar
 * nada: cada tarea es un `claude -p` nuevo, así que el método llega al empezar cada una.
 */
const METODO = [
  '· nada de chapuzas: profesional, robusto, escalable y OBSERVABLE, integrado en lo que ya hay',
  '· ¿lo que estás construyendo ya existe?  npm run tools:buscar -- <palabra>',
  '· nada de silos: engánchalo al runbook o sistema que ya lo cubre',
  '· capas: unit · integración · simulación (vence-sim) · canary · guardarraíl — las que hagan falta',
  '· si estrenas una herramienta, REGÍSTRALA en lib/admin/toolRegistry.ts',
]

function recordatorioPorTiempo(minutosTrabajando, { umbralMin = 90 } = {}) {
  if (!(minutosTrabajando >= umbralMin)) return null
  return {
    motivo: 'lleva_rato',
    lineas: [
      `📐 Llevas ${Math.round(minutosTrabajando / 60)}h con esta tarea. Repaso rápido, que a media tarea es cuando se olvida:`,
      ...METODO.map((l) => `   ${l}`),
    ],
  }
}

module.exports = {
  METODO,
  esHerramienta,
  palabrasDe,
  recordatorioPorFicherosNuevos,
  recordatorioPorTiempo,
}
