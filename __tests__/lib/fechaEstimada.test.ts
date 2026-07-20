/**
 * @jest-environment node
 */
// Guardarraíl contra publicar fechas que nos hemos inventado.
//
// Fallo real (20/07/2026): 11 hitos estaban `upcoming` con la fecha ya pasada. Siete tenían
// `origen='estimacion'` — nadie las había publicado, eran marcadores de posición nuestros, y
// sus títulos lo decían ("Examen (primer ejercicio) - pendiente de fecha"). El dato en BD
// estaba BIEN etiquetado; lo que fallaba era el render, que pintaba `formatDateCorta(fecha)`
// sin mirar `origen`. Consecuencia: el opositor veía una fecha de examen inventada, y ese
// mismo hito alimentaba el `startDate` de un Event de schema.org → la fecha falsa se
// publicaba a Google como un evento real.
//
// La columna `fecha_aproximada` existía justo para esto y no la leía nadie salvo un test.
import {
  esFechaEstimada,
  etiquetaFechaHito,
  hitoParaSchemaEvent,
  ETIQUETA_SIN_FECHA,
  type HitoConFecha,
} from '@/lib/convocatoria/fechaEstimada'

const fmt = (f: string) => `FECHA(${f})`
const h = (over: Partial<HitoConFecha> = {}): HitoConFecha => ({
  fecha: '2026-06-01',
  titulo: 'Examen (primer ejercicio)',
  status: 'upcoming',
  origen: 'registro',
  ...over,
})

describe('fechas estimadas — no publicar lo que nos hemos inventado', () => {
  it('detecta la estimación por `origen`', () => {
    expect(esFechaEstimada(h({ origen: 'estimacion' }))).toBe(true)
    expect(esFechaEstimada(h({ origen: 'registro' }))).toBe(false)
  })

  it('detecta la estimación también por `fecha_aproximada` (columna antigua que convive)', () => {
    expect(esFechaEstimada(h({ origen: null, fechaAproximada: true }))).toBe(true)
  })

  it('un hito de fuente oficial SÍ muestra su fecha', () => {
    expect(etiquetaFechaHito(h(), fmt)).toBe('FECHA(2026-06-01)')
  })

  it('un hito estimado NUNCA muestra la fecha: muestra "Fecha por confirmar"', () => {
    const salida = etiquetaFechaHito(h({ origen: 'estimacion' }), fmt)
    expect(salida).toBe(ETIQUETA_SIN_FECHA)
    expect(salida).not.toContain('2026-06-01')
  })

  it('da igual que la estimación sea futura o pasada: tampoco se muestra', () => {
    // El caso real eran estimaciones YA VENCIDAS, que es cuando más engaña:
    // parece una fecha confirmada que simplemente no se actualizó.
    expect(etiquetaFechaHito(h({ origen: 'estimacion', fecha: '2020-01-01' }), fmt))
      .toBe(ETIQUETA_SIN_FECHA)
  })

  describe('schema.org Event — más estricto que el render', () => {
    it('NO emite Event si la única fecha de examen es estimada', () => {
      // Un Event con startDate es una afirmación categórica hacia buscadores: no hay forma
      // de decir "aproximadamente". Sin fuente oficial, no se emite.
      expect(hitoParaSchemaEvent([h({ origen: 'estimacion' })])).toBeNull()
    })

    it('emite Event con un hito de examen de fuente oficial', () => {
      expect(hitoParaSchemaEvent([h({ origen: 'registro' })])).not.toBeNull()
    })

    it('ignora exámenes ya completados', () => {
      expect(hitoParaSchemaEvent([h({ status: 'completed' })])).toBeNull()
    })

    it('elige el oficial aunque haya un estimado antes en la lista', () => {
      const estimado = h({ origen: 'estimacion', fecha: '2026-01-01' })
      const oficial = h({ origen: 'registro', fecha: '2026-09-12' })
      expect(hitoParaSchemaEvent([estimado, oficial])?.fecha).toBe('2026-09-12')
    })

    it('ignora hitos que no son de examen', () => {
      expect(hitoParaSchemaEvent([h({ titulo: 'Cierre del plazo de inscripción' })])).toBeNull()
    })
  })
})
