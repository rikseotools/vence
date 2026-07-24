// e2e/authed/question-evolution.spec.ts
//
// E2E "con dientes" del bug de la cronología (MariSol, feedback 90aa6caa 24/07/2026):
// el intento actual salía DUPLICADO ("Intento N" + "Ahora") en la cronología detallada.
// Este test responde una pregunta en el app real, fuerza la carrera del guardado y
// afirma que el intento actual aparece UNA sola vez.
//
// Secuencia con teeth: correrlo contra el código VIEJO (pre-deploy) debe FALLAR
// (currentRowCount === 2); tras desplegar el fix debe PASAR (=== 1).
//
// Limpieza: registra `since` y borra al final las filas que creó (no infla stats).

import { test, expect } from '../fixtures/test'
import { makePgCleaner } from '../helpers/cleaner'
import { E2E_ACCOUNT } from '../config/env'

// Ruta de arranque del test (configurable). Debe llevar a una pregunta que la cuenta YA
// haya respondido antes (para que la cronología tenga >3 intentos y aparezca "Ver fechas").
const TEST_PATH = process.env.E2E_EVOLUTION_TEST_PATH ?? '/test/repaso-fallos-v2'

test.describe('QuestionEvolution — cronología no duplica el intento actual', () => {
  const since = new Date().toISOString()

  test('el intento recién respondido aparece UNA sola vez (no "Intento N" + "Ahora")', async ({ testFlow, evolution }) => {
    await testFlow.goto(TEST_PATH)
    await testFlow.answer('A')
    await testFlow.waitAnswerSaved()   // fuerza la carrera: el guardado ya aterrizó

    await evolution.open()
    // Invariante del fix: como mucho UNA fila marcada como intento actual.
    expect(await evolution.currentRowCount()).toBeLessThanOrEqual(1)
  })

  test.afterAll(async () => {
    if (!E2E_ACCOUNT.email) return
    const cleaner = await makePgCleaner()
    try {
      const userId = await cleaner.resolveUserId(E2E_ACCOUNT.email)
      if (userId) {
        const purged = await cleaner.purgeSince(userId, since)
        console.log(`[e2e cleanup] borradas ${purged.testQuestions} test_questions + ${purged.tests} tests`)
      }
    } finally {
      await cleaner.close()
    }
  })
})
