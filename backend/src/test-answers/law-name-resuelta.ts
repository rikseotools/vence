// backend/src/test-answers/law-name-resuelta.ts
//
// ⚠️ COPIA PARITARIA de `lib/laws/lawNameResuelta.ts` (frontend Next.js).
//
// El backend es un proyecto TypeScript aparte y no puede importar `@/lib`, así que la
// convención de la casa para lógica compartida frontend↔backend es COPIA + guardarraíl
// de paridad (igual que `lib/observability/benignSignals.ts` ↔ `backend/src/alerts/benign-signals.ts`).
//
// `__tests__/guardrails/lawNameResueltaParidad.test.ts` FALLA si los dos ficheros divergen.
// No edites este sin editar el otro.
//
// POR QUÉ EXISTE (T-559, 05/08/2026): este servicio guardaba el literal `'unknown'` como
// nombre de ley —`req.questionData.article?.law_short_name || 'unknown'`— mientras el gemelo
// de Next ya resolvía la ley desde `article_id` desde junio/2026. El arreglo se aplicó a un
// gemelo y no al otro, y no había nada que lo cazara: 15.109 filas con una ley inventada,
// 253 usuarios, cero eventos, hasta que lo reportó una usuaria.

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
];

/**
 * ¿Este valor identifica una ley DE VERDAD?
 *
 * Devuelve false para el vacío y para los rellenos conocidos. Es el criterio único que
 * decide si algo se puede persistir, enlazar a teoría o publicar en una notificación.
 */
export function esLeyResuelta(lawName: string | null | undefined): boolean {
  if (!lawName) return false;
  const v = lawName.trim().toLowerCase();
  if (v === '') return false;
  return !RELLENOS_DE_LEY.includes(v);
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
  | 'irresoluble_con_articulo';

export interface EntradaLawName {
  /** Lo que mandó el cliente en `article.law_short_name` (puede ser un relleno). */
  delCliente: string | null | undefined;
  /** Lo resuelto contra `articles`→`laws` desde el `article_id`. null si no se pudo. */
  resueltaDesdeArticulo: string | null | undefined;
  /** ¿La fila tiene `article_id`? Es lo que distingue "no había con qué" de "falló". */
  tieneArticulo: boolean;
  /** Las psicotécnicas no cuelgan de un artículo: su `null` es esperado, no un defecto. */
  esPsicotecnica: boolean;
}

export interface DecisionLawName {
  /** Lo que se persiste en `test_questions.law_name`. NUNCA un relleno. */
  lawName: string | null;
  /** true = hay que emitir a observabilidad. Un `null` inesperado no se guarda en silencio. */
  emitir: boolean;
  motivo: MotivoLawName;
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
    return { lawName: entrada.delCliente!.trim(), emitir: false, motivo: 'del_cliente' };
  }

  // 2. No trajo nada usable (o trajo un relleno) → mandamos lo resuelto desde el artículo.
  if (esLeyResuelta(entrada.resueltaDesdeArticulo)) {
    return {
      lawName: entrada.resueltaDesdeArticulo!.trim(),
      emitir: false,
      motivo: 'resuelta_desde_articulo',
    };
  }

  // 3. Psicotécnica: no tiene ley por diseño. `null` es la respuesta correcta, no un hueco.
  //    Emitir aquí sería ruido garantizado (son miles al día).
  if (entrada.esPsicotecnica) {
    return { lawName: null, emitir: false, motivo: 'psicotecnica_sin_ley' };
  }

  // 4. Sin `article_id` no había con qué resolver. `null` honesto; no es defecto DE ESTE
  //    escritor (el artículo se pierde antes, y eso ya lo vigila el tracking de article_id).
  if (!entrada.tieneArticulo) {
    return { lawName: null, emitir: false, motivo: 'sin_articulo_que_resolver' };
  }

  // 5. Teníamos `article_id` y aun así no salió la ley: artículo huérfano, ley borrada o
  //    lookup caído. Es el ÚNICO caso que se guarda vacío pudiendo haberse llenado → se emite.
  return { lawName: null, emitir: true, motivo: 'irresoluble_con_articulo' };
}

/**
 * Tipo de evento único para el hueco de arriba. Vive aquí (y no suelto en cada escritor)
 * para que los dos gemelos emitan EL MISMO nombre: dos emisores del mismo hecho con
 * nombres distintos no miden el doble, dividen la señal.
 *
 * Vigilado por la regla `law_name_sin_resolver` de `backend/src/alerts/alert-rules.ts`.
 */
export const EVENTO_LAW_NAME_SIN_RESOLVER = 'law_name_sin_resolver';
