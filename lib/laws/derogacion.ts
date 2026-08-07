// lib/laws/derogacion.ts — ¿el BOE dice que esta ley está DEROGADA ENTERA?
//
// ## Por qué existe ([T-655], 07/08/2026 — lo reporta un usuario, no una alerta)
//
// Iván González (premium, Auxiliar Administrativo de Canarias, feedback `1627e0d4`) avisó de que
// el tema 7 seguía montado sobre la **Ley 8/2015 de Cabildos Insulares**, derogada. Comprobado
// contra el BOE, palabra por palabra: *«Norma derogada, con efectos de 30 de junio de 2026, por
// la disposición derogatoria única de la Ley 3/2026, de 16 de junio»*. Llevábamos **cinco
// semanas** sirviendo 47 artículos escopados de una norma muerta a quien paga por estudiar.
//
// ## Por qué no lo vio nadie: era un punto ciego, no un fallo de triaje
//
// Ninguna de las cuatro vigilancias de leyes mira esto:
//   · `article_annulled_unmarked` — incisos anulados por el TC, POR ARTÍCULO (no la ley entera).
//   · `staleDatedLaw`             — leyes "para el año XXXX" ya pasado (presupuestos anuales).
//   · `law_unverified_source`     — si la fuente está registrada, no si sigue viva.
//   · `laws:vigilar` (hash)       — solo cubre **21 de 738** leyes activas con URL del BOE (2,8%),
//                                   y ésta no estaba entre ellas.
//
// Y la señal SÍ estaba publicada: la API de datos abiertos del BOE la da explícita.
//
// ## La fuente, y por qué esta y no el HTML
//
// `…/legislacion-consolidada/id/<BOE-ID>/analisis` → `data[0].referencias.posteriores[0].posterior[]`,
// **el mismo endpoint y el mismo camino que ya usa `annulledProvisions.ts`** para los incisos del
// TC. Reusar la llamada evita la tercera forma de preguntar lo mismo, que es como nacen los silos.
// Cada entrada trae `relacion.texto` (p.ej. `SE DEROGA`), `texto` (a qué y por qué norma) e
// `id_norma` (el BOE-ID de la norma derogatoria).
//
// ## La distinción que lo hace usable: ENTERA vs PARCIAL
//
// «SE DEROGA» aparece también cuando cae un artículo suelto, y eso NO es motivo para retirar una
// ley del temario. Se distinguen por el campo `texto`:
//   · ENTERA:  `", por Ley 3/2026, de 16 de junio"`        → no nombra preceptos: cae la norma.
//   · PARCIAL: `"el art. 5, por Ley 11/2015, de 29 de dic"` → nombra qué preceptos caen.
// Confundirlas convertiría el detector en ruido —una ley grande acumula derogaciones parciales
// durante años— y un detector ruidoso se acaba ignorando.

/**
 * ⭐ LA FUENTE BUENA, encontrada el 07/08 al cerrar el último caso: el endpoint `/metadatos` del
 * BOE trae **`estatus_derogacion`** ('S'/'N') y **`fecha_derogacion`**. Lo dice el propio BOE, sin
 * heurística ninguna.
 *
 * Se llegó a ella por un fallo del detector: la **Orden HFP/134/2018** (16 preguntas en DOS
 * oposiciones) está sin efectos desde el 08/05/2026 y su `/analisis` devuelve **CERO referencias
 * posteriores** — la nota vive solo en la cabecera del HTML. Es decir: la vía de las referencias
 * **no la podía ver**. Contrastado el campo contra los cinco casos conocidos, acierta en todos:
 *
 * | norma | `estatus_derogacion` | ¿acierta? |
 * |---|---|---|
 * | RDL 8/2015 (Seguridad Social, derogada en PARTE) | `N` | ✅ evita el falso positivo que hubo que calibrar a mano |
 * | Ley 8/2015 Cabildos | `S` (20260630) | ✅ |
 * | RD 557/2011 Extranjería | `S` (20250520) | ✅ |
 * | Orden HFP/134/2018 | `S` (20260508) | ✅ **el que la heurística no veía** |
 * | RDL 5/2015 TREBEP (vigente) | `N` | ✅ |
 *
 * Las referencias siguen usándose, pero para lo que sí saben: decir **por qué norma**.
 */
