// lib/teoria/encabezadoArticulo.ts
// QUÉ SE LEE en la línea de un artículo del temario, cuando la ley no nos dio rúbrica.
//
// POR QUÉ EXISTE (T-596, 05/08/2026). La tarjeta del temario pintaba su encabezado así:
//
//     {article.title && <h3 …>{article.title}</h3>}
//
// es decir, **colgado de un campo que la mitad del banco no tiene**. Con `title` a NULL la tarjeta se
// servía con el número pelado y el botón «Hacer test», y ni una línea de texto — aunque el artículo
// tuviera su contenido entero guardado (art. 116 CE: 1.898 caracteres en BD, tarjeta vacía). Lo
// reportó un premium que estudiaba: *«no aparece el Título V, saltáis del artículo 107 al 117»*.
// Tenía razón en lo que veía y se equivocaba en la causa — el contenido estaba, no se pintaba.
//
// Medido en todo el banco antes de arreglarlo: **13.952 artículos activos (23,0 %)** tienen texto y
// `title` NULL; 11.646 en leyes que algún `topic_scope` usa. Por eso el arreglo es de RENDER y no un
// backfill de rúbricas: catorce mil no se rellenan a mano, y el que se importe mañana volvería a
// nacer roto. Aquí la regla es una sola y vale para todos, incluidos los que aún no existen.
//
// El extracto NO pretende ser una rúbrica: es la primera línea del artículo, que es exactamente lo
// que ya se veía en los que sí tenían `title` — porque en ellos el campo venía relleno con el propio
// texto del artículo, no con su epígrafe oficial (comprobado en CE 107 y 108). O sea que esto
// UNIFORMA lo que el usuario ve, no inventa un formato nuevo.

/** Lo mínimo que hace falta para decidir el encabezado. Deliberadamente laxo: lo llaman 131 vistas. */
export interface ArticuloEncabezable {
  title?: string | null
  content?: string | null
}

/** Longitud del extracto. La tarjeta ya trunca por CSS (`truncate`); esto evita mandar un texto enorme. */
export const LARGO_EXTRACTO = 120

/**
 * Quita el marcado que el contenido trae (se guarda en markdown y se pinta con `MarkdownContent`),
 * para que el encabezado no enseñe asteriscos ni almohadillas sueltas.
 */
function limpiarMarcado(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, ' ')     // bloques de código
    .replace(/<[^>]+>/g, ' ')            // html suelto
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // imágenes
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // enlaces → su texto
    .replace(/[*_`>#]+/g, ' ')           // énfasis, citas, encabezados
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Corta por PALABRA y no a mitad de una. Devuelve el texto tal cual si ya cabe: añadir «…» a algo
 * que no se ha recortado es mentirle al lector sobre que hay más.
 */
function recortar(s: string, max: number): string {
  if (s.length <= max) return s
  const corte = s.slice(0, max)
  const ultimo = corte.lastIndexOf(' ')
  return `${(ultimo > max * 0.5 ? corte.slice(0, ultimo) : corte).trimEnd()}…`
}

/**
 * Qué texto va en el encabezado del artículo.
 *
 *   1. La rúbrica (`title`) si la hay — es la buena y manda siempre.
 *   2. Si no, un extracto del contenido, que es lo que evita la tarjeta muda.
 *   3. `null` solo si de verdad no hay NADA que enseñar (ahí la tarjeta se queda con su número, que
 *      es el comportamiento honesto: no hay texto que ocultar).
 *
 * Devolver `null` en vez de cadena vacía es a propósito: el JSX lo usa como condición y `''` es
 * falsy pero se cuela en comparaciones; `null` obliga a tratar el caso.
 */
export function encabezadoArticulo(a: ArticuloEncabezable | null | undefined, max = LARGO_EXTRACTO): string | null {
  if (!a) return null

  const titulo = (a.title ?? '').trim()
  if (titulo) return titulo

  const cuerpo = limpiarMarcado(a.content ?? '')
  if (!cuerpo) return null

  return recortar(cuerpo, max)
}

/**
 * ¿Esta fila se serviría MUDA? (número sin una línea de texto). Es la misma pregunta que hace el
 * detector de salud, y vive aquí para que detector y render no puedan discrepar: si mañana cambia
 * el criterio del encabezado, el que mide y el que pinta cambian a la vez.
 */
export function articuloSinTextoVisible(a: ArticuloEncabezable | null | undefined): boolean {
  return encabezadoArticulo(a) === null
}
