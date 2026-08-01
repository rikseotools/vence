// lib/api/platform-stats/shared.ts — la parte de las cifras de volumen que puede viajar al NAVEGADOR.
//
// ## Por qué está separada de `queries.ts`
//
// Lo cazó la prueba en navegador, no un test: el hook de cliente importaba `queries.ts` para sacar
// `formatVolumen` y con ello arrastraba la cadena `getDb → postgres → tls` al bundle. El navegador
// respondía `Module not found: Can't resolve 'tls'` y la página se quedaba **sin footer y sin CTA**.
//
// Regla que deja fijada: lo que consuma un componente `'use client'` no puede vivir en el mismo
// fichero que la consulta a BD, por muy pura que sea la función.

export interface PlatformStats {
  /** Preguntas activas servibles: legislativas + psicotécnicas. */
  preguntas: number
  /** Oposiciones que PREPARAMOS (is_active), no el catálogo entero. */
  oposiciones: number
  /** Leyes con al menos una pregunta activa. */
  leyes: number
}

/**
 * Suelo garantizado. Si la consulta falla, la página sigue diciendo algo cierto en vez de romperse o
 * de enseñar un cero. Son valores DEFENSIVAMENTE BAJOS respecto a lo medido el 01/08/2026
 * (145.206 · 124 · 1.137): nunca deben prometer de más.
 */
export const MINIMOS_GARANTIZADOS: PlatformStats = { preguntas: 100000, oposiciones: 100, leyes: 150 }

/**
 * Formatea una cifra para decírsela a una persona: se redondea A LA BAJA al millar (o al centenar si
 * es pequeña) y se le antepone «+». Nunca hacia arriba — la cifra que enseñamos tiene que ser una
 * que podamos sostener, y redondear al alza es prometer preguntas que no existen.
 *
 * Se redondea en vez de dar el número exacto porque «145.206» envejece en cuanto se activa una
 * pregunta y además se lee peor que «+145.000».
 *
 * OJO con el separador: en español los números de CUATRO cifras no lo llevan («7000») y a partir de
 * cinco sí («145.000»). Es `minimumGroupingDigits=2` del CLDR español, y `toLocaleString` lo aplica.
 */
export function formatVolumen(n: number): string {
  if (n < 100) return String(n)
  const paso = n >= 10000 ? 1000 : 100
  const redondeado = Math.floor(n / paso) * paso
  return '+' + redondeado.toLocaleString('es-ES')
}
