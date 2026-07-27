/**
 * ESPEJO de `lib/llm/parseLlmJson.cjs` para el backend NestJS.
 *
 * Existe porque el backend NO puede importar de `lib/`: son builds separados y
 * cruzar la frontera arrastra ficheros ajenos al typecheck (ocurrió de verdad el
 * 27/07 y puso el CI en rojo). Es la misma convención que ya usan los detectores
 * del sweep, con su test de paridad.
 *
 * ⚠️ Si tocas la lógica, tócala en AMBOS. `parse-llm-json.spec.ts` pasa los
 * mismos casos por las dos implementaciones y falla si divergen — no depende de
 * que nadie se acuerde.
 *
 * Sustituye a `parseNotasJson`, que vivía en `detect-notas-convocatoria` y se
 * borró el 26/07 junto al pre-masticado con LLM. El parser no tenía nada que ver
 * con las notas: era genérico y se lo llevó por delante la limpieza, dejando dos
 * scripts rotos (T-174).
 */

/** Devuelve el objeto/array, o `null` si no hay JSON recuperable. NUNCA lanza. */
export function parseLlmJson(raw: unknown): Record<string, unknown> | null {
  // Acotamos a texto a propósito: si llega un objeto, no es la respuesta de un
  // modelo y String() daría '[object Object]' — mejor null que basura parseada.
  const texto = typeof raw === 'string' ? raw : '';
  const limpio = texto
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!limpio) return null;

  try {
    const v: unknown = JSON.parse(limpio);
    return v !== null && typeof v === 'object'
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return rescatarBloque(limpio);
  }
}

function rescatarBloque(texto: string): Record<string, unknown> | null {
  // Elegir el delimitador que ABRE ANTES: es el contenedor más externo. Probar
  // siempre `{}` primero devolvía el objeto interior cuando el modelo respondía
  // un array con prosa delante. Lo cazó el test, no la lectura del código.
  const candidatos = (
    [
      ['{', '}'],
      ['[', ']'],
    ] as const
  )
    .map(([abre, cierra]) => ({
      a: texto.indexOf(abre),
      b: texto.lastIndexOf(cierra),
    }))
    .filter((c) => c.a >= 0 && c.b > c.a)
    .sort((x, y) => x.a - y.a);

  for (const { a, b } of candidatos) {
    try {
      const v: unknown = JSON.parse(texto.slice(a, b + 1));
      if (v !== null && typeof v === 'object') {
        return v as Record<string, unknown>;
      }
    } catch {
      // seguimos con el siguiente candidato
    }
  }
  return null;
}
