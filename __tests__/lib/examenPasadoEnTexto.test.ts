/**
 * @jest-environment node
 */
// Guardarraíl del detector de textos que anuncian un examen pasado como vigente.
// Casos REALES de la BD (21/07/2026). Lo que fija sobre todo este test: que las fechas que NO
// son de examen (plazo, publicación, resultados) y los históricos correctos ("se celebró el…")
// NO se marquen — la diferencia entre un detector útil y otra bandeja ruidosa.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { examenPasadoPresentadoVigente } = require('@/lib/convocatoria/examenPasadoEnTexto.cjs')

const HOY = '2026-07-21'
const marca = (txt: string) => examenPasadoPresentadoVigente(txt, HOY).length > 0

describe('examen pasado presentado como vigente — detección calibrada', () => {
  it('MARCA "¿Cuándo es el examen? El 18 de abril de 2026" (el caso que motivó la tarea)', () => {
    expect(marca('¿Cuándo es el examen? El 18 de abril de 2026, ejercicio único.')).toBe(true)
  })

  it('MARCA "examen está previsto para el 21 de junio de 2026"', () => {
    expect(marca('El examen está previsto para el sábado 21 de junio de 2026.')).toBe(true)
  })

  it('MARCA formato numérico "con examen el 6/06/2026"', () => {
    expect(marca('Convocatoria de 20 plazas con examen el 6/06/2026 en Valencia.')).toBe(true)
  })

  it('NO marca histórico redactado en pasado "el examen se celebró el 20 de junio"', () => {
    // El caso correcto que redacté yo en el rollover de ayer: informa, no engaña.
    expect(marca('El primer ejercicio de TCAE se celebró el 20 de junio de 2026 en el BEC.')).toBe(false)
  })

  it('NO marca "celebró su examen el 14 de marzo" (pasado sin "se" — el hueco que se coló)', () => {
    expect(marca('La OEP 2023-2024 celebró su examen el 14 de marzo de 2026.')).toBe(false)
  })

  it('NO marca una fecha de PLAZO "el plazo de solicitudes cerró el 10 de junio de 2026"', () => {
    expect(marca('El plazo de solicitudes del examen cerró el 10 de junio de 2026.')).toBe(false)
  })

  it('NO marca una fecha de PUBLICACIÓN "la convocatoria se publicó el 29/12/2025"', () => {
    expect(marca('La convocatoria del examen se publicó el 29/12/2025.')).toBe(false)
  })

  it('NO marca una fecha de RESULTADOS "resultados publicados el 26 de diciembre de 2025"', () => {
    expect(marca('Los resultados del ejercicio único fueron publicados el 26 de diciembre de 2025.')).toBe(false)
  })

  it('NO marca una fecha de examen FUTURA', () => {
    expect(marca('El examen está previsto para el 12 de septiembre de 2026.')).toBe(false)
  })

  it('NO marca una cota "el ejercicio no se celebrará antes del 1 de junio de 2026"', () => {
    // "no se celebrará antes del" es redacción pasada/condicional, no un anuncio de fecha firme.
    expect(marca('El ejercicio no se celebrará antes del 1 de junio de 2026.')).toBe(false)
  })

  it('devuelve la fecha detectada, para poder mostrarla en el hallazgo', () => {
    const r = examenPasadoPresentadoVigente('¿Cuándo es el examen? El 7 de junio de 2026.', HOY)
    expect(r[0].iso).toBe('2026-06-07')
  })
})
