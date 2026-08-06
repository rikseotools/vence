// lib/temario/bloquesTemario.ts
//
// Núcleo PURO de los bloques del temario: de qué bloque es un tema y con qué número
// se le enseña al opositor ("Tema 3" dentro de "Gestión Financiera", aunque en la BD
// sea el 19).
//
// Por qué existe (T-611): esto vivía como una función `getBlockInfo` COPIADA en los
// 131 `app/<oposicion>/temario/[slug]/TopicContentView.tsx`. No era código: era una
// tabla de rangos escrita a mano 131 veces. Se comprobó midiendo el comportamiento
// real de las 131 (n = 1..120): las 131 caben en `{ desde, hasta, bloque, offset }`,
// 0 excepciones, máximo 6 bloques. Al ser dato y no código, se saca a
// `bloquesPorOposicion.ts` y el componente pasa a ser UNO.
//
// La equivalencia con las 131 originales está congelada en
// `__tests__/temario/fixtures/bloques-originales.json` y la verifica un test
// exhaustivo — así el borrado de los originales no pierde la prueba.

/** Un tramo de temas que forman un bloque del temario. */
export interface TramoBloque {
  /** Primer nº de tema (el de la BD) que entra en el bloque. */
  desde: number
  /** Último nº de tema (el de la BD) que entra en el bloque. */
  hasta: number
  /** Nombre del bloque tal y como se enseña ('Bloque II', 'Gestión Financiera'…). */
  bloque: string
  /**
   * Lo que se resta al nº de tema para obtener el que se MUESTRA.
   * Un temario numerado 201..204 dentro del "Bloque II" se enseña como 1..4 → offset 200.
   * 0 = se muestra el mismo número.
   */
  offset: number
}

export interface BloqueDeTema {
  /** '' cuando el temario no tiene bloques (o el tema cae fuera de todos). */
  block: string
  displayNum: number
}

/**
 * Resuelve el bloque y el número visible de un tema.
 *
 * Contrato IDÉNTICO al de las 131 `getBlockInfo` originales, incluido el caso por
 * defecto: un tema que no cae en ningún tramo devuelve `{ block: '', displayNum: n }`
 * — el componente no pinta la etiqueta de bloque y muestra el número tal cual.
 * Ese caso NO es un error: hay temarios planos (sin bloques) y temas fuera de rango.
 *
 * @param tramos tabla de la oposición (puede ir vacía: temario sin bloques)
 * @param topicNumber nº de tema de la BD
 */
export function resolverBloque(
  tramos: readonly TramoBloque[] | undefined,
  topicNumber: number,
): BloqueDeTema {
  for (const t of tramos ?? []) {
    if (topicNumber >= t.desde && topicNumber <= t.hasta) {
      return { block: t.bloque, displayNum: topicNumber - t.offset }
    }
  }
  return { block: '', displayNum: topicNumber }
}
