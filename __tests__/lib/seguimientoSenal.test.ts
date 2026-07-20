// T-047 — el sensor de seguimiento de convocatorias marcaba "cambio" a diario en 46 de 468
// fuentes, ahogando a las que cambian de verdad. Estos tests cubren las dos piezas puras del
// arreglo: la clasificación de fiabilidad y los huecos del normalizador de hash.
import { classifySignalReliability, hashContent } from '@/lib/api/seguimiento-convocatorias/queries'

describe('classifySignalReliability — separar la señal del ruido', () => {
  it('marca unreliable la fuente que cambia SIEMPRE (el caso de las 46)', () => {
    // Escala Administrativa ULE, medido 20/07: 21 de 23 checks con cambio.
    expect(classifySignalReliability(23, 21)).toBe('unreliable')
    expect(classifySignalReliability(21, 21)).toBe('unreliable')
  })

  it('marca reliable la fuente que casi nunca cambia (su "changed" sí informa)', () => {
    expect(classifySignalReliability(21, 0)).toBe('reliable')
    expect(classifySignalReliability(20, 3)).toBe('reliable')
  })

  it('no juzga con poco historial: <4 checks es unknown', () => {
    // Importante: una fuente nueva que cambió en su primer check NO es mentirosa todavía.
    expect(classifySignalReliability(1, 1)).toBe('unknown')
    expect(classifySignalReliability(3, 3)).toBe('unknown')
    expect(classifySignalReliability(0, 0)).toBe('unknown')
  })

  it('deja en unknown la zona intermedia en vez de inventarse un veredicto', () => {
    expect(classifySignalReliability(10, 6)).toBe('unknown')
    expect(classifySignalReliability(10, 8)).toBe('unknown')
  })

  it('el umbral de unreliable es >=90%, no >90%', () => {
    expect(classifySignalReliability(10, 9)).toBe('unreliable')
    expect(classifySignalReliability(100, 89)).toBe('unknown')
  })
})

describe('hashContent — el hash no debe moverse por ruido de calendario', () => {
  const wrap = (s: string) => `<html><body><p>${s}</p></body></html>`

  it('ignora fechas con mes ABREVIADO y coma (formato de los listados Drupal)', () => {
    // El hueco real: la ULE publica "Desde: 24 jun, 2026 - Hasta: 13 jul, 2026" (40 apariciones
    // en una sola página) y el normalizador solo cubría "24 de junio de 2026".
    const a = hashContent(wrap('Solicitudes Desde: 24 jun, 2026 Hasta: 13 jul, 2026'))
    const b = hashContent(wrap('Solicitudes Desde: 25 jun, 2026 Hasta: 14 jul, 2026'))
    expect(a).toBe(b)
  })

  it('ignora el mes abreviado con punto y sin coma', () => {
    expect(hashContent(wrap('Plazo 1 sept. 2026'))).toBe(hashContent(wrap('Plazo 4 sept. 2026')))
    expect(hashContent(wrap('Plazo 13 mayo 2026'))).toBe(hashContent(wrap('Plazo 27 mayo 2026')))
  })

  it('ignora los días de la semana (cabeceras de agenda que rotan)', () => {
    expect(hashContent(wrap('Actualizado lunes'))).toBe(hashContent(wrap('Actualizado jueves')))
  })

  it('sigue ignorando lo que ya cubría: horas, fechas numéricas y fecha larga', () => {
    expect(hashContent(wrap('Hora 09:15'))).toBe(hashContent(wrap('Hora 17:42')))
    expect(hashContent(wrap('Fecha 01/02/2026'))).toBe(hashContent(wrap('Fecha 28/11/2026')))
    expect(hashContent(wrap('El 12 de junio de 2026'))).toBe(hashContent(wrap('El 3 de agosto de 2026')))
  })

  it('SÍ detecta un cambio real de convocatoria (no se puede volver ciego)', () => {
    const antes = hashContent(wrap('Convocatoria en proceso. Plazas: 9'))
    const despues = hashContent(wrap('Convocatoria en proceso. Plazas: 12'))
    expect(antes).not.toBe(despues)
  })

  it('SÍ detecta que aparece la fecha del primer ejercicio — el caso que NO puede perderse', () => {
    // Es literalmente lo que T-035 lleva esperando de la ULE.
    const sinFecha = hashContent(wrap('Escala Administrativa. Estado: EN PROCESO'))
    const conFecha = hashContent(
      wrap('Escala Administrativa. Estado: EN PROCESO. Primer ejercicio: convocado'),
    )
    expect(sinFecha).not.toBe(conFecha)
  })
})
