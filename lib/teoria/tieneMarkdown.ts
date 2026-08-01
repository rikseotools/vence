// lib/teoria/tieneMarkdown.ts — ¿el texto de un artículo está escrito en markdown? [T-461]
//
// ## Para qué se pregunta esto
//
// `ArticleModal` tiene dos formas de pintar un artículo y hay que elegir una:
//
//   · **con resaltado** (`formatTextContent` → `dangerouslySetInnerHTML`): subraya las frases de la
//     respuesta dentro del artículo, pero NO interpreta markdown.
//   · **con `ReactMarkdown`**: interpreta negritas, encabezados, listas y tablas, pero no resalta.
//
// Mientras los artículos fueron texto plano daba igual. Hoy **683 artículos activos están escritos en
// markdown** —643 con negritas, 566 con encabezados, 561 con listas y 340 con tablas— y por la rama
// del resaltado se sirven en crudo: el opositor ve `**Rango:**` con los asteriscos y las tablas
// deshechas. Afecta a **58.932 preguntas activas**, el 42,7 % del banco.
//
// ## Por qué elegir y no combinar
//
// Combinar exigiría reimplementar un parser de markdown dentro de `formatTextContent` (que trabaja
// con strings de HTML) o mover el resaltado a componentes de `ReactMarkdown`. Lo primero es escribir
// un parser a mano, que es justo lo que no se debe hacer teniendo `react-markdown` en el proyecto.
//
// Y medido, la elección casi no cuesta nada: de los 683 artículos con markdown, **solo 3** contienen
// además alguna de las frases que el resaltado busca (son literales de la Ley 40/2015 sobre altos
// cargos y órganos directivos). O sea: se recupera el formato en 683 y se pierde el subrayado en 3.

/**
 * Marcas de markdown que el resaltado NO sabe pintar y que `ReactMarkdown` sí. Se exige una señal
 * inequívoca: un asterisco suelto o un guion al principio de una línea aparecen en texto legal
 * corriente, así que solo cuentan los pares y las estructuras completas.
 */
const SENALES: RegExp[] = [
  /\*\*[^*\n]+\*\*/, //     negrita **así**
  /^\s*#{1,6}\s+\S/m, //    encabezado ## así
  /^\s*\|.*\|\s*$/m, //     fila de tabla | a | b |
  /^\s*[-*]\s+\S.*\n\s*[-*]\s+\S/m, // lista de DOS o más elementos seguidos
]

/**
 * ¿Conviene pintar este artículo con `ReactMarkdown` en vez de con el resaltado?
 *
 * Devuelve `false` para texto plano, que es la inmensa mayoría del banco: ahí el resaltado sigue
 * siendo lo mejor y no se toca nada.
 */
export function tieneMarkdown(content: string | null | undefined): boolean {
  if (!content) return false
  return SENALES.some((re) => re.test(content))
}

/**
 * Quita las marcas de markdown para una VISTA PREVIA (un recorte de 300 caracteres bajo la pregunta).
 *
 * Ahí no se puede renderizar markdown —el recorte parte el texto por la mitad y dejaría etiquetas a
 * medias— pero tampoco se pueden servir los asteriscos en crudo, que es lo que pasaba: la tarjeta
 * mostraba «**Rango:** Ley autonómica de Andalucía» con los asteriscos a la vista. Se limpian y se
 * lee como prosa, que es lo que una vista previa quiere ser.
 */
export function limpiarMarkdown(content: string | null | undefined): string {
  if (!content) return ''
  return content
    .replace(/^\s*#{1,6}\s+/gm, '')      // encabezados
    .replace(/\*\*([^*\n]+)\*\*/g, '$1') // negrita
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2') // cursiva
    .replace(/`([^`\n]+)`/g, '$1')        // código
    .replace(/^\s*\|.*\|\s*$/gm, '')     // filas de tabla enteras
    .replace(/^\s*[-*]\s+/gm, '')        // viñetas
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
