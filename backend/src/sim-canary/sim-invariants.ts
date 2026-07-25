// backend/src/sim-canary/sim-invariants.ts
//
// Vence Sim (canary Fargate) — INVARIANTES de dominio, PURAS (sin NestJS, sin red) para
// testear el juicio sin montar HTTP. Espejo server-side de lib/sim/invariants.ts (el
// backend es self-contained: no importa del lib/ raíz del frontend). Aquí viven solo las
// invariantes que un canary SIN navegador puede comprobar por API.

export interface ServedQuestion {
  law: string;
  article: string;
}

export interface Selection {
  laws: string[];
  articlesByLaw: Record<string, string[]>;
}

export interface InvariantResult {
  name: string;
  ok: boolean;
  detail?: string;
}

/**
 * INVARIANTE NÚCLEO (bug Alfonso #2): ninguna pregunta servida cae fuera de la selección.
 * Ley con artículos elegidos → solo esos; ley sin artículos (entera) → solo pertenencia a
 * la ley. Match tolerante del nombre de ley ("Ley 40/2015").
 */
export function questionsWithinSelection(
  questions: ServedQuestion[],
  selection: Selection,
): InvariantResult {
  const name = 'questions_within_selection';
  const violations: string[] = [];
  for (const q of questions) {
    const key = selection.laws.find((l) => q.law.includes(l) || l.includes(q.law));
    if (!key) {
      violations.push(`${q.law}:${q.article} (ley no seleccionada)`);
      continue;
    }
    const arts = selection.articlesByLaw[key];
    if (arts && arts.length > 0 && !arts.map(String).includes(String(q.article))) {
      violations.push(`${q.law}:${q.article} (fuera de [${arts.join(',')}])`);
    }
  }
  return violations.length === 0
    ? { name, ok: true }
    : {
        name,
        ok: false,
        detail: `${violations.length} fuera: ${violations.slice(0, 5).join('; ')}${violations.length > 5 ? '…' : ''}`,
      };
}

/** INVARIANTE: un listado (leyes/preguntas) llegó no vacío y en tiempo razonable. */
export function nonEmptyAndFast(
  count: number,
  durationMs: number,
  opts: { minCount: number; maxMs: number },
): InvariantResult {
  const name = 'non_empty_and_fast';
  if (count < opts.minCount) return { name, ok: false, detail: `count=${count} < ${opts.minCount}` };
  if (durationMs > opts.maxMs) return { name, ok: false, detail: `${durationMs}ms > ${opts.maxMs}ms` };
  return { name, ok: true };
}

/** Deriva el veredicto de un conjunto de invariantes. */
export function allOk(invariants: InvariantResult[]): { passed: boolean; firstFailure?: string } {
  const bad = invariants.find((i) => !i.ok);
  return bad ? { passed: false, firstFailure: `${bad.name}: ${bad.detail ?? 'violada'}` } : { passed: true };
}
