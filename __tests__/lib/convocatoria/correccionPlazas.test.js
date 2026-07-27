/**
 * Tests del núcleo `lib/convocatoria/correccionPlazas.cjs` (T-191).
 *
 * Los casos salen de los dos reales del 27/07: la cifra de Aragón que había que corregir contra el
 * BOA (139 → 144) y la de Madrid, donde la cita correcta es una fila de tabla y no una cláusula.
 */
const { validarCorreccion, citaPruebaAlgo, MIN_CITA } = require('../../../lib/convocatoria/correccionPlazas.cjs')

// Cita REAL del Anexo I del BOA 247 de 23/12/2025 que sostiene las 144 de Aragón.
const CITA_BOA =
  '250102 Escala General Administrativa. Administrativos 144 (3 reservadas a víctimas de violencia de género, 1 reservada a víctimas de terrorismo y 1 reservada a personas transexuales)'

const base = {
  campo: 'plazas_libres',
  valor: 144,
  actual: 139,
  cita: CITA_BOA,
  url: 'https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VEROBJ&MLKOB=1427868650404',
  motivo: 'La cifra publicada salía de restar a las 144 convocadas las 5 reservadas a colectivos, resta que no aparece escrita.',
}

describe('validarCorreccion — el caso real de Aragón', () => {
  it('acepta la corrección 139 → 144 con la cita del BOA', () => {
    const r = validarCorreccion(base)
    expect(r.ok).toBe(true)
    expect(r.errores).toEqual([])
  })

  it('respeta el optimistic check: si en BD ya no está el valor esperado, rehúsa', () => {
    const r = validarCorreccion({ ...base, esperado: 139, actual: 144 })
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(/otra sesión lo cambió/)
  })

  it('avisa (sin romper) cuando la cifra ya está puesta', () => {
    const r = validarCorreccion({ ...base, actual: 144 })
    expect(r.ok).toBe(true)
    expect(r.avisos.join(' ')).toMatch(/ya es 144/)
  })
})

describe('validarCorreccion — LA guarda: la cita tiene que contener la cifra', () => {
  it('RECHAZA una cifra que la cita no sostiene (el patrón del 2.163 de Policía Nacional)', () => {
    // Se intenta escribir 139 citando el texto que dice 144: es justo la resta inventada.
    const r = validarCorreccion({ ...base, valor: 139 })
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(/NO contiene la cifra 139/)
  })

  it('acepta la cifra escrita EN LETRA, como la escriben los boletines', () => {
    const r = validarCorreccion({
      ...base,
      valor: 30,
      cita: 'Se convocan pruebas selectivas para cubrir treinta plazas del Cuerpo Auxiliar por el turno de acceso libre.',
    })
    expect(r.ok).toBe(true)
  })

  it('rechaza un membrete de boletín aunque lleve el número', () => {
    const r = validarCorreccion({
      ...base,
      valor: 144,
      cita: 'B.O.C.M. Núm. 144 Pág. 171 VIERNES 4 DE JULIO DE 2025 BOLETIN OFICIAL',
    })
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(/membrete|no parece una prueba/)
  })
})

describe('validarCorreccion — exige el papeleo mínimo', () => {
  it.each([
    ['sin cita', { cita: '' }, /falta --cita/],
    ['cita demasiado corta', { cita: '144 plazas' }, /falta --cita/],
    ['sin url', { url: '' }, /falta --url/],
    ['url que no es url', { url: 'boa.aragon.es' }, /falta --url/],
    ['sin motivo', { motivo: '' }, /falta --motivo/],
    ['motivo de relleno', { motivo: 'estaba mal' }, /falta --motivo/],
    ['campo no corregible', { campo: 'exam_date' }, /no corregible/],
    ['valor no entero', { valor: 12.5 }, /entero/],
    ['valor negativo', { valor: -3 }, /entero/],
  ])('rechaza: %s', (_caso, patch, patron) => {
    const r = validarCorreccion({ ...base, ...patch })
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(patron)
  })

  it('acumula TODOS los motivos de rechazo, no solo el primero', () => {
    const r = validarCorreccion({ campo: 'nope', valor: -1, cita: '', url: '', motivo: '' })
    expect(r.errores.length).toBeGreaterThanOrEqual(4)
  })
})

describe('citaPruebaAlgo — mismo criterio que el detector cita_no_prueba_nada', () => {
  it('una cláusula en prosa vale', () => {
    expect(citaPruebaAlgo('Se convocan ciento cuarenta y cuatro plazas del Cuerpo Ejecutivo por el turno libre de acceso.', [144])).toBe(true)
  })

  it('una fila de tabla vale si carga dos de las cifras afirmadas', () => {
    expect(citaPruebaAlgo('AUXILIAR ADMINISTRATIVO/A 100 11 111 TOTAL ADMINISTRACION GENERAL', [111, 11])).toBe(true)
  })

  it('un membrete no vale', () => {
    expect(citaPruebaAlgo('B.O.C.M. Núm. 294 Pág. 300 MIERCOLES 10 DE DICIEMBRE DE 2025', [111])).toBe(false)
  })

  it(`una cita por debajo de ${MIN_CITA} caracteres no vale`, () => {
    expect(citaPruebaAlgo('144 plazas', [144])).toBe(false)
  })
})
