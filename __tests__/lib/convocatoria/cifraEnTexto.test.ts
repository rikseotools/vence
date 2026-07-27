/**
 * Núcleo puro de `plazas_afirmadas_sin_documento`.
 *
 * Se prueba aquí, sin BD, porque el hallazgo acusa a una landing de afirmar una cifra que ningún
 * documento respalda: un falso positivo manda a alguien a "arreglar" un dato correcto, y un falso
 * negativo deja publicada una cifra inventada. Las dos direcciones se fijan.
 */
import { cifraEnTexto, enLetra, esPlazaHuerfana } from '@/lib/convocatoria/cifraEnTexto'

describe('enLetra', () => {
  it.each([
    [0, 'cero'], [3, 'tres'], [16, 'dieciséis'], [21, 'veintiuno'], [29, 'veintinueve'],
    [30, 'treinta'], [42, 'cuarenta y dos'], [100, 'cien'], [111, 'ciento once'],
    [561, 'quinientos sesenta y uno'], [1000, 'mil'], [1030, 'mil treinta'],
    [2170, 'dos mil ciento setenta'],
  ])('escribe %i como «%s»', (n, esperado) => {
    expect(enLetra(n as number)).toBe(esperado)
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
