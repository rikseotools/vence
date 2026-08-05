// lib/laws/lawNameResuelta.ts
//
// NÚCLEO PURO — qué se puede llamar "ley" y qué se persiste en `test_questions.law_name`.
//
// POR QUÉ EXISTE (T-559, 05/08/2026). El escritor guardaba el literal `'unknown'` cuando el
// cliente no mandaba la ley:
//
//     lawName: req.questionData.article?.law_short_name || 'unknown'   // ← gemelo backend
//
// Un relleno así no es un hueco: es un dato que MIENTE. Aguas abajo nadie distingue
// «no lo sé» de «la ley se llama unknown», y el sistema lo trata como una ley más:
//   · el agregador de artículos problemáticos AGRUPA por `law_name` → funde Excel 365,
//     Word 365 y Access 365 en una sola ley inventada,
//   · la notificación la publica tal cual («2 Artículos Problemáticos: unknown»),
//   · su botón de teoría construye `/teoria/unknown` → 404,
//   · su test intensivo pide `?articles=190,3&law=unknown` y acaba sirviendo otra materia.
// Medido antes del arreglo: 15.109 filas, 253 usuarios, **cero eventos** en seis meses.
// Lo destapó una usuaria escribiendo a soporte.
//
// El arreglo NO es cambiar `'unknown'` por `null` a secas — sería el mismo fallo silencioso
// con otra cara. Las tres reglas de este módulo:
//   1. RESOLVER antes que rellenar (el `article_id` casi siempre está a mano),
//   2. si de verdad no se puede, `null` (honesto) **y un evento**, nunca solo,
//   3. el relleno no entra ni aunque lo mande el cliente.
//
// UN SOLO CRITERIO, VARIOS CONSUMIDORES. `esLeyResuelta` sustituye a las dos copias que
// había sueltas (`ArticulosEstudioPrioritario.isResolvableLaw` y el `if` de
// `TemaTestPage.openArticleModal`), y lo usan también el escudo de la notificación, el
// backfill y el canario. Dos puertas al mismo invariante con criterios distintos no
// protegen: se contradicen.
//
// ⚠️ ESPEJO EN EL BACKEND: `backend/src/test-answers/law-name-resuelta.ts`. El backend es un
// proyecto TS aparte y no puede importar `@/lib`, así que la convención de la casa es COPIA
// + guardarraíl de paridad (igual que `lib/observability/benignSignals.ts`). Si tocas este
// fichero, toca el espejo: `__tests__/guardrails/lawNameResueltaParidad.test.ts` falla si no.

/**
 * Literales que han llegado a persistirse como si fueran el nombre de una ley.
 * NO es una lista de "nombres feos": es la lista de rellenos que producían los
 * escritores y que aguas abajo se pintaban como ley real.
 *
 * En minúsculas; la comparación es case-insensitive y con `trim`.
 */
export const RELLENOS_DE_LEY: readonly string[] = [
  'unknown',    // el relleno del gemelo backend (T-559) y del escritor original (junio/2026)
  'undefined',  // `String(undefined)` colado por el cliente
  'null',       // `String(null)`, mismo origen
  'nan',        // defensivo: cualquier `String(NaN)` que se cuele por el mismo camino
]

/**
 * ¿Este valor identifica una ley DE VERDAD?
 *
 * Devuelve false para el vacío y para los rellenos conocidos. Es el criterio único que
 * decide si algo se puede persistir, enlazar a teoría o publicar en una notificación.
 */
export function esLeyResuelta(lawName: string | null | undefined): boolean {
  if (!lawName) return false
  const v = lawName.trim().toLowerCase()
  if (v === '') return false
  return !RELLENOS_DE_LEY.includes(v)
}

