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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// [T-218] Declarar si el cupo de discapacidad va DENTRO del turno libre o APARTE.
//
// Los dos casos reales que la estrenaron (28/07) son tablas de boletín donde la cifra del cupo NO
// está impresa —es una suma de columnas—, así que la guarda no puede pedirla: pide el TOTAL que la
// declaración implica, que es lo que sí imprime el boletín.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('validarDeclaracionReserva', () => {
  const { validarDeclaracionReserva } = require('@/lib/convocatoria/correccionPlazas.cjs')

  // DOCM 12/12/2025: «Cupo general | Reserva discapacidad | Total plazas» → 305 + 9 + 13 = 327.
  const CITA_CLM = 'Cupo general Reserva personas con discapacidad Total plazas — C2 Cuerpo Auxiliar 305 9 13 327'
  // DOGV: «Turno libre | Discapacidad | Discapacidad intelectual | Enfermedad mental | Total».
  const CITA_GVA = 'Turno libre Discapacidad Discapacidad intelectual Enfermedad mental Total — C2-01. Cuerpo auxiliar. 204 14 21 6 245'
  const base = { url: 'https://docm.castillalamancha.es/x.pdf', motivo: 'La tabla del Decreto de OEP desglosa cupo general y reserva, y el total coincide con lo guardado.' }

  it('DENTRO: basta con que el total guardado esté en la cita (el cupo es suma de columnas)', () => {
    const r = validarDeclaracionReserva({ ...base, incluidas: true, cita: CITA_CLM, plazasLibres: 327, plazasDiscapacidad: 22 })
    expect(r.ok).toBe(true)
  })

  it('APARTE: exige que el total (libres + cupo) esté IMPRESO, no deducido', () => {
    const ok = validarDeclaracionReserva({ ...base, incluidas: false, cita: CITA_GVA, plazasLibres: 204, plazasDiscapacidad: 41 })
    expect(ok.ok).toBe(true) // 245 está en la cita

    // La misma cita, pero declarando «aparte» sobre unas cifras cuyo total (327 + 22 = 349) no
    // aparece: es una interpretación, no una lectura.
    const no = validarDeclaracionReserva({ ...base, incluidas: false, cita: CITA_CLM, plazasLibres: 327, plazasDiscapacidad: 22 })
    expect(no.ok).toBe(false)
    expect(no.errores.join(' ')).toMatch(/349/)
  })

  it('no se declara sin cupo que declarar', () => {
    const r = validarDeclaracionReserva({ ...base, incluidas: true, cita: CITA_CLM, plazasLibres: 327, plazasDiscapacidad: 0 })
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(/cupo/)
  })

  it('un membrete no es una cita, por muchas palabras de fecha que lleve', () => {
    // Este pasaba la guarda heredada de la corrección (5 palabras en minúscula = "prosa") y no dice
    // NADA de la reserva. Para declarar cómo se relaciona el cupo, la cita tiene que nombrarlo.
    const r = validarDeclaracionReserva({ ...base, incluidas: true, cita: 'DOCM núm. 240 de 12 de diciembre de 2025 — 327 plazas convocadas en total', plazasLibres: 327, plazasDiscapacidad: 22 })
    expect(r.ok).toBe(false)
  })

  it('la cláusula en prosa del boletín vale igual que la fila de tabla', () => {
    const r = validarDeclaracionReserva({ ...base, incluidas: true, plazasLibres: 425, plazasDiscapacidad: 43,
      cita: 'Se convocan 425 plazas del Cuerpo de Auxilio Judicial. Del total de estas plazas se reservan 43 para personas con discapacidad.' })
    expect(r.ok).toBe(true)
  })

  it('NO pisa una declaración distinta que ya esté en BD', () => {
    const r = validarDeclaracionReserva({ ...base, incluidas: true, cita: CITA_CLM, plazasLibres: 327, plazasDiscapacidad: 22, actual: false })
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(/ya hay una declaración/)
  })

  it('avisa (sin error) si ya está declarado igual: reejecutar es idempotente', () => {
    const r = validarDeclaracionReserva({ ...base, incluidas: true, cita: CITA_CLM, plazasLibres: 327, plazasDiscapacidad: 22, actual: true })
    expect(r.ok).toBe(true)
    expect(r.avisos.join(' ')).toMatch(/ya está declarado/)
  })
})

// [T-218, segunda tanda] La otra forma de probar «aparte»: el boletín ENUMERA los dos cupos y no
// imprime la suma. Es como está escrito el BOCM de tcae-sermas-madrid, la convocatoria con el mayor
// error absoluto en riesgo de toda la lista (131 plazas).
describe('validarDeclaracionReserva — «aparte» probado por enumeración de cupos', () => {
  const { validarDeclaracionReserva } = require('@/lib/convocatoria/correccionPlazas.cjs')
  const base = { url: 'https://www.bocm.es/x.PDF', motivo: 'El BOCM enumera los dos cupos del turno libre y la reserva es el 7% del total de las convocadas.' }

  const CITA_BOCM = 'Las plazas convocadas se proveerán por el sistema de turno libre, y se dividen en dos cupos: — Plazas del cupo general: 1.747. — Plazas del cupo de reserva para personas con discapacidad: 131.'

  it('acepta la enumeración aunque el total (1.878) NO esté impreso', () => {
    const r = validarDeclaracionReserva({ ...base, incluidas: false, cita: CITA_BOCM, plazasLibres: 1747, plazasDiscapacidad: 131 })
    expect(r.ok).toBe(true)
  })

  it('NO basta con que aparezcan las dos cifras: «de las cuales» significa lo contrario', () => {
    // Mismas dos cifras, sentido opuesto. Sin marca de separación, declarar «aparte» exige el total.
    const r = validarDeclaracionReserva({
      ...base, incluidas: false, plazasLibres: 425, plazasDiscapacidad: 43,
      cita: 'Se convocan 425 plazas del Cuerpo de Auxilio Judicial, de las cuales 43 se reservan para personas con discapacidad.',
    })
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(/468/) // el total que implicaría, y que no está escrito
  })

  it('la enumeración no sirve para colar un «dentro» sin su total', () => {
    const r = validarDeclaracionReserva({ ...base, incluidas: true, cita: CITA_BOCM, plazasLibres: 1878, plazasDiscapacidad: 131 })
    expect(r.ok).toBe(false)
  })
})
