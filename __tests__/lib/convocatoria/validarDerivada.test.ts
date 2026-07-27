/**
 * El guardarraíl de la válvula `cifra_derivada`.
 *
 * La válvula deja publicar una cifra que NO está en el boletín. Es necesaria y es, por construcción,
 * la puerta por la que entra un dato inventado. Estos casos son las CUATRO firmas reales que existían
 * el 27/07/2026: las tres legítimas deben seguir pasando (un falso positivo aquí obliga a "corregir"
 * una cifra correcta) y la cuarta —mía, y equivocada— debe caer.
 */
const { validarFirmaDerivada, sumaDeSubconjunto } = require('@/lib/convocatoria/validarDerivada.cjs') as {
  validarFirmaDerivada: (f: { plazas?: number | null; snippet?: string | null }) =>
    { ok: boolean; codigo: string; motivo: string; sumandos?: number[] }
  sumaDeSubconjunto: (objetivo: number, numeros: number[]) => number[] | null
}

describe('validarFirmaDerivada — las 3 firmas legítimas siguen pasando', () => {
  it('Extremadura: 126 = 103 + 23 (turnos libres de dos OEP acumuladas)', () => {
    const r = validarFirmaDerivada({
      plazas: 126,
      snippet: '«Se convocan pruebas selectivas para cubrir 146 plazas del Cuerpo Auxiliar… 23 por el ' +
        'turno de acceso libre (OEP 2021)… 103 por el turno de acceso libre (OEP 2022/23)… 7 y 13 de discapacidad»',
    })
    expect(r.ok).toBe(true)
    expect(r.sumandos!.sort((a, b) => a - b)).toEqual([23, 103])
  })

  it('Baleares: 128 = suma de las plazas por isla', () => {
    const r = validarFirmaDerivada({
      plazas: 128,
      snippet: 'Mallorca: 110 plazas del turno libre, 6 de los cuales corresponden a la reserva para ' +
        'personas con discapacidad. Menorca: 6 plazas del turno libre, 1 … Eivissa: 11 plazas del turno libre',
    })
    expect(r.ok).toBe(true)
  })

  it('Ayto. Madrid: 111 = 100 (cupo general) + 11 (reserva discapacidad)', () => {
    const r = validarFirmaDerivada({
      plazas: 111,
      snippet: 'en la fila "Auxiliar Administrativo/a" el cupo general es de 100 plazas, las reservadas ' +
        'a personas con discapacidad son 11, y la columna Total Plazas dice ciento once',
    })
    expect(r.ok).toBe(true)
    expect(r.sumandos!.sort((a, b) => a - b)).toEqual([11, 100])
  })
})

describe('validarFirmaDerivada — la firma que NO debe pasar (mi error del 27/07)', () => {
  const ARAGON = '250102 Escala General Administrativa. Administrativos 144 (3 reservadas a víctimas de ' +
    'violencia de género, 1 reservada a víctimas de terrorismo y 1 reservada a personas transexuales)'

  it('139 no es suma de nada de su propia cita: era una RESTA de un total declarado', () => {
    const r = validarFirmaDerivada({ plazas: 139, snippet: ARAGON })
    expect(r.ok).toBe(false)
    expect(r.codigo).toBe('no_es_suma')
    expect(r.motivo).toMatch(/CORREGIRLA/)
  })

  it('en cambio la cifra correcta (144) SÍ pasa: la cita la contiene', () => {
    const r = validarFirmaDerivada({ plazas: 144, snippet: ARAGON })
    expect(r.ok).toBe(true)
    expect(r.codigo).toBe('cifra_en_cita')
  })
})

describe('validarFirmaDerivada — la cita que contiene la cifra (extractor roto)', () => {
  it('Ayto. Madrid: el snippet transcribe una tabla que ningún extractor lee, y dice 111', () => {
    // FALSO POSITIVO que casi cuelo: mi primera regla rechazaba esto por «la válvula sobra». No sobra:
    // el 111 está impreso en el BOCM y el CMap roto impide extraerlo. Rechazarlo mandaría a corregir
    // una cifra correcta. Se descubrió al correr el guardarraíl contra la BD real antes de activarlo.
    const r = validarFirmaDerivada({
      plazas: 111,
      snippet: 'en la fila "Auxiliar Administrativo/a" el cupo general es de 100 plazas, las reservadas ' +
        'a personas con discapacidad general son 11, y la columna Total Plazas indica 111. ' +
        'El total de la seccion cuadra: 158 + 18 + 0 = 176.',
    })
    expect(r.ok).toBe(true)
    expect(r.codigo).toBe('cifra_en_cita')
  })
})

describe('validarFirmaDerivada — bordes', () => {
  it('sin cita no hay nada que comprobar', () => {
    expect(validarFirmaDerivada({ plazas: 100, snippet: '' }).codigo).toBe('sin_cita')
    expect(validarFirmaDerivada({ plazas: 100, snippet: null }).codigo).toBe('sin_cita')
  })

  it('sin cifra no hay nada que derivar', () => {
    expect(validarFirmaDerivada({ plazas: null, snippet: 'lo que sea' }).codigo).toBe('sin_cifra')
  })

  it('un solo número igual al objetivo no es una suma (eso sería la cifra escrita)', () => {
    expect(sumaDeSubconjunto(50, [50])).toBeNull()
    expect(sumaDeSubconjunto(50, [30, 20])).toEqual([30, 20])
  })

  it('NO se deja engañar por una cifra mayor: 139 con 144 presente sigue cayendo', () => {
    expect(sumaDeSubconjunto(139, [144, 3, 1, 1])).toBeNull()
  })

  it('la regla que casi escribo —«hay otra cifra de plazas ⇒ rechazar»— habría tumbado las 3 buenas', () => {
    // Las tres legítimas mencionan otra cifra mayor en su cita (146, 110, 100) y aun así son válidas.
    for (const [plazas, snippet] of [
      [126, '146 plazas … 23 por el turno de acceso libre … 103 por el turno de acceso libre'],
      [111, 'cupo general 100 plazas, reserva 11'],
    ] as Array<[number, string]>) {
      expect(validarFirmaDerivada({ plazas, snippet }).ok).toBe(true)
    }
  })
})
