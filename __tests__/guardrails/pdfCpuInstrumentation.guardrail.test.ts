/**
 * @jest-environment node
 */
// GUARDARRAÍL — el coste de CPU de generar un PDF tiene que seguir midiéndose.
//
// ## Por qué existe (T-270, 29/07/2026)
//
// El incidente del 29/07 dejó una pregunta sin responder: ¿cuánto bloquea REALMENTE un render?
// Sin ese número, el umbral de «esto no se renderiza en línea, se encola» es un número elegido a
// ojo — y un umbral inventado se acaba desactivando el día que estorba.
//
// No se podía responder con lo que había: `request_completed` está **muestreado al 10%** para los
// 2xx (`SUCCESS_TIMING_SAMPLE_RATE` en `lib/api/withErrorLogging.ts`), así que de 18 minutos de
// incidente sobrevivían un puñado de duraciones. `temario_pdf_served` y `temario_pdf_stamped`
// NO se muestrean: se emiten en cada petición. Por eso el coste se cuelga de ellos.
//
// El `instanceId` no es un adorno: dice en QUÉ task cayó el render. 36 renders repartidos entre 12
// tasks y 36 sobre la misma task son el mismo número y no el mismo incidente, y esa diferencia es
// justo la que decide si el arreglo es encolar o repartir.
//
// Este test no comprueba que los números sean correctos —eso lo dirá la calibración con datos
// reales— sino que **la instrumentación sigue puesta**. Es barata de borrar sin querer en un
// refactor, y su ausencia no rompe nada: simplemente se deja de poder calibrar, en silencio.

import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')

const RUTA_PUBLICA = 'app/api/temario/[oposicion]/[topic]/pdf/route.ts'
const PREGENERATE = 'lib/temario/pdf/pregenerate.ts'

describe('El coste de CPU de generar un PDF se sigue midiendo (T-270)', () => {
  describe.each([
    ['ruta pública', RUTA_PUBLICA],
    ['pre-generación', PREGENERATE],
  ])('%s', (_nombre, fichero) => {
    const src = leer(fichero)

    it('cronometra el render de @react-pdf', () => {
      expect(src).toMatch(/renderMs/)
      // El cronómetro tiene que envolver al render, no ir suelto en cualquier parte del fichero.
      expect(src).toMatch(/Date\.now\(\)[\s\S]{0,200}renderToBuffer/)
    })

    it('cronometra el sellado con pdf-lib', () => {
      expect(src).toMatch(/stampMs/)
      expect(src).toMatch(/Date\.now\(\)[\s\S]{0,200}stampTopicPdfChrome/)
    })

    it('registra en QUÉ task ocurrió', () => {
      expect(src).toMatch(/instanceId:\s*INSTANCE_ID/)
      // Reutiliza el helper que ya usa `eventLoopLag`, no una copia propia.
      expect(src).toMatch(/from '@\/lib\/observability\/instanceId'/)
    })

    it('el coste viaja en un evento NO muestreado', () => {
      // Si alguien mueve estos números a `request_completed`, el 90% se pierde por muestreo y la
      // calibración vuelve a ser imposible sin que nadie se entere.
      expect(src).toMatch(/eventType: 'temario_pdf_(served|stamped)'[\s\S]{0,400}renderMs/)
    })
  })

  it('la ruta pública distingue un acierto de caché de un render (coste 0 vs coste real)', () => {
    const src = leer(RUTA_PUBLICA)
    // El contador arranca a 0 y solo lo rellena el camino que renderiza: así un acierto de caché
    // queda registrado como lo que es —gratis— en vez de no registrarse.
    expect(src).toMatch(/renderMs:\s*0,\s*stampMs:\s*0/)
  })

  it('el muestreo del 10% que motiva todo esto sigue siendo real (si cambia, revisar)', () => {
    // Si algún día se sube el muestreo al 100%, esta instrumentación deja de ser imprescindible y
    // este guardarraíl debería revisarse en vez de arrastrarse por inercia.
    expect(leer('lib/api/withErrorLogging.ts')).toMatch(/SUCCESS_TIMING_SAMPLE_RATE\s*=\s*0\.1/)
  })
})
