// lib/backlog/perdidaDeContexto.cjs — detecta que un cambio de `docs/roadmap/tareas-pendientes.md`
// se ha llevado por delante el CUERPO de una ficha viva. Núcleo PURO: recibe las dos versiones del
// markdown (texto), no habla con git ni con la BD. (T-428, 31/07/2026)
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
// Con 4-6 sesiones a la vez, este fichero es el que TODAS tocan, y las fichas nuevas se insertan
// todas en el mismo sitio → el conflicto de merge no es la excepción, es lo normal (cuatro veces
// en una sola tarde del 31/07). Resolver ese conflicto quedándose con «su» lado borra el trabajo
// de documentar de la otra sesión, y hasta hoy NADA lo veía:
//
//   · `backlogRegistry.guardrail` mira ids únicos y marcas de cierre. Un id sigue siendo único
//     después de que le borres el cuerpo entero.
//   · `backlog.cjs sync` reconcilia título y prioridad. El cuerpo —que es TODO el contexto— no
//     lo mira nadie.
//   · El push-guard mira claims, no contenido.
//
// O sea: una ficha podía quedarse en una línea con el CI en verde. Pasó dos veces el 31/07 (T-427
// perdió 5 fichas enteras por un cherry-pick; T-428 nace de tres bloques borrados al resolver un
// conflicto), y las dos se recuperaron por CASUALIDAD, porque alguien volvió a abrir la ficha.
//
// ── DÓNDE ACABA ESTO Y EMPIEZA `fichaHuerfana.cjs` (leer antes de tocar cualquiera de los dos) ─
// Son HERMANOS, no copias, y la frontera es exacta:
//
//   · `fichaHuerfana.cjs` parte de la **BD**: una fila VIVA en `backlog_tasks` sin ficha en el
//     markdown. Corre dentro de `backlog.cjs sync`, **informa y no bloquea**, y es la red que
//     recoge lo que llegue por cualquier vía (incluido un push hecho con el escape de aquí).
//   · este parte del **MARKDOWN**: dos versiones del fichero, en el `pre-push`, y **bloquea**.
//
// De ahí salen dos cosas que el otro no puede ver, y son la razón de que exista:
//   1. La ficha **VACIADA**: el id sigue ahí, así que su fila NO es huérfana y para él está sana.
//      Es la mitad del incidente del 31/07.
//   2. El **momento**: él lo cuenta cuando el borrado ya está en `main` y alguien corre `sync`;
//      esto lo para antes de que entre (principio 8: impedir en el punto de escritura).
// Y al revés: él cubre la ficha que NUNCA se escribió, que aquí es invisible por definición
// (no se puede perder lo que no estaba publicado). Se solapan solo en «ficha desaparecida», y ahí
// el solape es a propósito: una red detrás de una puerta, no dos puertas con criterios distintos.
//
// ── QUÉ MIDE, Y POR QUÉ ASÍ ─────────────────────────────────────────────────────────────────
// Dos daños distintos, con nombre propio porque se reparan distinto:
//
//   `desaparecida` — la ficha estaba y ya no está. Es el caso T-427 y no admite matiz: el id se
//     ha ido del fichero sin cerrarse. No necesita umbral.
//   `mermada`      — la ficha sigue, pero su cuerpo ha encogido por encima del umbral. Aquí SÍ
//     hace falta calibrar, porque una reescritura legítima también encoge.
//
// El tamaño se mide en CARACTERES de cuerpo, no en líneas: en este fichero una sola línea puede
// ser un párrafo de 900 caracteres (las fichas se escriben en viñetas largas), así que contar
// líneas trata igual «borré una viñeta de 900 caracteres» y «borré una línea en blanco». Se
// exponen las dos cifras para poder mirarlas, pero el que decide es el de caracteres.
//
// ── LAS EXENCIONES SON LO QUE SOSTIENE LA PRECISIÓN ─────────────────────────────────────────
// Sin ellas el detector grita en los dos casos en los que encoger es lo correcto:
//
//   1. **La ficha se CIERRA en este mismo cambio** (gana el ✅). Cerrar y condensar es el flujo
//      normal. Se sigue reportando como `info` —para que un borrado no se pueda disfrazar de
//      cierre— pero no bloquea.
//   2. **Fichas diminutas.** Una ficha de 200 caracteres que baja a 80 ha perdido el 60% y no ha
//      pasado nada. Hay un SUELO absoluto de caracteres perdidos por debajo del cual no se mira
//      el ratio: sin él, el umbral relativo convierte el ruido en alarma.
//
// Umbrales calibrados sobre los 1.063 commits del fichero — ver `scripts/backlog/sim-perdida-contexto.cjs`.

/**
 * Cabecera de ficha: `### [T-042] 🔴 Título…`
 *
 * El `.*?` es PEREZOSO a propósito: una cabecera puede CITAR otra tarea en su título
 * (`### [T-492] … (la deuda que dejó [T-377])`), y con `.*` codicioso el id capturado era el
 * ÚLTIMO — o sea que la ficha nueva se registraba como si fuera la de T-377 y su cuerpo corto
 * se comparaba contra la ficha larga de verdad: «pierde 85% del cuerpo», push bloqueado, con
 * T-377 intacta. Es la misma confusión que [T-403] arregló en el push-guard de claims: CITAR
 * una tarea no es SER esa tarea. El id propio es siempre el primero de la cabecera.
 */
