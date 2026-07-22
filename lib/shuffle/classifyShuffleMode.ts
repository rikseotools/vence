/**
 * Barajar opciones — FASE 1: clasificador de barajabilidad (determinista, sin IA).
 *
 * Decide si las opciones de una pregunta se pueden permutar sin romper su sentido:
 *   - 'no_shuffle'  → una opción se refiere a OTRAS por letra/número/ordinal
 *                     ("A y B son correctas", "las dos primeras", "respuestas 1 y 2").
 *                     Barajar rompería la referencia → NUNCA barajar.
 *   - 'anchor_last' → hay una opción genérica tipo "Ninguna/Todas (las anteriores)".
 *                     Se pueden barajar las DEMÁS y anclar esa al final.
 *   - 'full'        → opciones independientes → barajar libremente.
 *
 * Sesgo de seguridad: un falso negativo (clasificar barajable algo que NO lo era)
 * ROMPE una pregunta; un falso positivo (marcar no barajable de más) es INOCUO
 * (solo se pierde el barajado de esa). Por eso ante la duda se prefiere NO 'full'.
 *
 * Validado a escala: 0 falsos negativos en 5.000 preguntas (3.000 meta-candidatas +
 * 2.000 aleatorias) contra un oráculo de alta precisión. Evolución v1(45% FN) →
 * v2(~15%) → v3.2(0). Diseño: docs/roadmap/barajar-opciones-fase1-spec.md §2.
 */

export type ShuffleMode = 'full' | 'anchor_last' | 'no_shuffle';

export interface QuestionOptions {
  A?: string | null;
  B?: string | null;
  C?: string | null;
  D?: string | null;
  E?: string | null;
}

// Cruces por letra / número / ordinal → 'no_shuffle' (referencia posicional a otras opciones).
const CROSS_PATTERNS: RegExp[] = [
  /\b[abcde]\)?\s*(?:y|,|e)\s*[abcde]\)?\s+son\s+(?:correct|ciert|verdader|fals|incorrect)/i, // "A) y B) son correctas"
  /son\s+(?:correct|ciert)\w*\s+(?:la\s+|las\s+)?[abcde]\s*(?:y|,|e)\s*(?:la\s+)?[abcde]/i,     // "son correctas la B y la C"
  /\bla\s+[abcde]\)?\s+y\s+la\s+[abcde]\b/i,                                                    // "la A y la B"
  /(?:las\s+)?(?:respuestas?|repuestas?|opciones?|letras?)\s+[abcde]\)?\s*(?:y|,|e)\s*[abcde]\)?/i, // "las respuestas A) y B)"
  /(?:respuestas?|repuestas?|opciones?)\s+\d\s*,?\s*\d?\s*(?:y|,|e)\s*\d\s+son/i,                // "respuestas 1, 2 y 3 son"
  /\b\d\s*,\s*\d\s+y\s+\d\s+son\s+(?:correct|ciert)/i,
  /\bambas\b/i, // "ambas" amplio A PROPÓSITO: FN=0 es sagrado, FP es inocuo. Marca de más
                // algún contenido tipo "ambas Cámaras" (pierde barajado, no rompe nada) a
                // cambio de no dejar escapar ningún "ambas ... son correctas". Igual que el
                // clasificador validado a escala (0 FN en 5.000).
  /las\s+(?:dos|tres|cuatro)\s+(?:primeras|[uú]ltimas|opciones|respuestas)/i,
  /los\s+(?:dos|tres|cuatro)\s+(?:primeros|[uú]ltimos)/i,
  /(?:primera|segunda|tercera)\s+y\s+(?:la\s+)?(?:segunda|tercera|cuarta)/i,
];

// Genéricas "todo/nada" → 'anchor_last'.
const ANCHOR_PATTERNS: RegExp[] = [
  /\bningun[ao]\b/i, // "ninguna"/"ninguno" (inocuo si sobre-marca)
  /\b(?:tod[oa]s)\b[^.!?]{0,45}\bson\s+(?:correct|ciert|verdader|fals|incorrect)/i, // "todas (las X) (anteriores) son correctas/falsas" — GENERAL (no lista de sustantivos)
  /\bson\s+tod[oa]s\b/i,                                            // "son todas ciertas"
  /\btod[oa]s\s+(?:las?|los?)\s+(?:dem[aá]s\s+)?(?:[\wáéíóúñ]+\s+)?anteriores/i, // "todas las (demás) X anteriores"
  /\btod[oa]s\s+estas?\b/i,                                         // "todas estas afirmaciones"
  /\btod[oa]s\s+(?:pueden|lo\s+son)\b/i,                            // "todas pueden"
  /(?:dos|tres|cuatro)\s+(?:respuestas?|repuestas?|opciones?)\s+anteriores/i,
  /\ben\s+tod[oa]s\s+(?:los|las)\s+anteriores/i,
  /\btod[oa]s\s+(?:los\s+anteriores|las\s+anteriores)\b/i,
];

const presentOptions = (opts: QuestionOptions): string[] =>
  (['A', 'B', 'C', 'D', 'E'] as const)
    .map((k) => opts[k])
    .filter((v): v is string => v != null && v !== '');

/**
 * Clasifica la barajabilidad de las opciones de una pregunta.
 * El orden importa: 'no_shuffle' (cruces) gana a 'anchor_last' (genéricas).
 */
export function classifyShuffleMode(opts: QuestionOptions): ShuffleMode {
  const values = presentOptions(opts);
  if (values.some((v) => CROSS_PATTERNS.some((r) => r.test(v)))) return 'no_shuffle';
  if (values.some((v) => ANCHOR_PATTERNS.some((r) => r.test(v)))) return 'anchor_last';
  return 'full';
}

