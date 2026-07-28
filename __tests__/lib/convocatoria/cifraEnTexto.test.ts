/**
 * Núcleo puro de `plazas_afirmadas_sin_documento`.
 *
 * Se prueba aquí, sin BD, porque el hallazgo acusa a una landing de afirmar una cifra que ningún
 * documento respalda: un falso positivo manda a alguien a "arreglar" un dato correcto, y un falso
 * negativo deja publicada una cifra inventada. Las dos direcciones se fijan.
 */
import { cifraEnTexto, enLetra, esPlazaHuerfana } from '@/lib/convocatoria/cifraEnTexto'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CASOS } = require('../../fixtures/cifraEnDocumento.cjs') as {
  CASOS: Array<{ nombre: string; cifra: number; texto: string; apareceLaCifra: boolean; origen: string }>
}

// El fixture es COMPARTIDO con el mirror del backend y con `landingClaims` (ver su cabecera): tres
// implementaciones del mismo hecho que habían divergido porque cada una traía sus propios casos.
// Un caso nuevo de calibración va AHÍ, no aquí.
describe('cifraEnTexto — casos compartidos con el mirror y con landingClaims', () => {
  it.each(CASOS.map((c) => [c.nombre, c] as const))('%s', (_n, c) => {
    expect(cifraEnTexto(c.cifra, c.texto)).toBe(c.apareceLaCifra)
  })
})

describe('enLetra', () => {
  it.each([
    [0, 'cero'], [3, 'tres'], [16, 'dieciséis'], [21, 'veintiuno'], [29, 'veintinueve'],
    [30, 'treinta'], [42, 'cuarenta y dos'], [100, 'cien'], [111, 'ciento once'],
    [561, 'quinientos sesenta y uno'], [1000, 'mil'], [1030, 'mil treinta'],
    [2170, 'dos mil ciento setenta'],
  ])('escribe %i como «%s»', (n, esperado) => {
    expect(enLetra(n as number)).toBe(esperado)
  })

  // Fuera de dominio devuelve null, y sobre todo NO revienta ni se cuelga. `NaN`/`Infinity` no entran
  // en ninguna rama y caían en la recursión final (`enLetra(NaN/1000)`) hasta agotar la pila: por eso
  // estos casos se prueban con un timeout corto, un cuelgue no es «solo» un test lento.
  it.each([[-5], [-1], [3.5], [NaN], [Infinity], [-Infinity]])(
    'devuelve null fuera de dominio (%p) sin excepción ni recursión', (n) => {
      expect(enLetra(n as number)).toBeNull()
    }, 2000)

  it('NUNCA devuelve cadena vacía: la daría por encontrada cualquier includes(\'\')', () => {
    for (const n of [-5, 3.5, NaN, Infinity]) expect(enLetra(n as unknown as number)).not.toBe('')
  })
})

describe('cifraEnTexto', () => {
  it('encuentra la cifra en dígitos', () => {
    expect(cifraEnTexto(139, 'se convocan 139 plazas de administrativo')).toBe(true)
  })

  it('encuentra la cifra con puntos de millar (como la escriben los boletines)', () => {
    expect(cifraEnTexto(1030, 'un total de 1.030 plazas')).toBe(true)
  })

  it('encuentra la cifra en letra: el caso que evita 22 acusaciones falsas de 31', () => {
    expect(cifraEnTexto(3, 'se convocan tres plazas de la escala auxiliar')).toBe(true)
    expect(cifraEnTexto(42, 'cuarenta y dos plazas')).toBe(true)
  })

  it('es insensible a mayúsculas y a saltos de línea del PDF', () => {
    expect(cifraEnTexto(29, 'VEINTINUEVE\n   PLAZAS')).toBe(true)
    expect(cifraEnTexto(111, 'Ciento\nOnce plazas')).toBe(true)
  })

  it('NO la encuentra cuando de verdad no está: el hallazgo real', () => {
    expect(cifraEnTexto(561, 'se convocan 231 plazas de policía municipal')).toBe(false)
  })

  it('sin corpus no puede probar nada', () => {
    expect(cifraEnTexto(100, null)).toBe(false)
    expect(cifraEnTexto(100, '')).toBe(false)
  })

  it('sin cifra no hay nada que probar (no acusa)', () => {
    expect(cifraEnTexto(null, null)).toBe(true)
    expect(cifraEnTexto(undefined, 'lo que sea')).toBe(true)
  })

  // El bug de [T-195]: `cifraEnTexto(-3, …)` no devolvía `false`, lanzaba
  // `Cannot read properties of undefined (reading 'toLowerCase')`. Lo cazó un test de `correccionPlazas`
  // (T-191) probando el caso «valor negativo», y quedó anotado en vez de arreglarse de rebote porque
  // este núcleo lo comparten el auditor, el sweep nocturno y el @Cron del backend. Un detector que
  // revienta deja de reportar, y ese silencio se lee como «no hay hallazgos».
  it.each([[-3], [-1], [2.5], [NaN], [Infinity]])(
    'ante una cifra imposible (%p) responde false, no una excepción', (n) => {
      expect(cifraEnTexto(n as number, 'se convocan 139 plazas')).toBe(false)
    }, 2000)

  it('una cifra basura NO se da por probada ni con el corpus más favorable', () => {
    // Sin la guarda, `formas` colaba un `undefined` y bastaba con que includes('') acertara.
    expect(cifraEnTexto(-3 as number, 'aquí aparece -3 y también 3 y tres')).toBe(false)
  })

  it('sigue siendo estricto con el cero, que SÍ es un entero válido', () => {
    expect(cifraEnTexto(0, 'se convocan cero plazas este año')).toBe(true)
    expect(cifraEnTexto(0, 'se convocan 139 plazas')).toBe(false)
  })

  // [T-202] La cifra tiene que ser un número ENTERO del texto, no una subcadena de otro. Los tres
  // primeros son literales de corpus reales: medido sobre las 118 convocatorias vivas, 7 estaban en
  // verde ÚNICAMENTE por esto.
  describe('frontera de número: una subcadena no es una aparición', () => {
    it('no la da por probada dentro de un código', () => {
      expect(cifraEnTexto(216, 'B.1.3 C.ADMINISTRATIVO C1.1000197163216 C.DE AYUDANTES')).toBe(false)
    })

    it('no la da por probada dentro de otro número más largo', () => {
      expect(cifraEnTexto(278, 'PLAZAS ADICIONALES TD C211L26181 8 69 4 28 6 2781853 6 Grupo E')).toBe(false)
    })

    it('no la da por probada dentro de una tabla que el PDF aplanó', () => {
      // «Total | 317 | 45 | 362» salió del extractor como «Total31745362». La cifra es correcta,
      // pero el documento no la prueba de forma legible: el detector debe pedir prueba, no adivinar.
      expect(cifraEnTexto(317, 'Acuerdo 52/2025, de 11 de diciembre19220212 Total31745362 2.2.')).toBe(false)
    })

    it('sigue encontrándola cuando SÍ es un número del texto, pegada a puntuación', () => {
      expect(cifraEnTexto(1747, 'Plazas del cupo general: 1.747. Plazas del cupo de reserva')).toBe(true)
      expect(cifraEnTexto(1704, 'Mil setecientas cuatro (1704) plazas libres.')).toBe(true)
      expect(cifraEnTexto(55, 'la provisión en propiedad de 55 plazas de Auxiliar Administrativo/a,')).toBe(true)
    })

    it('no confunde la cifra con la parte decimal ni con un porcentaje', () => {
      expect(cifraEnTexto(5, 'un incremento del 44,5 % sobre la plantilla')).toBe(false)
      expect(cifraEnTexto(747, 'un total de 1.747 plazas')).toBe(false)
    })

    it('el numeral en LETRA se sigue buscando igual (los boletines escriben así las pequeñas)', () => {
      // Sin esto, `administrativa-universidad-de-murcia` habría salido acusada teniendo su
      // documento la cifra escrita con todas las letras. Lo cazó la simulación de [T-202].
      expect(cifraEnTexto(36, 'se convocan treinta y seis plazas de la escala administrativa')).toBe(true)
    })
  })

  it('por encima de 9999 solo busca dígitos (no genera el numeral)', () => {
    expect(cifraEnTexto(12345, 'son 12.345 plazas')).toBe(true)
    expect(cifraEnTexto(12345, 'doce mil trescientos cuarenta y cinco')).toBe(false)
  })
})

