/**
 * Detector de explicaciones que reproducen la opción FALSA casi carácter por carácter, con la
 * palabra corregida pegada y SIN ningún veredicto (T-525).
 *
 * Los positivos son casos REALES del banco (medidos 04-05/08/2026, ver cabecera del núcleo puro);
 * los negativos son los tres tipos de falso positivo concretos que la calibración encontró y que
 * mantienen el corte en precisión ~90%+: preguntas de examen oficial con corta cita legítima,
 * checklist con marca ✓, y afirmación en prosa («cierto», «sí está», «está en el listado»).
 */

const {
  clasificaPregunta,
  esYuxtaposicion,
  segmentosPorLetra,
  pareceVeredicto,
  normaliza,
} = require('../../lib/health/explicacionYuxtaposicion.cjs')

describe('caso que motiva la ficha (impugnación b061898d, TUE art. 5.1)', () => {
  it('detecta la palabra corregida pegada sin veredicto', () => {
    const q = {
      option_a: 'La delimitación de las competencias de la Unión se rige por el principio de cooperación leal',
      option_b: 'La delimitación de las competencias de la Unión se rige por el principio de subsidiariedad',
      option_c: 'La delimitación de las competencias de la Unión se rige por el principio de proporcionalidad',
      option_d: 'La delimitación de las competencias de la Unión se rige por el principio de atribución',
      correct_option: 3,
      explanation:
        '- A) Art. 5.1: La delimitación de las competencias de la Unión se rige por el principio de cooperación leal atribución.\n' +
        '- B) no es el principio que rige la delimitación de competencias.\n' +
        '- C) no es el principio que rige la delimitación de competencias.',
    }
    const v = clasificaPregunta(q)
    expect(v.yuxtapuesta).toBe(true)
    expect(v.hallazgos.map((h) => h.letra)).toEqual(['A'])
  })
})

describe('reproducciones REALES del banco (positivos)', () => {
  it.each([
    // Corrección numérica pegada al final, sin coma ni veredicto.
    [
      'El número de miembros del Subcomité para la Prevención es de quince.',
      'El número de miembros del Subcomité para la Prevención es de quince veinticinco.',
    ],
    // Corrección en negrita pegada al final.
    [
      'Adoptar medidas que antepongan la protección individual a la colectiva.',
      'Adoptar medidas que antepongan la protección individual a la colectiva **colectiva a la individual.**',
    ],
    // Sustitución de un sujeto por otro, pegada sin marcar.
    [
      'Se hará saber por escrito al empresario presuntamente responsable y se pondrá, asimismo, en conocimiento de los trabajadores.',
      'Se hará saber por escrito al empresario presuntamente responsable y se pondrá, asimismo, en conocimiento de los trabajadores **de los Delegados de Prevención**.',
    ],
    // Reproducción literal a secas, sin ninguna palabra añadida ni veredicto.
    [
      'Si a la provocación hubiera seguido la perpetración del delito no se castigará como inducción.',
      'Si a la provocación hubiera seguido la perpetración del delito no se castigará como inducción.',
    ],
    // Corrección factual pegada (un lugar por otro).
    [
      'La sede de la Agencia se encuentra en Varsovia (Polonia).',
      'La sede de la Agencia se encuentra en Varsovia (Polonia) Budapest (Hungría).',
    ],
    // Valores legales sustituidos: "transparencia, disciplina y compañerismo" no es lo que dice la norma.
    [
      'Los miembros de la Guardia Civil deberán adecuar su actuación profesional a los principios de transparencia, disciplina y compañerismo.',
      'Art. 16: Los miembros de la Guardia Civil deberán adecuar su actuación profesional a los principios de transparencia, disciplina y compañerismo **jerarquía, disciplina y subordinación**.',
    ],
  ])('opción %j con segmento %j → yuxtaposición', (opcion, segmento) => {
    const q = {
      option_a: opcion,
      option_b: 'una opción cualquiera que no es ni la falsa ni la correcta, para completar el shape',
      option_c: 'otra opción de relleno con longitud suficiente para no disparar MIN_LEN',
      option_d: 'la opción correcta, con longitud suficiente también',
      correct_option: 3,
      explanation: `- A) ${segmento}\n- B) no aplica.\n- C) no aplica.`,
    }
    const v = clasificaPregunta(q)
    expect(v.yuxtapuesta).toBe(true)
    expect(v.hallazgos[0].letra).toBe('A')
  })
})

describe('la opción CORRECTA nunca se evalúa (aunque su segmento "contenga" su propio texto)', () => {
  it('no marca la letra que coincide con correct_option', () => {
    const opcionLarga = 'Esta es la opción correcta, con longitud de sobra para pasar MIN_LEN'
    const q = {
      option_a: 'una opción de relleno con longitud suficiente para pasar el filtro de longitud',
      option_b: 'otra opción de relleno con longitud suficiente para pasar el filtro de longitud',
      option_c: opcionLarga,
      option_d: 'una opción más de relleno con longitud suficiente para pasar el filtro',
      correct_option: 2, // letra C
      explanation: `- A) no aplica.\n- B) no aplica.\n- C) ${opcionLarga}\n- D) no aplica.`,
    }
    const v = clasificaPregunta(q)
    expect(v.hallazgos.some((h) => h.letra === 'C')).toBe(false)
  })
})

