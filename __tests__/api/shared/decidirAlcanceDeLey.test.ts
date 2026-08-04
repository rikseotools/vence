/**
 * Decisión «acotar al temario o DEGRADAR» — núcleo compartido por el contador del
 * configurador y por el test servido (`lib/api/_shared/topicScopeSql.ts`).
 *
 * Vive en un solo sitio a propósito ([T-551]): hasta el 04/08 la degradación existía solo en
 * `filtered-questions` y el contador no la tenía, así que una oposición sin temario contaba 0
 * en todas sus leyes y dejaba el botón de empezar en gris — con 1.283 preguntas detrás.
 */
import { decidirAlcanceDeLey, esDegradacion } from '@/lib/api/_shared/topicScopeSql'

describe('sin acotar (poweruser, /leyes/[law], multi-ley sin objetivo)', () => {
  it('sin selección manual → ley entera', () => {
    expect(decidirAlcanceDeLey({ acotarAlTemario: false, tieneScopeDeLaLey: true, haySeleccionManual: false }))
      .toBe('ley_entera')
  })

  it('con selección manual → lo que pidió, tal cual', () => {
    expect(decidirAlcanceDeLey({ acotarAlTemario: false, tieneScopeDeLaLey: true, haySeleccionManual: true }))
      .toBe('seleccion_del_usuario')
  })
})

describe('acotado y CON temario: se interseca (defensa en profundidad, sin regresión)', () => {
  it('sin selección manual → el temario de esa ley', () => {
    expect(decidirAlcanceDeLey({ acotarAlTemario: true, tieneScopeDeLaLey: true, haySeleccionManual: false }))
      .toBe('temario')
  })

  it('con selección manual → intersección (ni por URL se cuelan artículos fuera del temario)', () => {
    expect(decidirAlcanceDeLey({ acotarAlTemario: true, tieneScopeDeLaLey: true, haySeleccionManual: true }))
      .toBe('interseccion_con_temario')
  })
})

describe('acotado y SIN temario: DEGRADA — nunca interseca contra vacío', () => {
  // El caso de Félix Peña (premium): oposición con 0 filas de topic_scope.
  it('con selección manual → se le sirve su selección, no un cero', () => {
    expect(decidirAlcanceDeLey({ acotarAlTemario: true, tieneScopeDeLaLey: false, haySeleccionManual: true }))
      .toBe('seleccion_del_usuario')
  })

  it('sin selección manual → ley entera, no un cero', () => {
    expect(decidirAlcanceDeLey({ acotarAlTemario: true, tieneScopeDeLaLey: false, haySeleccionManual: false }))
      .toBe('ley_entera')
  })

  it('NINGUNA combinación puede producir un alcance vacío', () => {
    for (const acotarAlTemario of [true, false]) {
      for (const tieneScopeDeLaLey of [true, false]) {
        for (const haySeleccionManual of [true, false]) {
          const r = decidirAlcanceDeLey({ acotarAlTemario, tieneScopeDeLaLey, haySeleccionManual })
          expect(['ley_entera', 'seleccion_del_usuario', 'interseccion_con_temario', 'temario']).toContain(r)
        }
      }
    }
  })
})

describe('esDegradacion: solo es degradación si se PIDIÓ acotar y no se pudo', () => {
  it('acotar + sin temario = degradación (hay que observarlo)', () => {
    expect(esDegradacion({ acotarAlTemario: true, tieneScopeDeLaLey: false })).toBe(true)
  })

  it('acotar + con temario = comportamiento normal', () => {
    expect(esDegradacion({ acotarAlTemario: true, tieneScopeDeLaLey: true })).toBe(false)
  })

  it('sin acotar NO es degradación aunque no haya temario (nadie pidió acotar)', () => {
    expect(esDegradacion({ acotarAlTemario: false, tieneScopeDeLaLey: false })).toBe(false)
  })
})
