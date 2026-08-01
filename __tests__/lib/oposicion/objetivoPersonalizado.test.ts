/**
 * Una oposición PERSONALIZADA como objetivo. (T-327)
 *
 * Esto decide si el contexto acepta o descarta la oposición de un usuario, y el camino de fallo
 * es feo: si se acepta algo que no se puede nombrar ni servir, la persona se queda con una
 * oposición sin nombre en la cabecera y un temario vacío. Si se descarta lo bueno, se le borra
 * la oposición y se le pide que la vuelva a elegir.
 *
 * Por eso los casos raros están aquí y no solo en la pantalla.
 */
import {
  esObjetivoPersonalizado,
  idCustomDe,
  esObjetivoValido,
  rutaTestPersonalizada,
} from '@/lib/oposicion/objetivoPersonalizado'

const ID = 'personalizada_aaaaaaaabbbbccccddddeeeeeeeeeeee'

describe('reconocer una personalizada', () => {
  it('reconoce el identificador que genera el guardado', () => {
    expect(esObjetivoPersonalizado(ID)).toBe(true)
  })

  it('NO acepta el prefijo a secas (sin id no hay oposición que servir)', () => {
    expect(esObjetivoPersonalizado('personalizada_')).toBe(false)
  })

  it('NO acepta un UUID pelado, que es lo que guardaba el onboarding antiguo', () => {
    // Esas filas son solo una etiqueta: no tienen topics ni topic_scope detrás (303 usuarios
    // así el 30/07, 127 sin un solo test). Darlas por buenas llevaría a un temario vacío.
    expect(esObjetivoPersonalizado('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false)
  })

  it('NO confunde una del catálogo', () => {
    expect(esObjetivoPersonalizado('auxiliar_administrativo_estado')).toBe(false)
  })

  it('aguanta basura sin reventar', () => {
    expect(esObjetivoPersonalizado(null)).toBe(false)
    expect(esObjetivoPersonalizado(undefined)).toBe(false)
    expect(esObjetivoPersonalizado('')).toBe(false)
    expect(esObjetivoPersonalizado(123 as unknown as string)).toBe(false)
  })

  it('extrae el id de custom_oposiciones', () => {
    expect(idCustomDe(ID)).toBe('aaaaaaaabbbbccccddddeeeeeeeeeeee')
    expect(idCustomDe('auxiliar_administrativo_estado')).toBeNull()
  })
})

describe('cuándo un objetivo es VÁLIDO', () => {
  it('lo del catálogo vale, con blob o sin él', () => {
    expect(esObjetivoValido('auxiliar_administrativo_estado', true, null)).toBe(true)
    expect(esObjetivoValido('auxiliar_administrativo_estado', true, 'Auxiliar')).toBe(true)
  })

  it('una personalizada CON nombre vale', () => {
    expect(esObjetivoValido(ID, false, 'Agente de Hacienda by Manuel C.')).toBe(true)
  })

  it('una personalizada SIN nombre NO vale, y es a propósito', () => {
    // Aceptarla dejaría al usuario con una oposición sin nombre en la cabecera y en todos los
    // selectores: un estado roto y MUDO, peor que uno roto que al menos pide ayuda.
    expect(esObjetivoValido(ID, false, null)).toBe(false)
    expect(esObjetivoValido(ID, false, '   ')).toBe(false)
    expect(esObjetivoValido(ID, false, undefined)).toBe(false)
  })

  it('un id desconocido que NO es personalizada sigue siendo inválido (no se abre la mano)', () => {
    expect(esObjetivoValido('oposicion-que-no-existe', false, 'Con nombre y todo')).toBe(false)
  })

  it('sin id no hay objetivo', () => {
    expect(esObjetivoValido(null, false, 'X')).toBe(false)
    expect(esObjetivoValido('', true, 'X')).toBe(false)
  })
})

describe('la ruta de sus tests', () => {
  it('una personalizada va a su ruta por id', () => {
    expect(rutaTestPersonalizada(ID)).toBe(
      '/oposicion-personalizada/aaaaaaaabbbbccccddddeeeeeeeeeeee/test',
    )
  })

  it('lo demás devuelve null para que el llamante use su camino de siempre', () => {
    expect(rutaTestPersonalizada('auxiliar_administrativo_estado')).toBeNull()
    expect(rutaTestPersonalizada(null)).toBeNull()
  })
})
