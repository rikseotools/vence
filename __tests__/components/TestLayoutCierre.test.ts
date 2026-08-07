/**
 * Guardarraíl del CIERRE de un test en TestLayout ([T-315], 07/08/2026).
 *
 * Origen: feedback `e790c7bf` (Lourdes) — *«se queda colgada… me ocurre cuando termino un test
 * y quiero hacer otro»*. Al terminar, la pantalla esperaba **20 segundos** a que drenara la cola
 * de guardado antes de cerrar el test; hasta entonces no aparecían ni la confirmación ni los
 * botones de repaso, y si el cierre fallaba no aparecía NADA: ni aviso ni forma de reintentar.
 *
 * ⚠️ ALCANCE DE ESTE FICHERO, dicho para que nadie lo lea como más de lo que es: comprueba el
 * CABLEADO sobre el código fuente, no el comportamiento en un navegador. Lo que sí se ejecuta de
 * verdad son las decisiones, que viven en el núcleo puro `lib/tests/cierreDeTest.ts` y tienen sus
 * propios tests. Mismo patrón (y misma limitación) que `TestLayoutReviewButton.test.ts`.
 */

import fs from 'fs'
import path from 'path'

const TESTLAYOUT_PATH = path.join(__dirname, '../../components/TestLayout.tsx')
const src = fs.readFileSync(TESTLAYOUT_PATH, 'utf-8')

describe('TestLayout — cierre del test', () => {
  describe('la espera de drenado', () => {
    it('sale del núcleo puro, no de un número escrito a mano', () => {
      expect(src).toContain('waitForQueueDrain(session.id, ESPERA_DRENADO_MS)')
    })

    it('ya NO espera los 20 s que dejaban la pantalla sin acciones', () => {
      expect(src).not.toContain('waitForQueueDrain(session.id, 20000)')
    })
  })

  describe('la señal que faltaba', () => {
    it('cuando la cola no drena, se EMITE además de escribirlo en la consola', () => {
      // El aviso anterior era solo `console.warn`: 6 apariciones en 10 días, ninguna de la
      // usuaria que escribió, mientras el servidor rellenaba respuestas 2-6 veces al día.
      expect(src).toContain('avisoDeCierre(')
      expect(src).toContain('emitClientEvent(aviso)')
    })
  })

  describe('la salida cuando el cierre falla', () => {
    it('el estado de error PINTA algo (antes no pintaba nada)', () => {
      expect(src).toContain("saveStatus === 'error'")
    })

    it('le dice que sus respuestas están a salvo, porque lo están', () => {
      // localStorage + reintentos de la cola + safety-net del servidor.
      expect(src).toContain('Tus respuestas están a salvo')
    })

    it('ofrece REINTENTAR, y el reintento vuelve a llamar al cierre real', () => {
      expect(src).toContain('reintentarCierreRef.current')
      // Que el botón exista sin reejecutar el cierre sería peor que no tenerlo.
      expect(src).toMatch(/setSaveStatus\('saving'\)[\s\S]{0,120}reintentarCierreRef\.current\?\.\(\)/)
    })
  })
})