const RE_CABECERA = /^###\s+.*?\[(T-\d+)\]/

/**
 * Suelo absoluto: por debajo de esto no se mira el ratio. Una ficha corta que se reescribe
 * pierde fácilmente la mitad de su texto sin que se haya perdido nada de valor.
 */
const MIN_CHARS_PERDIDOS = 600

/** Fracción del cuerpo que hay que perder para que cuente, una vez pasado el suelo. */
const RATIO_MERMA = 0.5

/**
 * Trocea el markdown en fichas con su CUERPO.
 *
 * El cuerpo va desde la línea siguiente a la cabecera hasta la próxima cabecera de cualquier
 * nivel (`##` o `###`) — así una ficha nunca se come la sección que viene detrás.
 *
 * @param {string} md
 * @returns {Map<string, {id:string, headline:string, doneMarked:boolean, cuerpo:string, chars:number, lineas:number}>}
 */
function parseFichasConCuerpo(md) {
  const fichas = new Map()
  const lineas = String(md || '').split('\n')
  let actual = null
  const cerrar = () => {
    if (!actual) return
    const cuerpo = actual.buf.join('\n').trim()
    fichas.set(actual.id, {
      id: actual.id,
      headline: actual.headline,
      doneMarked: actual.headline.includes('✅'),
      cuerpo,
      chars: cuerpo.replace(/\s+/g, ' ').trim().length,
      lineas: cuerpo ? cuerpo.split('\n').filter((l) => l.trim()).length : 0,
    })
    actual = null
  }
  for (const linea of lineas) {
    const m = RE_CABECERA.exec(linea)
    if (m) {
      cerrar()
      // Una ficha REPETIDA (dos cabeceras con el mismo id) la caza `fichaDuplicada.cjs`; aquí nos
      // quedamos con la primera para no inventar una pérdida que en realidad es un duplicado.
      actual = fichas.has(m[1]) ? null : { id: m[1], headline: linea, buf: [] }
      continue
    }
    if (actual) {
      if (/^##\s/.test(linea)) cerrar()   // empieza otra sección: la ficha termina aquí
      else actual.buf.push(linea)
    }
  }
  cerrar()
  return fichas
}

/**
 * Compara dos versiones del markdown y devuelve las fichas que han perdido contexto.
 *
 * @param {string} antes    contenido del fichero ANTES del cambio
 * @param {string} despues  contenido DESPUÉS
 * @param {{minChars?:number, ratio?:number}} [opts]
 * @returns {{hallazgos: Array<{id, tipo, severidad, charsAntes, charsDespues, charsPerdidos, ratio, lineasAntes, lineasDespues, motivo}>}}
 */
function findPerdidaDeContexto(antes, despues, opts = {}) {
  const minChars = opts.minChars ?? MIN_CHARS_PERDIDOS
  const ratioMin = opts.ratio ?? RATIO_MERMA
  const A = parseFichasConCuerpo(antes)
  const D = parseFichasConCuerpo(despues)
  const hallazgos = []

  for (const [id, a] of A) {
    const d = D.get(id)

    if (!d) {
      // La ficha entera se ha ido del fichero. No hay umbral que valga: o se cerró (y entonces
      // sigue en el markdown con su ✅) o alguien se la ha llevado.
      hallazgos.push({
        id,
        tipo: 'desaparecida',
        severidad: 'error',
        charsAntes: a.chars,
        charsDespues: 0,
        charsPerdidos: a.chars,
        ratio: 1,
        lineasAntes: a.lineas,
        lineasDespues: 0,
        motivo: 'la ficha ya no está en el fichero (ni abierta ni cerrada)',
      })
      continue
    }

    const perdidos = a.chars - d.chars
    if (perdidos < minChars) continue
    const ratio = a.chars > 0 ? perdidos / a.chars : 0
    if (ratio < ratioMin) continue

    // Se cierra en este mismo cambio: condensar al cerrar es el flujo normal. Se reporta para que
    // un borrado no pueda esconderse detrás de un ✅, pero no bloquea.
    const seCierraAhora = d.doneMarked && !a.doneMarked

    hallazgos.push({
      id,
      tipo: 'mermada',
      severidad: seCierraAhora ? 'info' : 'error',
      charsAntes: a.chars,
      charsDespues: d.chars,
      charsPerdidos: perdidos,
      ratio,
      lineasAntes: a.lineas,
      lineasDespues: d.lineas,
      motivo: seCierraAhora
        ? 'encoge al cerrarse (✅ nuevo): normal al condensar una ficha terminada'
        : `pierde ${Math.round(ratio * 100)}% del cuerpo sin cerrarse`,
    })
  }

  hallazgos.sort((x, y) => y.charsPerdidos - x.charsPerdidos)
  return { hallazgos }
}

/** Los que deben BLOQUEAR (los `info` solo se imprimen). */
function bloqueantes(hallazgos) {
  return (hallazgos || []).filter((h) => h.severidad === 'error')
}

module.exports = {
  parseFichasConCuerpo,
  findPerdidaDeContexto,
  bloqueantes,
  MIN_CHARS_PERDIDOS,
  RATIO_MERMA,
}
