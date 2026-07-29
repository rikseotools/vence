// __tests__/lib/dailyQuotaConsumePolicy.test.ts
//
// UNIT de la regla de cobro del cupo diario (`debeConsumirCupo`).
//
// Contexto (incidente 29/07/2026, caso Sergio): el contador del plan gratuito lo
// incrementaba SOLO el cliente (`useDailyQuestionLimit.recordAnswer` →
// `/api/v2/daily-question/increment`), desacoplado del guardado y sin idempotencia.
// Medido sobre las tablas completas en 14 días: 41 usuarios free agotaron el tope de
// 25 habiendo respondido una media de 13 preguntas. Sergio: 15 respondidas, 25 cobradas.
//
// La regla nueva: cobra el servidor y SOLO cuando la fila entra por primera vez en
// `test_questions` (`saved_new`). La idempotencia la da el índice único
// `unique_test_question (test_id, question_order)` — sin tabla ni contador extra.
import { debeConsumirCupo } from '@/lib/api/dailyLimit'

describe('debeConsumirCupo — cobro del cupo diario', () => {
  describe('usuario free', () => {
    it('cobra cuando la respuesta se guarda por primera vez', () => {
      expect(debeConsumirCupo('saved_new', false)).toBe(true)
    })

    it('NO cobra si la fila ya existía (reintento de la cola o doble evento del cliente)', () => {
      // Este es el caso que producía el sobrecoste: el mismo answer llegando dos veces.
      expect(debeConsumirCupo('already_saved', false)).toBe(false)
    })

    it('NO cobra si el guardado falló — no se cobra lo que no queda registrado', () => {
      expect(debeConsumirCupo('save_failed', false)).toBe(false)
    })

    it('NO cobra ante un valor desconocido, nulo o vacío (fail-closed a favor del usuario)', () => {
      expect(debeConsumirCupo(undefined, false)).toBe(false)
      expect(debeConsumirCupo(null, false)).toBe(false)
      expect(debeConsumirCupo('', false)).toBe(false)
      expect(debeConsumirCupo('otra_cosa', false)).toBe(false)
    })
  })

  describe('usuario premium', () => {
    it('nunca consume cupo, ni siquiera con la respuesta guardada', () => {
      expect(debeConsumirCupo('saved_new', true)).toBe(false)
      expect(debeConsumirCupo('already_saved', true)).toBe(false)
      expect(debeConsumirCupo('save_failed', true)).toBe(false)
    })
  })

  it('es pura: la misma entrada da siempre el mismo resultado', () => {
    const casos: Array<[string, boolean]> = [
      ['saved_new', false],
      ['already_saved', false],
      ['saved_new', true],
    ]
    for (const [accion, premium] of casos) {
      const primera = debeConsumirCupo(accion, premium)
      expect(debeConsumirCupo(accion, premium)).toBe(primera)
      expect(debeConsumirCupo(accion, premium)).toBe(primera)
    }
  })
})
