// __tests__/lib/convocatoria/tipoDocumento.test.js
// Unit del núcleo REAL que tipa los documentos del hub de provenance (T-147).
//
// Todos los casos son CABECERAS REALES del corpus (27/07/2026), y los tres bloques de
// "REGRESIÓN" son los falsos positivos que destapó la simulación antes de escribir nada — que
// es justo para lo que existe simular. Sin ellos, la siguiente persona que toque las reglas los
// reintroduce sin enterarse.

const { clasificarTipoDocumento, cabecera } = require('../../../lib/convocatoria/tipoDocumento.cjs')

const tipo = (texto, extra = {}) => clasificarTipoDocumento({ texto, ...extra }).tipo

describe('cabecera — limpieza del ruido de portal', () => {
  test('quita el boilerplate de firma electrónica que desplaza la cabecera real', () => {
    const c = cabecera('Versión imprimible del documento. La integridad de este documento puede comprobarse en la sede. CSV: A0600AFP_A3NRUDZ1. Resolución por la que se convoca')
    expect(c).toMatch(/^resolucion por la que se convoca/)
  })

  test('normaliza tildes y mayúsculas (los boletines escriben como quieren)', () => {
    expect(cabecera('CORRECCIÓN DE ERRORES')).toBe('correccion de errores')
  })
})

describe('tipos con rúbrica propia', () => {
  test('lista_admitidos: la rúbrica administrativa fija', () => {
    expect(tipo('Resolución por la que se aprueba la relación provisional de personas aspirantes admitidas y excluidas'))
      .toBe('lista_admitidos')
    expect(tipo('Orden TDF/969/2025, por la que se aprueba la relación provisional de personas admitidas'))
      .toBe('lista_admitidos')
  })

  test('anuncio_fecha: cronograma, llamamiento y distribución por aulas', () => {
    expect(tipo('Cronograma procesos selectivos de acceso libre, a la escala de funcionarios')).toBe('anuncio_fecha')
    expect(tipo('Lugar, fecha y hora del examen. Especialidad: celador o celadora')).toBe('anuncio_fecha')
    expect(tipo('ACUERDO de la Comisión Permanente de Selección: distribución de opositores por aulas')).toBe('anuncio_fecha')
  })

  test('correccion_errores y resolucion_tribunal', () => {
    expect(tipo('DIPUTACIÓN PROVINCIAL DE HUESCA 4852 CORRECCIÓN DE ERRORES se hace público')).toBe('correccion_errores')
    expect(tipo('Orden por la que se acuerda la modificación del tribunal calificador del proceso')).toBe('resolucion_tribunal')
  })

  test('convocatoria: el verbo en forma resolutiva', () => {
    expect(tipo('Resolución de 22 de diciembre de 2025, de la Subsecretaría, por la que se convoca proceso selectivo'))
      .toBe('convocatoria')
    expect(tipo('Resolución del Ayuntamiento de Córdoba, referente a la convocatoria para proveer varias plazas'))
      .toBe('convocatoria')
  })

  test('bases: aprobar o contener las bases', () => {
    expect(tipo('EDICTO. La Teniente Alcalde aprobó mediante Decreto las bases de la convocatoria para la provisión'))
      .toBe('bases')
    expect(tipo('Anuncio: bases específicas para la cobertura de varias plazas OEP 2023')).toBe('bases')
  })

  test('oep_decreto: solo cuando el documento ES el decreto', () => {
    expect(tipo('Real Decreto 651/2025, de 15 de julio, por el que se aprueba la oferta de empleo público para 2025'))
      .toBe('oep_decreto')
  })

  test('REGRESIÓN: "ANEXO I: PROGRAMA DE MATERIAS" es temario aunque NO escriba "Tema N"', () => {
    // Caso real (Granada, 15 plazas): el temario enumera «1.», «2.»… y tiene cero "Tema N".
    // La guarda de estructura lo dejaba sin clasificar, así que no se clonaba.
    const t = 'Ayuntamiento de Granada. Subdirección General de Recursos Humanos. Auxiliar de Administración General (15 plazas). Oferta de Empleo Público 2023, 2024 y 2025. ANEXO I: PROGRAMA DE MATERIAS para el turno libre. 1. La Constitución Española. 2. La Administración Local.'
    expect(tipo(t)).toBe('temario')
  })

  test('temario: por estructura (≥5 "Tema N"), no por la palabra', () => {
    const conTemas = 'Programa de materias. ' + Array.from({ length: 6 }, (_, i) => `Tema ${i + 1}. Contenido.`).join(' ')
    expect(tipo(conTemas)).toBe('temario')
    // La convocatoria que MENCIONA el temario no es un temario.
    expect(tipo('Resolución por la que se convoca proceso selectivo. El temario para la provisión figura en el Anexo I'))
      .toBe('convocatoria')
  })
})