describe('exclusión 1 — opción demasiado corta (MIN_LEN)', () => {
  it('no marca "Sumar" aunque su segmento la reproduzca tal cual', () => {
    const v = esYuxtaposicion('Sumar', 'Sumar')
    expect(v.yuxtapuesta).toBe(false)
  })
})

describe('exclusión 2 — marca de veredicto por SÍMBOLO (checklist ✓/✗)', () => {
  it('no marca cuando el segmento lleva un check, aunque reproduzca la opción', () => {
    const opcion = 'Esta opción sí pertenece a la lista pedida por el enunciado de la pregunta'
    const v = esYuxtaposicion(opcion, `${opcion} ✓`)
    expect(v.yuxtapuesta).toBe(false)
  })
})

describe('exclusión 3 — afirmación en prosa (mismo fenómeno que el símbolo, en palabras)', () => {
  it.each([
    ['Es flexible, con dos o tres luces.', 'Es flexible, con dos o tres luces: cierto.'],
    ['Es una hormona que circula por la sangre.', 'Sí es una hormona que circula por la sangre hasta su órgano diana.'],
    [
      'La legalidad de la actuación administrativa.',
      'La legalidad de la actuación administrativa sí está en el artículo 106.1.',
    ],
    [
      'Las entidades acreditadas de supervisión de los códigos de conducta.',
      'Las entidades acreditadas de supervisión de los códigos de conducta también están incluidas en el artículo 70.1.e.',
    ],
    ['El Centro Andaluz de Medicina del Deporte.', 'El Centro Andaluz de Medicina del Deporte está en el listado.'],
    ['Consolidación por posición', 'Consolidación por posición → Existe'],
  ])('no marca %j / %j (afirma, no calla)', (opcion, segmento) => {
    const v = esYuxtaposicion(opcion, segmento)
    expect(v.yuxtapuesta).toBe(false)
  })

  it('NO excluye "existe" cuando es el verbo natural del propio texto legal (no un checklist)', () => {
    // Caso real: la opción D del banco empieza literalmente por "Existe provocación cuando…" —
    // si `AFIRMACION_RE` excluyera cualquier "existe" suelto, este positivo real se perdería.
    const opcion = 'Existe provocación cuando indirectamente se incita por medio de imprenta a la perpetración de un delito.'
    const v = esYuxtaposicion(opcion, opcion)
    expect(v.yuxtapuesta).toBe(true)
  })
})

describe('citar la opción falsa es LEGÍTIMO si va seguida de veredicto explícito', () => {
  it.each([
    ['incorrecta porque el plazo real es de cuatro años, no de tres'],
    ['Esto es FALSO: el artículo exige informe previo de la Fiscalía'],
    ['no corresponde al Presidente, sino a la Mesa'],
    ['en realidad el plazo es de cuatro años'],
  ])('no marca cuando el segmento explica %j', (cola) => {
    const opcion = 'Una opción con longitud suficiente para pasar el filtro de longitud mínima'
    const v = esYuxtaposicion(opcion, `${opcion} ${cola}`)
    expect(v.yuxtapuesta).toBe(false)
  })
})

describe('banda de ratio de longitud — fuera de [0.85, 1.7] no es "casi la misma frase"', () => {
  it('un segmento MUCHO más largo que la opción es una explicación real que la cita de paso', () => {
    const opcion = 'Una opción con longitud suficiente para pasar el filtro de longitud mínima'
    const segmentoLargo =
      `${opcion} y además hay que tener en cuenta muchísimos otros factores contextuales que ` +
      'alargan este segmento mucho más allá de la proporción que define el fenómeno perseguido aquí'
    const v = esYuxtaposicion(opcion, segmentoLargo)
    expect(v.yuxtapuesta).toBe(false)
  })
})

describe('preguntas sin la plantilla de viñetas', () => {
  it('una explicación en prosa libre no produce segmentos ni falsos positivos', () => {
    const q = {
      option_a: 'algo',
      option_b: 'algo más',
      option_c: 'algo distinto',
      option_d: 'la correcta',
      correct_option: 3,
      explanation: 'Esto es una explicación normal en prosa, sin viñetas por opción.',
    }
    expect(clasificaPregunta(q)).toEqual({ yuxtapuesta: false, hallazgos: [] })
  })
})

describe('segmentosPorLetra', () => {
  it('divide por viñeta y admite tanto ")" como "." tras la letra', () => {
    const s = segmentosPorLetra('- A) primero\n- B. segundo\n- C) tercero')
    expect(s.A).toBe('primero')
    expect(s.B).toBe('segundo')
    expect(s.C).toBe('tercero')
  })

  it('sin viñetas devuelve objeto vacío', () => {
    expect(segmentosPorLetra('sin viñetas aquí')).toEqual({})
  })
})

describe('pareceVeredicto / normaliza — utilidades', () => {
  it('normaliza acentos, comillas y puntuación de cierre', () => {
    expect(normaliza('«Atribución», no cooperación leal.')).toBe('atribucion, no cooperacion leal')
  })

  it('pareceVeredicto detecta palabra, símbolo y afirmación en prosa', () => {
    expect(pareceVeredicto('esto es incorrecto')).toBe(true)
    expect(pareceVeredicto('esto ✓')).toBe(true)
    expect(pareceVeredicto('esto también está incluido')).toBe(true)
    expect(pareceVeredicto('esto se repite tal cual, sin más')).toBe(false)
  })
})
