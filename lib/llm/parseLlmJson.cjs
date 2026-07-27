/**
 * Parser CANÓNICO del JSON que devuelve un LLM. Puro: sin red, sin BD, sin estado.
 *
 * ## Por qué existe (27/07/2026, T-174)
 *
 * Había **cuatro** implementaciones de esto y ninguna sabía de las otras:
 *   · `parseNotasJson` en el backend (borrada el 26/07 con el pre-masticado LLM,
 *     dejando rotos dos scripts que la importaban → typecheck del backend en rojo);
 *   · `parseJson` en `scripts/observabilidad/ab-modelo-notas.cjs` (idéntica);
 *   · y dos variantes **más débiles** e inline en `sim-seguimiento-ciego.cjs` y
 *     `sim-notas-pipeline.cjs`, que solo quitan las vallas y revientan si el
 *     modelo añade una frase antes o después del JSON.
 *
 * Esa última diferencia es justo el fallo que importa: un modelo barato o un
 * prompt largo acaban colando "Aquí tienes el JSON:" delante, y las versiones
 * débiles devuelven excepción donde la fuerte devuelve el objeto.
 *
 * ## Contrato
 *
 * Devuelve el objeto, o `null` si no hay JSON recuperable. **Nunca lanza.** Quien
 * llama decide qué hacer con el `null` — así un documento raro no tumba un lote
 * entero, que es como se comportan los pipelines de generación y los sims.
 *
 * ⚠️ Hay un ESPEJO en `backend/src/llm/parse-llm-json.ts` porque el backend NestJS
 * no puede importar de `lib/` (build separado; intentarlo arrastra medio proyecto
 * al typecheck — pasó de verdad el 27/07). La paridad NO depende de la buena
 * memoria de nadie: `backend/src/llm/parse-llm-json.spec.ts` pasa los MISMOS
 * casos por las dos implementaciones y falla si divergen.
 *
 * @module lib/llm/parseLlmJson
 */

/**
 * @param {unknown} raw Texto crudo del modelo (puede traer vallas ```json, prosa
 *   alrededor, o venir vacío/null).
 * @returns {Record<string, unknown>|null}
 */
function parseLlmJson(raw) {
  // Acotado a texto a proposito: si llega un objeto no es la respuesta de un
  // modelo y String() daria '[object Object]' — mejor null que basura parseada.
  const texto = typeof raw === 'string' ? raw : '';
  const limpio = texto
    .trim()
    // Vallas de código en cualquiera de sus formas: ```json … ``` o ``` … ```
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!limpio) return null;

  try {
    const v = JSON.parse(limpio);
    // Un JSON válido puede ser un número o una cadena; para nuestros usos eso
    // NO es una extracción válida y tratarlo como tal enmascara un fallo del
    // modelo. Solo objetos y arrays.
    return v !== null && typeof v === 'object' ? v : null;
  } catch {
    // Rescate: el modelo añadió prosa alrededor. Nos quedamos con el mayor
    // bloque {...} o [...]. Es lo que separa esta versión de las débiles.
    return rescatarBloque(limpio);
  }
}

function rescatarBloque(texto) {
  // Elegir el delimitador que ABRE ANTES: es el contenedor más externo. Probar
  // siempre `{}` primero devolvía el objeto interior cuando el modelo respondía
  // un array con prosa delante ("Esto: [{...}]" daba {...} en vez de [{...}]).
  // Lo cazó el test, no la lectura del código.
  const candidatos = [
    ['{', '}'],
    ['[', ']'],
  ]
    .map(([abre, cierra]) => ({ a: texto.indexOf(abre), b: texto.lastIndexOf(cierra) }))
    .filter((c) => c.a >= 0 && c.b > c.a)
    .sort((x, y) => x.a - y.a);

  for (const { a, b } of candidatos) {
    try {
      const v = JSON.parse(texto.slice(a, b + 1));
      if (v !== null && typeof v === 'object') return v;
    } catch {
      // seguimos con el siguiente candidato
    }
  }
  return null;
}

module.exports = { parseLlmJson };
