// lib/cache/questions.ts
// Invalidación del cache server-side de getQuestionValidationCached
// (lib/api/v2/answer-and-save/queries.ts:94, tag 'questions', TTL 1h).
//
// El cache sirve correct_option, explanation, article_number, law_short_name
// y law_name. Cualquier mutación de esos campos debe llamar a esta función
// para que la corrección se propague de inmediato (en vez de esperar al TTL).
//
// Si NO se invalida, los users siguen recibiendo la versión vieja durante
// hasta 60 minutos — incluyendo la respuesta correcta antigua, lo que provoca
// validaciones incorrectas en answer-and-save (impugnaciones legítimas).
//
// Llamadores actuales:
//   - lib/api/verify-articles/queries.ts:updateQuestion (cubre 2 routes)
//   - app/api/generate-explanation/route.ts (regenera explicación con LLM)
//   - app/api/admin/lifecycle/apply-fix/route.ts (apply-fix individual)
//   - app/api/admin/lifecycle/apply-fix-bulk/route.ts (apply-fix batch)
//   - lib/api/v2/dispute/queries.ts (vía fetch a /api/admin/revalidate; legacy)
//
// Best-effort: si revalidateTag lanza (p.ej. fuera de Next runtime, en tests
// sin mock), loggea y sigue. La query real es correcta — solo se sirve cache
// stale hasta el TTL de 1h.

import { revalidateTag } from 'next/cache'

export function invalidateQuestionsCache(): void {
  try {
    // Segundo arg 'max' incluye SWR variants. Coherente con
    // lib/api/profile/queries.ts:invalidateProfileCache y
    // app/api/admin/revalidate/route.ts.
    ;(revalidateTag as (tag: string, mode?: string) => void)('questions', 'max')
  } catch (err) {
    console.warn('[invalidateQuestionsCache] revalidateTag failed (non-critical):', err)
  }
}
