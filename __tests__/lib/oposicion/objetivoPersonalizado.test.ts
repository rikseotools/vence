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
  raizPersonalizada,
  raizPersonalizadaEnRuta,
  enlaceSaleAOtraOposicion,
  personalizadaUtilizable,
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

/**
 * ¿Se puede ESTUDIAR, o es solo una etiqueta? [T-508]
 *
 * Nace de un 404 real: una usuaria premium fijó como objetivo su fila de marzo de
 * `custom_oposiciones` —una etiqueta del onboarding viejo, sin un solo tema— y el icono 📚 del
 * Header la mandó a `/oposicion-personalizada/<id>/temario`, que sin temario no existe.
 *
 * El criterio se fija aquí porque lo aplican DOS puertas (el botón «Hacer mi oposición
 * objetivo» y el PUT de `/api/profile/target`) y dos puertas con criterios propios se separan.
 */
describe('una personalizada solo es estudiable si tiene temas', () => {
  it('con al menos un tema, sí', () => {
    expect(personalizadaUtilizable(1)).toBe(true)
    expect(personalizadaUtilizable(37)).toBe(true)
  })

  it('a cero NO: es el caso que produjo el 404', () => {
    expect(personalizadaUtilizable(0)).toBe(false)
  })

  it('«no lo sé» NO cuenta como sí — sin el dato no se afirma que se pueda estudiar', () => {
    // Importa el sentido de la falta: si la consulta no trajo el número, el llamante tiene que
    // decidir a propósito (hoy: fail-open en el servidor), no colarse por un `undefined > 0`.
    expect(personalizadaUtilizable(null)).toBe(false)
    expect(personalizadaUtilizable(undefined)).toBe(false)
    expect(personalizadaUtilizable(NaN)).toBe(false)
  })

  it('un negativo tampoco (una fila corrupta no abre la puerta)', () => {
    expect(personalizadaUtilizable(-3)).toBe(false)
  })
})


/**
 * [T-541] La RAÍZ y la fuga a otra oposición.
 *
 * Nace de un fallo real (Sergio, premium, 04/08/2026): pulsó «Practicar este tema» dentro de su
 * oposición personalizada y acabó en `/administrativo-estado/test/tema/10`. La causa era un
 * componente compartido cuyo valor POR DEFECTO es un slug REAL, así que la página que no le
 * pasaba el suyo no fallaba: mandaba al usuario a otra oposición.
 */
describe('la raíz de una personalizada', () => {
  it('es el prefijo del que cuelgan todas sus páginas', () => {
    expect(raizPersonalizada(ID)).toBe('/oposicion-personalizada/aaaaaaaabbbbccccddddeeeeeeeeeeee')
  })

  it('la ruta de tests se construye SOBRE ella (una sola verdad)', () => {
    expect(rutaTestPersonalizada(ID)).toBe(`${raizPersonalizada(ID)}/test`)
  })

  it('lo que no es personalizado devuelve null, para que el llamante siga por su camino', () => {
    expect(raizPersonalizada('auxiliar_administrativo_estado')).toBeNull()
    expect(raizPersonalizada(null)).toBeNull()
    expect(raizPersonalizada(undefined)).toBeNull()
    expect(raizPersonalizada('personalizada_')).toBeNull()
  })
})

describe('la raíz que hay en una RUTA', () => {
  it('la saca de la propia URL, que es la señal más fuerte (las personalizadas son públicas)', () => {
    const id = 'aaaaaaaabbbbccccddddeeeeeeeeeeee'
    expect(raizPersonalizadaEnRuta(`/oposicion-personalizada/${id}/test/tema/10/test-personalizado`))
      .toBe(`/oposicion-personalizada/${id}`)
    expect(raizPersonalizadaEnRuta(`/oposicion-personalizada/${id}`)).toBe(`/oposicion-personalizada/${id}`)
  })

  it('fuera de una personalizada, null (el llamante sigue con el catálogo)', () => {
    expect(raizPersonalizadaEnRuta('/administrativo-estado/test/tema/10')).toBeNull()
    expect(raizPersonalizadaEnRuta('/test/rapido')).toBeNull()
    expect(raizPersonalizadaEnRuta(null)).toBeNull()
  })

  it('un id con mala forma no cuela (no se fabrica una raíz inventada)', () => {
    expect(raizPersonalizadaEnRuta('/oposicion-personalizada/no-es-un-id/test')).toBeNull()
  })
})

describe('un enlace que SACA al usuario de su oposición personalizada', () => {
  const raiz = raizPersonalizada(ID)!

  it('caza el fallo que lo motiva: «Practicar este tema» apuntando a otra oposición', () => {
    expect(enlaceSaleAOtraOposicion('/administrativo-estado/test/tema/10', raiz)).toBe(true)
    expect(enlaceSaleAOtraOposicion('/administrativo-estado/temario/tema-10', raiz)).toBe(true)
    expect(enlaceSaleAOtraOposicion('/auxiliar-administrativo-estado/temario', raiz)).toBe(true)
  })

  it('lo que se queda en casa NO es fuga', () => {
    expect(enlaceSaleAOtraOposicion(`${raiz}/test/tema/10`, raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion(`${raiz}/temario/tema-10`, raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion(raiz, raiz)).toBe(false)
    // Con query/hash sigue siendo la misma página.
    expect(enlaceSaleAOtraOposicion(`${raiz}/test?foo=1#x`, raiz)).toBe(false)
  })

  it('los enlaces que un temario tiene legítimamente hacia fuera NO son fuga', () => {
    // Practicar una ley suelta es lo que hace el propio temario en cada ley que lista.
    expect(enlaceSaleAOtraOposicion('/leyes/trrl', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion('/leyes/rdl-5-2015/avanzado', raiz)).toBe(false)
    // Y los comunes del Header.
    expect(enlaceSaleAOtraOposicion('/teoria', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion('/oposiciones', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion('/test/por-leyes', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion('/test/favoritas', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion('/perfil', raiz)).toBe(false)
  })

  it('las SECCIONES de la app no son otra oposición, aunque la ruta se les parezca', () => {
    // Medido contra producción: `/psicotecnicos/test` (enlace común del Header) era 14 de las
    // 17 señales del rastreo. Un detector que grita en el caso normal deja de mirarse.
    expect(enlaceSaleAOtraOposicion('/psicotecnicos/test', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion('/teoria/test', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion('/admin/test', raiz)).toBe(false)
  })

  it('sin raíz no se opina (no se marca fuga a quien no está en una personalizada)', () => {
    expect(enlaceSaleAOtraOposicion('/administrativo-estado/test', null)).toBe(false)
  })

  it('un enlace externo o relativo no es cosa suya', () => {
    expect(enlaceSaleAOtraOposicion('https://www.boe.es/x/test', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion('', raiz)).toBe(false)
    expect(enlaceSaleAOtraOposicion(null, raiz)).toBe(false)
  })
})
