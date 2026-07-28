/**
 * [T-214] La landing decía lo mismo para dos realidades opuestas: «N plazas de acceso libre.
 * M reservadas para discapacidad» se leía como una suma SIEMPRE, aunque en 32 de las 93
 * convocatorias vivas que enseñan las dos cifras el cupo ya iba dentro de N.
 *
 * Los dos casos reales que fijan la regla están medidos contra su boletín:
 *   · andalucía  216 / 19 con `incluidas = true`  → NO se suman (el total sigue siendo 216)
 *   · córdoba     43 / 12 con `incluidas = false` → SÍ se suman: su BOP convoca 55 en turno libre
 */
import { complementoReserva, fraseReserva, relacionReserva, totalTurnoLibre } from '@/lib/convocatoria/reservaDiscapacidad'

describe('relacionReserva', () => {
  it('distingue los tres estados, y «no consta» NO es «aparte»', () => {
    expect(relacionReserva(true)).toBe('dentro')
    expect(relacionReserva(false)).toBe('aparte')
    expect(relacionReserva(null)).toBe('sin_declarar')
    expect(relacionReserva(undefined)).toBe('sin_declarar')
  })
})

describe('complementoReserva', () => {
  it('cuando el cupo va DENTRO, el conector impide sumar', () => {
    // administrativo-andalucia: 216 incluye las 19. «de las cuales» → nadie lee 235.
    expect(complementoReserva(19, true)).toEqual({ conector: 'de las cuales', plazas: 19 })
  })

  it('cuando el cupo va APARTE, el conector invita a sumar (y es correcto)', () => {
    // auxiliar-administrativo-ayuntamiento-cordoba: 43 + 12 = 55, las que convoca su BOP.
    expect(complementoReserva(12, false)).toEqual({ conector: 'más', plazas: 12 })
  })

  it('si NO consta la relación, no se dice nada de la reserva', () => {
    // 38 convocatorias vivas están así. Afirmar una relación que no consta es peor que callarla:
    // la cifra de plazas es lo primero que mira un opositor para decidir si se presenta.
    expect(complementoReserva(12, null)).toBeNull()
    expect(complementoReserva(12, undefined)).toBeNull()
  })

  it('sin cupo (null, 0 o negativo) no hay complemento que añadir', () => {
    expect(complementoReserva(null, true)).toBeNull()
    expect(complementoReserva(0, false)).toBeNull()
    expect(complementoReserva(-3, false)).toBeNull()
    expect(complementoReserva(NaN, false)).toBeNull()
  })
})

describe('la frase que se publica', () => {
  it('con el cupo DENTRO, la redacción impide sumar', () => {
    expect(fraseReserva(223, true, (n) => n.toLocaleString('es-ES')))
      .toBe(', de las cuales 223 están reservadas para discapacidad.')
  })

  it('con el cupo APARTE, la redacción invita a sumar', () => {
    expect(fraseReserva(12, false)).toBe(' y otras 12 más reservadas para discapacidad.')
  })

  it('concuerda en singular cuando el cupo es de UNA plaza', () => {
    // `cuidador-diputacion-cordoba` reserva 1 de 3, y la plantilla vieja publicaba
    // «1 reservadas para discapacidad». Lo cazó la simulación sobre las 123 landings vivas.
    expect(fraseReserva(1, false)).toBe(' y otra más reservada para discapacidad.')
    expect(fraseReserva(1, true)).toBe(', de las cuales 1 está reservada para discapacidad.')
  })

  it('sin declarar, no se publica nada de la reserva', () => {
    expect(fraseReserva(131, null)).toBeNull()
  })

  it('lleva su propia puntuación: la frase base termina sin punto', () => {
    // El render escribe «…plazas de acceso libre{fraseReserva ?? '.'}», así que si el complemento
    // no trajera el punto final, la landing publicaría una frase sin cerrar.
    for (const [n, i] of [[10, true], [10, false]] as Array<[number, boolean]>) {
      expect(fraseReserva(n, i)!.endsWith('.')).toBe(true)
    }
  })
})

// La MISMA columna la usa la vista `oposiciones_ssot` para derivar `plazas_total`, con este SQL:
//   CASE WHEN plazas_discapacidad_incluidas IS TRUE THEN 0 ELSE COALESCE(plazas_discapacidad,0) END
// Para true/false las dos capas tienen que decir lo mismo, o el total de la meta description
// contradiría al hero. Con null divergen a propósito (la vista suma, la frase calla) y eso se fija
// aquí para que sea una decisión visible y no un descuido.
describe('coherencia con la derivación de plazas_total en la vista', () => {
  const sumaLaVista = (incluidas: boolean | null) => incluidas !== true

  it('coincide con la vista cuando el dato consta', () => {
    for (const incl of [true, false]) {
      const sumaElNucleo = complementoReserva(19, incl)?.conector === 'más'
      expect(sumaElNucleo).toBe(sumaLaVista(incl))
    }
  })

  it('con el dato sin declarar, la vista suma y la frase calla (divergencia deliberada)', () => {
    expect(sumaLaVista(null)).toBe(true)
    expect(fraseReserva(19, null)).toBeNull()
  })
})

describe('totalTurnoLibre', () => {
  it('con el cupo dentro, el total NO crece', () => {
    expect(totalTurnoLibre(216, 19, true)).toBe(216)
  })

  it('con el cupo aparte, el total es la suma — y cuadra con el boletín', () => {
    expect(totalTurnoLibre(43, 12, false)).toBe(55)
  })

  it('sin declarar, no se inventa una suma: solo consta lo que consta', () => {
    expect(totalTurnoLibre(43, 12, null)).toBe(43)
  })

  it('sin plazas libres no hay total', () => {
    expect(totalTurnoLibre(null, 12, false)).toBeNull()
  })
})