describe('esPlazaHuerfana', () => {
  it('acusa la cifra que ningún documento contiene', () => {
    expect(esPlazaHuerfana({ plazas_libres: 561, corpus: 'convoca 231 plazas', docs: 2 })).toBe(true)
  })

  it('acusa cuando no hay NINGÚN documento clonado', () => {
    expect(esPlazaHuerfana({ plazas_libres: 111, corpus: null, docs: 0 })).toBe(true)
  })

  it('calla cuando el documento contiene la cifra', () => {
    expect(esPlazaHuerfana({ plazas_libres: 139, corpus: 'oferta de 139 plazas', docs: 9 })).toBe(false)
  })

  it('calla ante una cifra derivada FIRMADA y VERIFICABLE (Extremadura: 23 + 103 = 126)', () => {
    expect(esPlazaHuerfana({
      plazas_libres: 126,
      corpus: '23 por el turno de acceso libre … 103 por el turno de acceso libre',
      docs: 1,
      derivada_declarada: true,
      derivada_snippet: '«23 por el turno de acceso libre» (OEP 2021) + «103 por el turno de acceso libre» (OEP 2022/23)',
    })).toBe(false)
  })

  it('NO calla si la derivada no está firmada: «lo sumé yo» es lo que se dijo del 2.163 inventado', () => {
    expect(esPlazaHuerfana({
      plazas_libres: 126, corpus: '23 … 103 …', docs: 1, derivada_declarada: false,
    })).toBe(true)
    expect(esPlazaHuerfana({ plazas_libres: 126, corpus: '23 … 103 …', docs: 1 })).toBe(true)
  })

  it('EL CASO DE MI PROPIO ERROR: firmada pero NO verificable ⇒ sigue acusando', () => {
    // administrativo-aragon: firmé 139 como «144 − 5 reservadas». El BOA convoca 144 y 139 no es
    // suma de nada de la cita. Antes del 27/07 la firma bastaba para callar el aviso; ya no.
    expect(esPlazaHuerfana({
      plazas_libres: 139,
      corpus: 'Escala General Administrativa. Administrativos 144 (3 reservadas…)',
      docs: 1,
      derivada_declarada: true,
      derivada_snippet: '250102 Escala General Administrativa. Administrativos 144 (3 reservadas a víctimas de violencia de género, 1 reservada a víctimas de terrorismo y 1 reservada a personas transexuales)',
    })).toBe(true)
  })

  it('una firma sin cita no exime (no hay nada que comprobar)', () => {
    expect(esPlazaHuerfana({
      plazas_libres: 126, corpus: 'sin la cifra', docs: 1, derivada_declarada: true,
    })).toBe(true)
  })

  it('sin cifra de plazas no hay hallazgo', () => {
    expect(esPlazaHuerfana({ plazas_libres: null, corpus: null, docs: 0 })).toBe(false)
  })
})
