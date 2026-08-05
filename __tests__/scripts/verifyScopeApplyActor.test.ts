/**
 * `describeApplyActor()` — quién queda escrito en `topic_scope_history.changed_by` cuando
 * `verify-topic-scope.cjs apply` toca `topic_scope` (T-518, 05/08/2026).
 *
 * `topic_scope_history` (T-222) audita por trigger a CUALQUIER escritor de `article_numbers`,
 * pero `changed_by`/`change_reason` son opt-in (`set_config('app.actor', …)` dentro de la misma
 * transacción) porque un trigger no puede adivinarlos. El pipeline `verify:scope apply` — que
 * hoy es de los 31 escritores registrados en `lib/admin/toolWriters.ts` — nunca los seteaba:
 * sus cambios quedaban con `changed_by=NULL`, indistinguibles de cualquier otro escritor.
 *
 * Este test fija el CONTENIDO que se escribe (no la conexión a BD, que cubre
 * `topicScopeAudit.integration.test.ts` con `set_config` a mano) para que quien lea el
 * historial sepa que ese cambio vino del pipeline y no de un `UPDATE` suelto.
 */

const path = require('path')
const { describeApplyActor } = require(path.join(process.cwd(), 'scripts/verify-topic-scope.cjs'))

describe('describeApplyActor()', () => {
  test('identifica el pipeline y la sesión que lo corrió, no solo "pipeline"', () => {
    const { actor } = describeApplyActor('t518-fedora-abc123', 3, false)
    expect(actor).toContain('verify-topic-scope.cjs apply')
    // sidCorto: sin máquina ni azar — mismo criterio que el resto del sistema de sesiones
    expect(actor).toBe('verify-topic-scope.cjs apply:t518')
  })

  test('sin sesión resoluble, no revienta: usa el "?" fail-open de sidCorto', () => {
    const { actor } = describeApplyActor(null, 1, false)
    expect(actor).toBe('verify-topic-scope.cjs apply:?')
  })

  test('el motivo cuenta cuántos cambios y si pasó por la puerta de juicio', () => {
    expect(describeApplyActor('s', 5, false).reason).toBe('verify:scope apply — 5 cambio(s) (auto_safe)')
    expect(describeApplyActor('s', 2, true).reason).toBe(
      'verify:scope apply — 2 cambio(s) (incluye puerta de juicio)'
    )
  })
})
