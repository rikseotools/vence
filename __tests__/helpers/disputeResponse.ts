/**
 * Constructor de la respuesta del GET de impugnación existente, **validada contra el esquema real**
 * del endpoint (`/api/v2/dispute`).
 *
 * Existe por una razón concreta: hasta el 28/07/2026 los tests de este componente escribían el mock
 * a mano con la forma `{success, data}` mientras el endpoint devolvía `{success, dispute}` desde el
 * refactor `c361fd9a5` (18/03/2026). El mock reproducía la suposición del código, no el contrato,
 * así que los tests estaban en verde con la función **muerta**: el aviso «Ya impugnaste esta
 * pregunta» no se le mostró a nadie durante meses, y quien volvía a una pregunta ya impugnada se
 * comía el error del índice único (44 choques en los 24 días que retiene `validation_error_logs`).
 *
 * Al pasar por `getDisputeResponseSchema.parse`, cualquier divergencia futura entre el contrato y
 * lo que los tests simulan revienta **aquí**, en CI, y no en la cara de un usuario.
 */
import { getDisputeResponseSchema } from '@/lib/api/v2/dispute/schemas'

type Overrides = {
  questionId?: string | null
  status?: string | null
  disputeType?: string
  description?: string
  adminResponse?: string | null
  createdAt?: string | null
  resolvedAt?: string | null
}

/** Respuesta con impugnación previa. Lanza si deja de cumplir el contrato del endpoint. */
export function respuestaConImpugnacion(over: Overrides = {}) {
  return getDisputeResponseSchema.parse({
    success: true,
    dispute: {
      id: '00000000-0000-4000-8000-0000000000aa',
      questionId: over.questionId ?? '00000000-0000-4000-8000-000000000013',
      status: over.status ?? 'pending',
      disputeType: over.disputeType ?? 'tema_incorrecto',
      description: over.description ?? 'Motivo: tema_incorrecto',
      adminResponse: over.adminResponse ?? null,
      createdAt: over.createdAt ?? '2026-07-28T09:58:38Z',
      resolvedAt: over.resolvedAt ?? null,
    },
  })
}

/** Respuesta sin impugnación previa (la pregunta está limpia). */
export function respuestaSinImpugnacion() {
  return getDisputeResponseSchema.parse({ success: true, dispute: null })
}