describe('calibraciones con documentos REALES que se quedaban sin clasificar (27/07)', () => {
  test('SAS Andalucía: "programas de materias" en PLURAL también es temario (costaba un documento por una `s`)', () => {
    expect(tipo('Resolución de 2 de agosto de 2024, de la Dirección General de Personal del Servicio Andaluz de Salud, por la que se aprueban y publican los nuevos programas de materias que habrán de regir las pruebas selectivas'))
      .toBe('temario')
  })

  test('Diputación de Huelva: el anexo suelto que EMPIEZA por "Tema 22" y no tiene rúbrica', () => {
    const t = 'Tema 22. El órgano de contratación en la esfera local. ' +
      Array.from({ length: 9 }, (_, i) => `Tema ${23 + i}. Materia de contratación.`).join(' ')
    expect(tipo(t)).toBe('temario')
  })

  test('…pero un documento que menciona DOS temas sueltos NO es un temario', () => {
    expect(tipo('Resolución por la que se corrige el Tema 3 y el Tema 4 del programa publicado')).not.toBe('temario')
  })

  test('REGRESIÓN: una NOTA INFORMATIVA que enumera los temas del ejercicio no es un temario', () => {
    // Caso real (Aragón): la simulación lo coló como temario antes de exigir que la enumeración
    // ARRANQUE el documento. Enumerar temas lo hacen muchos papeles; empezar por ellos, no.
    const t = 'Nota informativa del órgano de selección de las pruebas selectivas para ingreso en el Cuerpo Auxiliar de la Administración de la Comunidad Autónoma de Aragón. Se informa del reparto: ' +
      Array.from({ length: 10 }, (_, i) => `Tema ${i + 1}.`).join(' ')
    expect(tipo(t)).not.toBe('temario')
  })

  test('Salamanca: "convocatoria y bases para la cobertura de veintiocho plazas" es bases', () => {
    expect(tipo('IV. Administración Local. Ayuntamiento de Salamanca. Anuncio: convocatoria y bases para la cobertura en propiedad, mediante oposición libre, de veintiocho plazas de auxiliar administrativo'))
      .toBe('bases')
  })
})

describe('REGRESIONES medidas por la simulación (los 3 falsos positivos que costaron precisión)', () => {
  test('la convocatoria que CITA el decreto de la OEP no es un oep_decreto', () => {
    // Caso real: BOE-A-2026-10140 (INGESA). 4 de 4 de la primera muestra eran esto.
    const t = 'Resolución de 23 de abril de 2026, del Instituto Nacional de Gestión Sanitaria, por la que se convoca proceso selectivo. Con el fin de atender las necesidades de personal y en cumplimiento de lo dispuesto en el Real Decreto 651/2025, de 15 de julio, por el que se aprueba la oferta de empleo público correspondiente al ejercicio 2025'
    expect(tipo(t)).toBe('convocatoria')
  })

  test('el EXTRACTO del BOE de administración local no es las bases, aunque las nombre', () => {
    // Todos los extractos dicen esto: "se han publicado las bases que han de regir la convocatoria".
    const t = 'Resolución de 13 de julio de 2026, del Ayuntamiento de Córdoba, referente a la convocatoria para proveer varias plazas. En el «Boletín Oficial de la Provincia de Córdoba» se han publicado las bases que han de regir la convocatoria para proveer veintitrés plazas de Ordenanza'
    expect(tipo(t)).toBe('convocatoria')
  })

  test('la convocatoria que cita «y su corrección de errores» no es una corrección de errores', () => {
    // Caso real: las dos convocatorias de la Universidad de León.
    const t = 'Resolución de 15 de junio de 2026, de la Universidad de León, por la que se convoca proceso selectivo para ingreso en la escala administrativa. La Resolución de 20 de noviembre de 2023 y su corrección de errores establecen'
    expect(tipo(t)).toBe('convocatoria')
  })
})

describe('ante la duda, `nota` — el 70% del corpus no es documento de convocatoria', () => {
  test.each([
    ['Certificado de conformidad con el Esquema Nacional de Seguridad'],
    ['Guía para la tutoría. Instituto Asturiano de Administración Pública'],
    ['Catálogo de metodologías de formación'],
    ['El Servicio de Información Universitario (en adelante SIU) es un servicio de atención'],
    ['Instrucciones para la subsanación de solicitudes. Procesos selectivos de acceso libre'],
  ])('%s → nota', (texto) => {
    expect(tipo(texto)).toBe('nota')
  })

  test('sin texto ni título no inventa nada', () => {
    expect(clasificarTipoDocumento({})).toMatchObject({ tipo: 'nota', confianza: null })
  })
})

describe('confianza', () => {
  test('sube a alta cuando el título o la URL repiten la señal', () => {
    const r = clasificarTipoDocumento({
      texto: 'Resolución por la que se aprueba la relación provisional de personas aspirantes admitidas y excluidas',
      titulo: 'admitidos provisional relacion de aspirantes admitidos.pdf',
    })
    expect(r).toMatchObject({ tipo: 'lista_admitidos', confianza: 'alta' })
  })

  test('se queda en media cuando solo lo dice el cuerpo', () => {
    expect(clasificarTipoDocumento({
      texto: 'Resolución por la que se aprueba la relación provisional de personas aspirantes admitidas y excluidas',
      titulo: 'BOE A 2025 17462.pdf',
    }).confianza).toBe('media')
  })
})
