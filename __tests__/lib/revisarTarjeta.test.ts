// Unit del detector REAL de tarjetas mentirosas (scripts/audit-convocatoria-completitud.cjs), no una
// copia. Los casos salen del triaje del 16/07: la landing de celador-sescam-clm anunciaba «537 plazas
// totales» y «Examen 2026: 18/04» cuando el DOCM nº 240 (NID 2025/9540) dice 115+4+9=128 y no existía
// convocatoria (estado oep_aprobada, exam_date NULL). Las COLUMNAS eran correctas: mentía la tarjeta,
// porque landing_estadisticas es texto libre donde alguien teclea un número.
const { revisarTarjeta } = require('../../scripts/audit-convocatoria-completitud.cjs')

const kinds = (row: unknown, t: unknown) =>
  (revisarTarjeta(row, t) as Array<{ kind: string }>).map((f) => f.kind)

// celador-sescam-clm el día que se destapó
const CELADOR = { l: 115, p: 4, d: 9, total: 128, exam_date: null }
// administrativo-navarra: el caso del 4º turno (264+264+51 + 6 de violencia de género = 585)
const NAVARRA = { l: 264, p: 264, d: 51, total: '585', exam_date: null }

describe('revisarTarjeta — una tarjeta no puede afirmar lo que la BD desmiente', () => {
  test('REGRESIÓN: «537 plazas totales» con 128 en la BD (caso real celador-sescam-clm)', () => {
    expect(kinds(CELADOR, { numero: '537', texto: 'Plazas totales' }))
      .toContain('tarjeta_contradice_columnas')
  })

  test('REGRESIÓN: «Examen 2026 18/04» sin exam_date en la BD — inventado', () => {
    // Segunda mentira de la misma landing: se vendía una fecha de examen futura, ya pasada, de un
    // proceso que ni siquiera está convocado (solo la OEP aprobada).
    expect(kinds(CELADOR, { numero: '18/04', texto: 'Examen 2026' }))
      .toContain('tarjeta_examen_sin_fecha_en_bd')
    expect(kinds(CELADOR, { numero: '2026', texto: 'Examen' }))
      .toContain('tarjeta_examen_sin_fecha_en_bd')
  })

  test('REGRESIÓN: «7 jun» también es una fecha (caso real tcae-aragon)', () => {
    // La 1ª versión del regex solo entendía "18/04" y "2026". tcae-aragon anuncia «[7 jun] Fecha
    // examen 2026» con exam_date NULL y estado 'examen_realizado' (el examen YA se hizo) y se coló.
    expect(kinds(CELADOR, { numero: '7 jun', texto: 'Fecha examen 2026' }))
      .toContain('tarjeta_examen_sin_fecha_en_bd')
    expect(kinds(CELADOR, { numero: '12 de marzo', texto: 'Examen' }))
      .toContain('tarjeta_examen_sin_fecha_en_bd')
  })

  test('REGRESIÓN bigint: la tarjeta HONESTA de Navarra no se acusa (7 falsos positivos de 11)', () => {
    // plazas_total sale de un sum() sobre jsonb → BIGINT → node-pg lo entrega como STRING "585".
    // Sin Number(), [264,264,51,"585"].includes(585) era false y el auditor llamaba mentirosas a
    // Navarra, La Rioja, Canarias, Murcia, Galicia y el SAS. El ruido apaga los guardarraíles.
    expect(revisarTarjeta(NAVARRA, { numero: '585', texto: 'Plazas totales' })).toEqual([])
  })

  test('cualquier lectura razonable de las columnas vale', () => {
    // El libre solo, el total, o libre+discapacidad: todas son formas legítimas de contarlo.
    expect(revisarTarjeta(CELADOR, { numero: '115', texto: 'Plazas turno libre' })).toEqual([])
    expect(revisarTarjeta(CELADOR, { numero: '128', texto: 'Plazas totales' })).toEqual([])
    expect(revisarTarjeta(CELADOR, { numero: '124', texto: 'Plazas (libre+discap.)' })).toEqual([])
    // Con separador de millares, como las escribe la gente
    expect(revisarTarjeta({ l: 1390, p: 124, d: 120, total: 1634, exam_date: null },
      { numero: '1.634', texto: 'Plazas totales' })).toEqual([])
  })

  test('las variables NO pueden mentir: se resuelven contra la vista al renderizar', () => {
    expect(revisarTarjeta(CELADOR, { numero: '{plazasTotal}', texto: 'Plazas OEP 2025' })).toEqual([])
    expect(revisarTarjeta(CELADOR, { numero: '{plazasLibres}', texto: 'Plazas turno libre' })).toEqual([])
  })

  test('sin cifras en la BD no se acusa a nadie: solo contradicciones DEMOSTRABLES', () => {
    // 2.178 de 2.542 filas del catálogo tienen plazas_total NULL (catalogadas sin cifras). Que no
    // podamos probar que miente no significa que mienta: gritar sin pruebas es lo que apaga la alarma.
    expect(revisarTarjeta({ l: null, p: null, d: null, total: null, exam_date: null },
      { numero: '537', texto: 'Plazas totales' })).toEqual([])
  })

  test('no se mete donde no la llaman', () => {
    const row = { l: 115, p: 4, d: 9, total: 128, exam_date: null }
    // "90 preguntas en el examen" lleva la palabra examen pero 90 no es una fecha
    expect(revisarTarjeta(row, { numero: '90', texto: 'Preguntas en el examen' })).toEqual([])
    // tarjetas que no hablan de plazas ni de examen
    expect(revisarTarjeta(row, { numero: 'ESO', texto: 'Título requerido' })).toEqual([])
    expect(revisarTarjeta(row, { numero: '15', texto: 'Temas oficiales' })).toEqual([])
    // entry malformada (snapshot viejo de cache con otro esquema) no debe reventar
    expect(revisarTarjeta(row, { label: 'x', value: 3 })).toEqual([])
    expect(revisarTarjeta(row, null)).toEqual([])
  })

  // ── Hallazgos de la auditoría adversarial (agente fresco sobre el diff, 16/07). Cada uno es un
  //    test que mis propios tests NO tenían: se agrupaban alrededor de lo que yo había cambiado.
  test('AUDITORÍA — falsos NEGATIVOS: la mentira no se escapa por cómo esté escrita', () => {
    // No todo el mundo escribe "plazas"
    expect(kinds(CELADOR, { numero: '537', texto: 'Vacantes ofertadas' }))
      .toContain('tarjeta_contradice_columnas')
    expect(kinds(CELADOR, { numero: '537', texto: 'Puestos convocados' }))
      .toContain('tarjeta_contradice_columnas')
    // "537+" y "~537" siguen afirmando 537
    expect(kinds(CELADOR, { numero: '537+', texto: 'Plazas' })).toContain('tarjeta_contradice_columnas')
    expect(kinds(CELADOR, { numero: '~537', texto: 'Plazas' })).toContain('tarjeta_contradice_columnas')
    // Fechas con guion o con el mes delante
    expect(kinds(CELADOR, { numero: '18-04-2026', texto: 'Examen' }))
      .toContain('tarjeta_examen_sin_fecha_en_bd')
    expect(kinds(CELADOR, { numero: 'abril 2026', texto: 'Examen' }))
      .toContain('tarjeta_examen_sin_fecha_en_bd')
  })

  test('AUDITORÍA — falsos POSITIVOS: no gritar a quien no miente', () => {
    // "..." pasa el regex de dígitos-y-puntos y da NaN: no afirma ninguna cifra
    expect(revisarTarjeta(CELADOR, { numero: '...', texto: 'Plazas' })).toEqual([])
    // Describir el examen PASADO no es anunciar el de esta convocatoria
    expect(revisarTarjeta(CELADOR, { numero: '2025', texto: 'Último examen oficial' })).toEqual([])
    expect(revisarTarjeta(CELADOR, { numero: '2024', texto: 'Examen anterior' })).toEqual([])
  })

  test('con exam_date en la BD, anunciar el examen es legítimo', () => {
    expect(revisarTarjeta({ l: 115, p: 4, d: 9, total: 128, exam_date: '2026-04-18' },
      { numero: '18/04', texto: 'Examen 2026' })).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// citaEsBasura — la regla no tenía UN solo test y ya se había equivocado una vez (rechazaba la cita
// del caso Marta por no llevar un verbo de su lista blanca). El 17/07 se equivocó otra vez, en la
// dirección contraria: tumbó las tres citas del SAS, que son filas de tabla del Anexo del Decreto
// 211/2025 — la prueba correcta de unas plazas, y sin una palabra de prosa.
describe('citaEsBasura — no toda prueba es una cláusula', () => {
  const { citaEsBasura } = require('../../scripts/audit-convocatoria-completitud.cjs')

  it('la fila de tabla del SAS PRUEBA las plazas aunque no tenga prosa', () => {
    const cita =
      'ANEXO I «Acceso libre» — CATEGORÍA/ESPECIALIDAD · TOTAL LIBRE · CUPO GENERAL · CUPO DISCAPACIDAD → ' +
      '«ENFERMERO/A 1.988 1.789 199». ANEXO II «Promoción interna» → «ENFERMERO/A 300 270 30».'
    expect(citaEsBasura(cita, [1789, 300, 199])).toBe(false)
  })

  it('el membrete del boletín NO prueba nada, aunque tenga cifras', () => {
    // El caso que dio origen a la regla (SERMAS, 16/07).
    expect(citaEsBasura('VIERNES 4 DE JULIO DE 2025 B.O.C.M. Núm. 158 Pág. 171', [66, 64, 9])).toBe(true)
  })

  it('una cláusula en prosa pasa sin necesitar cifras — es el caso Marta', () => {
    expect(citaEsBasura('La celebración del primer ejercicio se realizará en mayo de 2027', [])).toBe(false)
  })

  it('sin prosa, UNA cifra suelta no basta: podría ser coincidencia del nº de página', () => {
    expect(citaEsBasura('B.O.C.M. Núm. 66 Pág. 1712 — ANEXO II', [66, 64, 9])).toBe(true)
  })

  it('una cita vacía o de dos palabras es basura', () => {
    expect(citaEsBasura('', [1789, 199])).toBe(true)
    expect(citaEsBasura('ANEXO I', [1789, 199])).toBe(true)
  })

  it('los puntos de millar del boletín no rompen el cotejo (1.789 ↔ 1789)', () => {
    expect(citaEsBasura('CELADOR/A 729 656 73 · CELADOR/A 100 90 10', [656, 100, 73])).toBe(false)
  })
})