/** Por qué se persistió lo que se persistió. Viaja en el evento para poder triarlo. */
export type MotivoLawName =
  /** El cliente mandó una ley válida. Camino normal. */
  | 'del_cliente'
  /** El cliente no la mandó (o mandó un relleno) y se resolvió desde `article_id`. */
  | 'resuelta_desde_articulo'
  /** Psicotécnica: no cuelga de un artículo por diseño. `null` es correcto, no es un hueco. */
  | 'psicotecnica_sin_ley'
  /** Sin `article_id`: no había con qué resolver (pregunta generada por IA, legacy…). */
  | 'sin_articulo_que_resolver'
  /** HABÍA `article_id` y aun así no se resolvió. Esto SÍ es un defecto: se emite. */
  | 'irresoluble_con_articulo'

export interface EntradaLawName {
  /** Lo que mandó el cliente en `article.law_short_name` (puede ser un relleno). */
  delCliente: string | null | undefined
  /** Lo resuelto contra `articles`→`laws` desde el `article_id`. null si no se pudo. */
  resueltaDesdeArticulo: string | null | undefined
  /** ¿La fila tiene `article_id`? Es lo que distingue "no había con qué" de "falló". */
  tieneArticulo: boolean
  /** Las psicotécnicas no cuelgan de un artículo: su `null` es esperado, no un defecto. */
  esPsicotecnica: boolean
}

export interface DecisionLawName {
  /** Lo que se persiste en `test_questions.law_name`. NUNCA un relleno. */
  lawName: string | null
  /** true = hay que emitir a observabilidad. Un `null` inesperado no se guarda en silencio. */
  emitir: boolean
  motivo: MotivoLawName
}

/**
 * Decide qué se persiste como `law_name` y si el hueco merece un evento.
 *
 * Orden deliberado: primero lo resuelto contra la BD **y solo si el cliente no trajo nada
 * válido**. No al revés — el cliente es la fuente barata (evita un lookup por fila), pero
 * su relleno no puede ganarle a la verdad.
 */
export function decidirLawNamePersistida(entrada: EntradaLawName): DecisionLawName {
  // 1. El cliente trajo una ley de verdad → es el camino normal y no cuesta nada.
  if (esLeyResuelta(entrada.delCliente)) {
    return { lawName: entrada.delCliente!.trim(), emitir: false, motivo: 'del_cliente' }
  }

  // 2. No trajo nada usable (o trajo un relleno) → mandamos lo resuelto desde el artículo.
  if (esLeyResuelta(entrada.resueltaDesdeArticulo)) {
    return {
      lawName: entrada.resueltaDesdeArticulo!.trim(),
      emitir: false,
      motivo: 'resuelta_desde_articulo',
    }
  }

  // 3. Psicotécnica: no tiene ley por diseño. `null` es la respuesta correcta, no un hueco.
  //    Emitir aquí sería ruido garantizado (son miles al día).
  if (entrada.esPsicotecnica) {
    return { lawName: null, emitir: false, motivo: 'psicotecnica_sin_ley' }
  }

  // 4. Sin `article_id` no había con qué resolver. `null` honesto; no es defecto DE ESTE
  //    escritor (el artículo se pierde antes, y eso ya lo vigila el tracking de article_id).
  if (!entrada.tieneArticulo) {
    return { lawName: null, emitir: false, motivo: 'sin_articulo_que_resolver' }
  }

  // 5. Teníamos `article_id` y aun así no salió la ley: artículo huérfano, ley borrada o
  //    lookup caído. Es el ÚNICO caso que se guarda vacío pudiendo haberse llenado → se emite.
  return { lawName: null, emitir: true, motivo: 'irresoluble_con_articulo' }
}

/**
 * Tipo de evento único para el hueco de arriba. Vive aquí (y no suelto en cada escritor)
 * para que los dos gemelos emitan EL MISMO nombre: dos emisores del mismo hecho con
 * nombres distintos no miden el doble, dividen la señal.
 *
 * Vigilado por la regla `law_name_sin_resolver` de `backend/src/alerts/alert-rules.ts`.
 */
export const EVENTO_LAW_NAME_SIN_RESOLVER = 'law_name_sin_resolver'