export function derogadaSegunMetadatos(
  metadatosJson: unknown,
): { derogada: boolean; fecha: string | null } {
  const m = (metadatosJson as any)?.data?.[0] ?? (metadatosJson as any)?.data ?? {}
  const estatus = String(m?.estatus_derogacion ?? '').trim().toUpperCase()
  if (estatus !== 'S') return { derogada: false, fecha: null }
  const f = String(m?.fecha_derogacion ?? '').trim()
  // El BOE la da como AAAAMMDD; se normaliza para poder mostrarla sin volver a parsearla.
  const fecha = /^\d{8}$/.test(f) ? `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}` : null
  return { derogada: true, fecha }
}

/** Una entrada de `referencias.posteriores[].posterior[]` del análisis del BOE. */
export interface ReferenciaPosterior {
  id_norma?: string
  relacion?: { codigo?: string; texto?: string }
  texto?: string
}

export interface Derogacion {
  /** BOE-ID de la norma que deroga (p.ej. 'BOE-A-2026-17189'). */
  porNormaId: string | null
  /** Lo que dice el BOE, literal, para poder citarlo sin reescribirlo. */
  textoLiteral: string
}

/** ¿La relación es una derogación? Tolerante a variantes de redacción del BOE. */
function esRelacionDeDerogacion(relacion?: string): boolean {
  return /\bSE\s+DEROGA/i.test(String(relacion ?? ''))
}

/**
 * ¿El objeto derogado es la NORMA ENTERA?
 *
 * El `texto` de una derogación total no nombra preceptos: empieza directamente por la coma que
 * introduce la norma derogatoria (`", por Ley 3/2026…"`). Si nombra artículos, disposiciones,
 * capítulos o títulos, es parcial y NO retira la ley del temario.
 */
export function esDerogacionTotal(texto: string | undefined | null): boolean {
  let t = String(texto ?? '').trim()
  if (!t) return false
  // Quitar la cláusula de efectos, que va DELANTE del objeto y no dice nada de su alcance:
  // «, con efectos desde el 1 de enero de 2023, el art. 312…». Sin esto, una derogación
  // parcial con fecha de efectos empieza por coma y pasaría por total — que es justo lo que
  // pasó al estrenar el detector con el RDL 8/2015 (Seguridad Social, 674 preguntas activas
  // en 47 temas). Un falso positivo de ese tamaño habría mandado a alguien a retirar del
  // temario la Ley General de la Seguridad Social.
  t = t.replace(/^,?\s*con\s+efectos?\s+[^,]*,\s*/i, ', ').trim()

  // Total = entre la coma y la norma derogatoria NO hay objeto: «, por Ley 3/2026…».
  if (/^,\s*por\s+/i.test(t)) return true
  // Con objeto explícito de norma entera: «la norma, por …», «esta ley, por …».
  return /^(?:la|esta)\s+(?:norma|ley|disposici[oó]n)\s*,\s*por\s+/i.test(t)
}

/**
 * Extrae la derogación TOTAL del análisis del BOE, o `null` si la ley sigue viva.
 *
 * Devuelve la ÚLTIMA que encuentre: si una norma se deroga y su derogatoria a su vez se deroga,
 * lo que vale para decidir es la más reciente publicada.
 */
export function detectarDerogacionTotal(analisisJson: unknown): Derogacion | null {
  const posteriores =
    (analisisJson as any)?.data?.[0]?.referencias?.posteriores?.[0]?.posterior ?? []
  if (!Array.isArray(posteriores)) return null

  let encontrada: Derogacion | null = null
  for (const p of posteriores as ReferenciaPosterior[]) {
    if (!esRelacionDeDerogacion(p?.relacion?.texto)) continue
    if (!esDerogacionTotal(p?.texto)) continue
    encontrada = {
      porNormaId: p?.id_norma ?? null,
      textoLiteral: `${String(p?.relacion?.texto ?? '').trim()}${String(p?.texto ?? '')}`.trim(),
    }
  }
  return encontrada
}

/**
 * Gravedad del hallazgo. **Una ley derogada que NADIE estudia no es una urgencia**; una que
 * sostiene temas vivos sí, y el número de preguntas dice cuánto se está estudiando de una norma
 * que ya no existe. Sin esta graduación, el badge trataría igual una ley huérfana del catálogo
 * que el tema 7 de una oposición con alumnos dentro.
 */
export function gravedadDerogada(opts: { temasQueLaSirven: number; preguntasActivas: number }): 'error' | 'warn' {
  return opts.temasQueLaSirven > 0 ? 'error' : 'warn'
}