/**
 * ¿La explicación referencia letras de opción (A)/B)/"opción C"/"apartado A")?
 * En la Fase 1 solo se barajan preguntas cuya explicación NO cita letras (el 26%
 * letra-anclado espera a la Fase 2 = explicaciones estructuradas sin letras).
 */
export function explanationReferencesLetters(explanation?: string | null): boolean {
  if (!explanation) return false;
  // Normalizar formato ANTES de detectar: las explicaciones usan markdown y las
  // referencias a opción suelen ir en negrita ("es la **B**", "opción **C**"), lo
  // que rompía la adyacencia de los patrones → falso negativo = explicación rota.
  // Quitamos énfasis/formato (* _ ` ~) y comillas/asteriscos y colapsamos espacios.
  const norm = explanation.replace(/[*_`~]+/g, '').replace(/\s+/g, ' ');
  return EXPLANATION_LETTER_PATTERNS.some((r) => r.test(norm));
}

// Referencias a una opción por LETRA o por POSICIÓN/ORDINAL en la explicación. Si
// alguna dispara, barajar rompería la explicación → NO elegible (espera Fase 2).
// Sesgo idéntico al clasificador: 0 falsos negativos es SAGRADO (un FN = explicación
// rota visible); un falso positivo es INOCUO (esa pregunta no se baraja). Por eso los
// patrones son generosos. Clases medidas sobre 77k preguntas elegibles reales (22/07):
// "es la B", ordinales "la cuarta opción", "opción número N", "B es correcta",
// "correcta es la B" escapaban al patrón v1 → falsos negativos = explicación rota.
const EXPLANATION_LETTER_PATTERNS: RegExp[] = [
  /\b[ABCDE]\)/, // "B)" (con paréntesis)
  /\bopci[óo]n(?:es)?\s+[ABCDE]\b/i, // "opción C"
  /\bapartado\s+[ABCDE]\b/i, // "apartado A"
  /\bletra\s+[ABCDE]\b/i, // "letra B"
  /\brespuesta\s+[ABCDE]\b/i, // "respuesta D"
  /\b(?:es|son)\s+(?:la|las)\s+[ABCDE]\b/i, // "es la B", "son las A"
  /\b(?:correct[ao]|incorrect[ao]|cierta|falsa|verdadera|err[óo]nea)\s+(?:es\s+)?(?:la\s+)?[ABCDE]\b/i, // "correcta es la B"
  /\b[ABCDE]\s+(?:es|son|ser[íi]a)\s+(?:la\s+)?(?:correct|incorrect|ciert|fals|verdader|err[óo]ne)/i, // "B es correcta"
  /\b[ABCDE]\s*(?:y|,|e)\s*(?:la\s+)?[ABCDE]\s+son\s+(?:correct|incorrect|ciert|fals|verdader)/i, // "A y B son correctas"
  /\b(?:primera|segunda|tercera|cuarta|quinta|[úu]ltima)\s+(?:opci[óo]n|respuesta|alternativa|afirmaci[óo]n|proposici[óo]n|premisa|sentencia|frase)\b/i, // ordinal + opción/respuesta
  /\bla\s+(?:primera|segunda|tercera|cuarta|quinta|[úu]ltima)\s+(?:es|ser[íi]a|no\s+es)\s+(?:la\s+)?(?:correct|incorrect|ciert|fals|verdader|err[óo]ne|v[áa]lid|nul)/i, // "la primera es falsa"
  /\b(?:opci[óo]n|respuesta)(?:es)?\s+n[uú]mero\s+\d/i, // "opción número 4"
  /\b(?:opciones|respuestas)\s+\d\b/i, // "opciones 1..." (numeradas)
  /\b\d\s*(?:,|y|e)\s*\d\b[^.]{0,30}(?:correct|incorrect|ciert|fals|verdader|v[áa]lid)/i, // "1, 2 y 4 (no pueden ser) correctas"
  /\b(?:la|las)\s+(?:dos|tres|cuatro)\s+(?:primeras|[úu]ltimas)\s+(?:opci|respuesta|alternativa|afirmaci)/i, // "las dos primeras opciones"
];

/**
 * Predicado de elegibilidad de la Fase 1: barajable ⇔ full ∧ explicación sin letras.
 * Se evalúa DINÁMICAMENTE (no se congela): cuando en la Fase 2 una explicación pase
 * a formato estructurado sin letras, la pregunta pasa a ser elegible sin más.
 */
export function isShuffleEligible(q: {
  shuffle_mode?: ShuffleMode | string | null;
  explanation?: string | null;
}): boolean {
  return q.shuffle_mode === 'full' && !explanationReferencesLetters(q.explanation);
}

/**
 * Gate de SERVE (verificación robusta): además del detector determinista, exige que la
 * pregunta esté marcada `shuffle_safety='safe'` (dato verificado + auto-invalidable por
 * trigger, incluye la auditoría LLM del Paso 2). El detector queda como ÚLTIMA LÍNEA
 * barata contra un flag stale/erróneo (defensa en profundidad). Sin backfill → todo
 * 'unverified' → no baraja nada. Diseño: docs/roadmap/barajar-opciones-verificacion-robusta.md.
 */
export function isShuffleServeEligible(q: {
  shuffle_mode?: ShuffleMode | string | null;
  explanation?: string | null;
  shuffle_safety?: string | null;
}): boolean {
  return q.shuffle_safety === 'safe' && isShuffleEligible(q);
}
