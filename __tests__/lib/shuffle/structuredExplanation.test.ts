import {
  StructuredExplanation,
  renderStructuredExplanation,
  parseLetterFormatExplanation,
  isStructuredExplanation,
  indexToLetter,
  letterToIndex,
} from '@/lib/shuffle/structuredExplanation'

describe('structuredExplanation — letras por posición', () => {
  const data: StructuredExplanation = {
    v: 1,
    cita: { ref: 'Art. 12.6 Decreto 30/2025', texto: 'corresponde al órgano competente en materia de atención a la ciudadanía' },
    options: {
      '0': 'No al órgano de administración electrónica.',
      '1': 'corresponde al órgano competente en materia de atención a la ciudadanía.',
      '2': 'No a la subsecretaría de cada departamento.',
      '3': 'No al centro directivo de publicidad institucional.',
    },
  }

  test('orden natural (sin barajar): letra de la correcta = su posición original', () => {
    const out = renderStructuredExplanation(data, { correctOption: 1, optionOrder: null, nOptions: 4 })
    expect(out).toContain('**Por qué B es correcta:**')
    expect(out).toContain('- **A)** No al órgano de administración electrónica.')
    expect(out).toContain('- **C)** No a la subsecretaría de cada departamento.')
    expect(out).toContain('- **D)** No al centro directivo de publicidad institucional.')
    // el header no debe listar la correcta como bullet
    expect(out).not.toMatch(/- \*\*B\)\*\*/)
  })

  test('barajado: la correcta (original 1) cae en posición 0 → header dice A y su razón viaja con ella', () => {
    // order[i] = original mostrado en posición i. Correcta (1) en pos 0.
    const order = [1, 0, 2, 3]
    const out = renderStructuredExplanation(data, { correctOption: 1, optionOrder: order, nOptions: 4 })
    expect(out).toContain('**Por qué A es correcta:** corresponde al órgano competente')
    // pos1=original0, pos2=original2, pos3=original3
    expect(out).toContain('- **B)** No al órgano de administración electrónica.')
    expect(out).toContain('- **C)** No a la subsecretaría de cada departamento.')
    expect(out).toContain('- **D)** No al centro directivo de publicidad institucional.')
  })

  test('barajado no trivial: cada razón sigue a SU opción y las letras son coherentes con la posición', () => {
    const order = [3, 1, 0, 2] // pos0=D,pos1=B(correcta),pos2=A,pos3=C
    const out = renderStructuredExplanation(data, { correctOption: 1, optionOrder: order, nOptions: 4 })
    expect(out).toContain('**Por qué B es correcta:**') // correcta cae en pos1 = letra B
    expect(out).toContain('- **A)** No al centro directivo de publicidad institucional.') // original3 en pos0=A
    expect(out).toContain('- **C)** No al órgano de administración electrónica.') // original0 en pos2=C
    expect(out).toContain('- **D)** No a la subsecretaría de cada departamento.') // original2 en pos3=D
  })

  test('frame select_incorrect invierte los encabezados', () => {
    const d2: StructuredExplanation = { ...data, frame: 'select_incorrect' }
    const out = renderStructuredExplanation(d2, { correctOption: 1, optionOrder: null, nOptions: 4 })
    expect(out).toContain('**Por qué B es la incorrecta:**')
    expect(out).toContain('**Por qué las demás son correctas:**')
  })

  test('3 opciones (D=null): no inventa la cuarta', () => {
    const d3: StructuredExplanation = { v: 1, options: { '0': 'ra', '1': 'rb', '2': 'rc' } }
    const out = renderStructuredExplanation(d3, { correctOption: 2, optionOrder: [2, 0, 1], nOptions: 3 })
    expect(out).toContain('**Por qué A es correcta:** rc')
    expect(out).toContain('- **B)** ra')
    expect(out).toContain('- **C)** rb')
    expect(out).not.toContain('D)')
  })
})

describe('isStructuredExplanation', () => {
  test('válida con cobertura completa', () => {
    expect(isStructuredExplanation({ v: 1, options: { '0': 'a', '1': 'b', '2': 'c', '3': 'd' } }, 4)).toBe(true)
  })
  test('inválida si falta una razón', () => {
    expect(isStructuredExplanation({ v: 1, options: { '0': 'a', '1': 'b', '2': 'c' } }, 4)).toBe(false)
  })
  test('inválida si razón vacía', () => {
    expect(isStructuredExplanation({ v: 1, options: { '0': 'a', '1': '  ', '2': 'c' } }, 3)).toBe(false)
  })
  test('inválida si v != 1 o no es objeto', () => {
    expect(isStructuredExplanation({ v: 2, options: { '0': 'a' } }, 1)).toBe(false)
    expect(isStructuredExplanation(null, 4)).toBe(false)
    expect(isStructuredExplanation('texto', 4)).toBe(false)
  })
})

describe('indexToLetter / letterToIndex', () => {
  test('ida y vuelta', () => {
    for (let i = 0; i < 5; i++) expect(letterToIndex(indexToLetter(i))).toBe(i)
    expect(letterToIndex('b')).toBe(1)
    expect(letterToIndex('Z')).toBe(-1)
  })
})

describe('parseLetterFormatExplanation — migración del §8.1', () => {
  const realExample = `> **Art. 12.6 Decreto 30/2025**
> "La gestión y coordinación del sistema de información de atención a la ciudadanía y del catálogo de procedimientos y servicios corresponde al órgano competente en materia de atención a la ciudadanía."

**Por qué B es correcta:** corresponde al órgano competente en materia de atención a la ciudadanía.

**Por qué las demás son incorrectas:**
- **A)** No al órgano de administración electrónica.
- **C)** No a la subsecretaría de cada departamento.
- **D)** No al centro directivo de publicidad institucional.`

  test('parsea cita + razón correcta + bullets a estructura completa', () => {
    const parsed = parseLetterFormatExplanation(realExample, { correctOption: 1, nOptions: 4 })
    expect(parsed).not.toBeNull()
    expect(parsed!.v).toBe(1)
    expect(parsed!.cita?.ref).toContain('Art. 12.6 Decreto 30/2025')
    expect(parsed!.cita?.texto).toContain('atención a la ciudadanía')
    expect(parsed!.options['1']).toContain('órgano competente')
    expect(parsed!.options['0']).toContain('administración electrónica')
    expect(parsed!.options['2']).toContain('subsecretaría')
    expect(parsed!.options['3']).toContain('publicidad institucional')
  })

  test('round-trip: parse → render en orden natural preserva header y bullets', () => {
    const parsed = parseLetterFormatExplanation(realExample, { correctOption: 1, nOptions: 4 })!
    const rendered = renderStructuredExplanation(parsed, { correctOption: 1, optionOrder: null, nOptions: 4 })
    expect(rendered).toContain('**Por qué B es correcta:**')
    expect(rendered).toContain('- **A)** No al órgano de administración electrónica.')
    expect(rendered).toContain('- **C)** No a la subsecretaría de cada departamento.')
    expect(rendered).toContain('- **D)** No al centro directivo de publicidad institucional.')
  })

  test('round-trip + barajado: la razón de la correcta viaja a su nueva letra', () => {
    const parsed = parseLetterFormatExplanation(realExample, { correctOption: 1, nOptions: 4 })!
    const order = [1, 0, 2, 3] // correcta (orig 1) a pos 0 = A
    const rendered = renderStructuredExplanation(parsed, { correctOption: 1, optionOrder: order, nOptions: 4 })
    expect(rendered).toContain('**Por qué A es correcta:** corresponde al órgano competente')
    expect(rendered).toContain('- **B)** No al órgano de administración electrónica.')
  })

  test('párrafo largo multibloque (razón correcta con varios párrafos) parsea', () => {
    const long = `> **Art. 39.1 RDL 5/2015 (TREBEP)**: "Los órganos... son los Delegados de Personal y las Juntas de Personal."

**Por qué B es correcta:**

El art. 39.1 TREBEP enumera taxativamente los dos órganos. No existen otros.

**Por qué las demás son incorrectas:**

- **A)** Incorrecta. Los Comités de empresa son de los trabajadores laborales.
- **C)** Incorrecta. Los delegados sindicales son de las secciones sindicales.
- **D)** Incorrecta. Combina bien pero añade los Comités de empresa.`
    const parsed = parseLetterFormatExplanation(long, { correctOption: 1, nOptions: 4 })
    expect(parsed).not.toBeNull()
    expect(parsed!.options['1']).toContain('taxativamente')
    expect(parsed!.options['0']).toContain('Comités de empresa')
    expect(parsed!.options['3']).toContain('Combina bien')
  })

  test('devuelve null si la cabecera no coincide con correct_option (no migrar a ciegas)', () => {
    const parsed = parseLetterFormatExplanation(realExample, { correctOption: 2, nOptions: 4 })
    expect(parsed).toBeNull()
  })

  test('devuelve null si falta el bullet de alguna opción (cobertura incompleta)', () => {
    const incompleto = `**Por qué B es correcta:** razón.

**Por qué las demás son incorrectas:**
- **A)** falta la C y la D.`
    expect(parseLetterFormatExplanation(incompleto, { correctOption: 1, nOptions: 4 })).toBeNull()
  })

  test('cierre "**Clave:**" tras los bullets → outro (no se pega a la última opción)', () => {
    const conClave = `**Por qué B es correcta:** el fuero es el del deudor.

**Por qué las demás son incorrectas:**
- **A)** Sitúa el fuero en el acreedor.
- **C)** Repite el error del acreedor.
- **D)** No existe fuero a voluntad del acreedor.

**Clave:** Monitorio: fuero exclusivo del deudor.`
    const parsed = parseLetterFormatExplanation(conClave, { correctOption: 1, nOptions: 4 })!
    expect(parsed).not.toBeNull()
    // la razón de D NO debe contener el "Clave"
    expect(parsed.options['3']).toContain('No existe fuero')
    expect(parsed.options['3']).not.toContain('Clave')
    expect(parsed.outro).toContain('**Clave:**')
    // al barajar (D→posición mostrada A), el Clave sigue AL FINAL, no en medio
    const order = [3, 1, 2, 0] // pos0=D, pos1=B(correcta), pos2=C, pos3=A
    const out = renderStructuredExplanation(parsed, { correctOption: 1, optionOrder: order, nOptions: 4 })
    const claveIdx = out.indexOf('**Clave:**')
    const lastBulletIdx = out.lastIndexOf('- **')
    expect(claveIdx).toBeGreaterThan(lastBulletIdx) // Clave después del último bullet
  })

  test('devuelve null en texto libre sin formato §8.1', () => {
    expect(parseLetterFormatExplanation('La respuesta es correcta porque el artículo lo dice.', { correctOption: 0, nOptions: 4 })).toBeNull()
    expect(parseLetterFormatExplanation('', { correctOption: 0, nOptions: 4 })).toBeNull()
    expect(parseLetterFormatExplanation(null, { correctOption: 0, nOptions: 4 })).toBeNull()
  })
})

describe('parseLetterFormatExplanation — el INTRO en prosa no se pierde (regresión 27/07)', () => {
  // Medido sobre el banco vivo: explicaciones de 1.024 caracteres se renderizaban en 629 porque
  // el párrafo de contexto anterior a la cabecera desaparecía al migrar. Lo cazó la guarda de
  // no-regresión del backfill (render ≠ original), NO la invariante ida-vuelta: lo que se pierde
  // en el parseo nunca entra en la estructura, así que el round-trip cerraba tan feliz.
  const conIntro = [
    'En las bases de datos relacionales, la terminología de tablas tiene significados precisos.',
    '',
    '> **Art. 1** "cita literal"',
    '',
    '**Por qué A es correcta:** Es la definición exacta.',
    '',
    '**Por qué las demás son incorrectas:**',
    '- **B)** Confunde fila con columna.',
    '- **C)** Es otro concepto.',
    '- **D)** No aparece.',
  ].join('\n')

  test('captura el párrafo de contexto en `intro`', () => {
    const d = parseLetterFormatExplanation(conIntro, { correctOption: 0, nOptions: 4 })
    expect(d).not.toBeNull()
    expect(d!.intro).toContain('terminología de tablas tiene significados precisos')
  })

  test('y el render lo devuelve, así que no se pierde texto al transcribir', () => {
    const d = parseLetterFormatExplanation(conIntro, { correctOption: 0, nOptions: 4 })!
    const r = renderStructuredExplanation(d, { correctOption: 0, optionOrder: null, nOptions: 4 })
    expect(r).toContain('terminología de tablas tiene significados precisos')
    expect(r).toContain('Art. 1')
    expect(r).toContain('**Por qué A es correcta:**')
  })

  test('sin intro, no se inventa el campo', () => {
    const sinIntro = '> **Art. 1** "cita"\n\n**Por qué A es correcta:** Sí.\n\n**Por qué las demás son incorrectas:**\n- **B)** No.\n- **C)** No.\n- **D)** No.'
    const d = parseLetterFormatExplanation(sinIntro, { correctOption: 0, nOptions: 4 })
    expect(d!.intro).toBeUndefined()
  })
})

describe('formato §5.1 de IMPUGNACIONES — se transcribe y se re-renderiza igual', () => {
  // El banco tiene DOS formatos legacy vivos y este lo produce cada corrección de impugnación
  // (13.559 preguntas activas). Sin soportarlo, el trabajo de impugnaciones seguiría generando
  // explicaciones no barajables.
  const { parseImpugnacionFormatExplanation } = require('../../../lib/shuffle/structuredExplanation')

  const expl = [
    'La respuesta correcta es la B).',
    '',
    '**A)** INCORRECTA — El plazo de un mes corresponde al recurso de reposición.',
    '',
    '**B)** CORRECTA — El artículo fija dos meses para el contencioso-administrativo.',
    '',
    '**C)** INCORRECTA — Ese plazo no aparece en el precepto.',
    '',
    '**D)** INCORRECTA — Confunde el plazo con el de subsanación.',
  ].join('\n')

  test('se reconoce y guarda su estilo', () => {
    const d = parseImpugnacionFormatExplanation(expl, { correctOption: 1, nOptions: 4 })
    expect(d).not.toBeNull()
    expect(d.estilo).toBe('impugnacion')
    expect(d.intro).toContain('La respuesta correcta es')
    expect(Object.keys(d.options)).toHaveLength(4)
  })

  test('el render lo devuelve en SU formato, no en el del boletín', () => {
    const d = parseImpugnacionFormatExplanation(expl, { correctOption: 1, nOptions: 4 })
    const r = renderStructuredExplanation(d, { correctOption: 1, optionOrder: null, nOptions: 4 })
    expect(r).toContain('La respuesta correcta es')
    expect(r).toContain('**B)** CORRECTA')
    expect(r).not.toContain('Por qué B es correcta')   // ese es el estilo del OTRO formato
    expect(r).not.toContain('Por qué las demás')
  })

  test('al barajar, la marca CORRECTA viaja con su opción (cambia la letra, no el contenido)', () => {
    const d = parseImpugnacionFormatExplanation(expl, { correctOption: 1, nOptions: 4 })
    // order[pos] = índice original: la correcta (1) pasa a la posición 0.
    const r = renderStructuredExplanation(d, { correctOption: 1, optionOrder: [1, 0, 2, 3], nOptions: 4 })
    expect(r).toContain('**A)** CORRECTA — El artículo fija dos meses')
    expect(r).toContain('**B)** INCORRECTA — El plazo de un mes')
  })

  test('si la marca CORRECTA no cae en la clave real, NO se migra (contradicción de contenido)', () => {
    expect(parseImpugnacionFormatExplanation(expl, { correctOption: 2, nOptions: 4 })).toBeNull()
  })

  test('no confunde el otro formato: una explicación §8.1 no entra por aquí', () => {
    const ochoUno = '> **Art. 1** "cita"\n\n**Por qué A es correcta:** Sí.\n\n**Por qué las demás son incorrectas:**\n- **B)** No.'
    expect(parseImpugnacionFormatExplanation(ochoUno, { correctOption: 0, nOptions: 2 })).toBeNull()
  })
})

describe('mismoContenidoExplicacion — el comparador que decide si una transcripción es segura', () => {
  const { mismoContenidoExplicacion } = require('../../../lib/shuffle/structuredExplanation')

  test('tolera la variante de marcador sin paréntesis (1.210 preguntas del banco la usan)', () => {
    const a = '**Por qué las demás son incorrectas:**\n- **A)** No procede.\n- **C)** Tampoco.'
    const b = '**Por qué las demás son incorrectas:**\n- **A** No procede.\n- **C** Tampoco.'
    expect(mismoContenidoExplicacion(a, b)).toBe(true)
  })

  test('tolera que cambie la LETRA de la cabecera (es lo que hace el barajado)', () => {
    expect(mismoContenidoExplicacion('**Por qué A es correcta:** Sí.', '**Por qué C es correcta:** Sí.')).toBe(true)
  })

  test('tolera que los bullets vengan en otro ORDEN', () => {
    const a = '- **A)** Uno.\n- **B)** Dos.'
    const b = '- **B)** Dos.\n- **A)** Uno.'
    expect(mismoContenidoExplicacion(a, b)).toBe(true)
  })

  test('NO tolera que se pierda texto — que es justo lo que hay que impedir', () => {
    const conIntro = 'Contexto importante.\n\n**Por qué A es correcta:** Sí.'
    const sinIntro = '**Por qué A es correcta:** Sí.'
    expect(mismoContenidoExplicacion(conIntro, sinIntro)).toBe(false)
  })

  test('NO tolera que cambie una razón', () => {
    expect(mismoContenidoExplicacion('- **A)** Uno.', '- **A)** Otra cosa.')).toBe(false)
  })
})

describe('escribir en el formato NUEVO: render determinista (el camino que sí es fiable)', () => {
  // Manuel señaló el defecto del planteamiento inicial: escribir el texto y PARSEARLO después es
  // heurístico y falla (43,7% y 15,3% según el formato). Al revés no: de la estructura al texto
  // es un render determinista. Estos tests fijan esa dirección, que es la que usan las
  // explicaciones nuevas (`scripts/aplicar-explicacion.ts`).
  const estructura = {
    v: 1 as const,
    cita: { ref: 'Art. 103.1 CE', texto: 'La Administración sirve con objetividad los intereses generales.' },
    options: {
      '0': 'Es el mandato literal del precepto.',
      '1': 'Atribuye una función de dirección política que corresponde al Gobierno.',
      '2': 'Confunde la actuación administrativa con el control jurisdiccional.',
      '3': 'Introduce un criterio de oportunidad que el artículo no contempla.',
    },
  }

  test('el texto generado cumple el formato §8.1 que el gate exige', () => {
    const t = renderStructuredExplanation(estructura, { correctOption: 0, optionOrder: null, nOptions: 4 })
    expect(t).toMatch(/\*\*Por qué A es correcta:\*\*/)
    expect(t).toContain('**Por qué las demás son incorrectas:**')
    expect(t).toContain('> **Art. 103.1 CE**')
    // Y las tres razones de los distractores, cada una con su letra de posición.
    expect(t).toMatch(/- \*\*B\)\*\*/)
    expect(t).toMatch(/- \*\*C\)\*\*/)
    expect(t).toMatch(/- \*\*D\)\*\*/)
  })

  test('render → parse → render vuelve al mismo texto (la ida y vuelta cierra)', () => {
    const t1 = renderStructuredExplanation(estructura, { correctOption: 0, optionOrder: null, nOptions: 4 })
    const reparsed = parseLetterFormatExplanation(t1, { correctOption: 0, nOptions: 4 })
    expect(reparsed).not.toBeNull()
    const t2 = renderStructuredExplanation(reparsed!, { correctOption: 0, optionOrder: null, nOptions: 4 })
    expect(t2).toBe(t1)
  })

  test('escrito así, al barajar cada razón sigue con su opción', () => {
    const barajado = renderStructuredExplanation(estructura, { correctOption: 0, optionOrder: [2, 0, 3, 1], nOptions: 4 })
    // La correcta (índice 0) pasa a la posición 1 → letra B.
    expect(barajado).toContain('**Por qué B es correcta:** Es el mandato literal del precepto.')
    // Y la razón del índice 2 va en la posición 0 → letra A.
    expect(barajado).toContain('- **A)** Confunde la actuación administrativa')
  })
})

describe('mismoContenidoExplicacion — el bloque SIN viñeta del estilo impugnación (regresión 27/07)', () => {
  const { mismoContenidoExplicacion } = require('../../../lib/shuffle/structuredExplanation')

  test('reconoce "**A)** …" al principio de línea, sin guion', () => {
    // El estilo §5.1 escribe así cada opción. Sin reconocerlo, esos bloques se comparaban como
    // texto corrido y al barajar —que los reordena— el canary daba 40 falsos fallos.
    const a = 'La respuesta correcta es la **B**.\n\n**A)** INCORRECTA — Uno.\n\n**B)** CORRECTA — Dos.'
    const b = 'La respuesta correcta es la **B**.\n\n**B)** CORRECTA — Dos.\n\n**A)** INCORRECTA — Uno.'
    expect(mismoContenidoExplicacion(a, b)).toBe(true)
  })

  test('y sigue cazando la pérdida de texto en ese mismo estilo', () => {
    const completo = 'La respuesta correcta es la **B**.\n\n**A)** INCORRECTA — Uno.\n\n**B)** CORRECTA — Dos.'
    const mutilado = '**A)** INCORRECTA — Uno.\n\n**B)** CORRECTA — Dos.'
    expect(mismoContenidoExplicacion(completo, mutilado)).toBe(false)
  })
})

describe('etiqueta descolgada: "- **A) Este equipo:** …" (regresión 27/07, 186 preguntas)', () => {
  // Bullets con la etiqueta descriptiva DENTRO de las negritas del marcador. Al separar marcador
  // y razón, la razón se quedaba con el cierre de negritas y sin su apertura, y el render producía
  // markdown ROTO ("Este equipo:** muestra…") que el opositor vería tal cual. Lo destapó la
  // clasificación de diferencias previa al despliegue, no un test.
  const conEtiqueta = [
    '**Por qué D es correcta:** Sí.',
    '',
    '**Por qué las demás son incorrectas:**',
    '- **A) Este equipo:** muestra dispositivos de almacenamiento.',
    '- **B) Archivo:** da acceso a la vista Backstage.',
    '- **C) Compartir:** publica el documento.',
  ].join('\n')

  test('la razón recupera su apertura de negritas', () => {
    const d = parseLetterFormatExplanation(conEtiqueta, { correctOption: 3, nOptions: 4 })
    expect(d!.options['0']).toBe('**Este equipo:** muestra dispositivos de almacenamiento.')
  })

  test('y el render deja los asteriscos BALANCEADOS (markdown válido)', () => {
    const d = parseLetterFormatExplanation(conEtiqueta, { correctOption: 3, nOptions: 4 })!
    const r = renderStructuredExplanation(d, { correctOption: 3, optionOrder: null, nOptions: 4 })
    expect((r.match(/\*\*/g) || []).length % 2).toBe(0)
    expect(r).toContain('- **A)** **Este equipo:** muestra')
  })

  test('una razón normal no se toca', () => {
    const normal = '**Por qué A es correcta:** Sí.\n\n**Por qué las demás son incorrectas:**\n- **B)** No procede.\n- **C)** Tampoco.\n- **D)** No.'
    const d = parseLetterFormatExplanation(normal, { correctOption: 0, nOptions: 4 })
    expect(d!.options['1']).toBe('No procede.')
  })
})

describe('T-201 — los tres huecos que cazó la sesión de impugnaciones', () => {
  const { parseImpugnacionFormatExplanation } = require('../../../lib/shuffle/structuredExplanation')
  const { isShuffleEligible, optionsReferenceOtherOptions } = require('../../../lib/shuffle/classifyShuffleMode')

  test('HALLAZGO 1: la cita escrita como {ref, texto} YA NO se pierde en el estilo impugnación', () => {
    // El render solo leía `cita.bloque`, así que la forma DOCUMENTADA producía un texto sin cita
    // — y uno de los casos venía justo de una impugnación por la cita mal transcrita.
    const d: any = {
      v: 1, estilo: 'impugnacion',
      cita: { ref: 'Art. 4 CE', texto: 'La bandera de España está formada por tres franjas horizontales.' },
      options: { '0': 'Es el texto del precepto.', '1': 'No es lo que dice.', '2': 'Tampoco.', '3': 'No.' },
    }
    const r = renderStructuredExplanation(d, { correctOption: 0, optionOrder: null, nOptions: 4 })
    expect(r).toContain('> **Art. 4 CE**')
    expect(r).toContain('tres franjas horizontales')
  })

  test('HALLAZGO 2: emite la apertura y los veredictos que el validador §5.1 exige', () => {
    const d: any = {
      v: 1, estilo: 'impugnacion',
      options: { '0': 'Es el texto del precepto.', '1': 'No es lo que dice.', '2': 'Tampoco.', '3': 'No.' },
    }
    const r = renderStructuredExplanation(d, { correctOption: 1, optionOrder: null, nOptions: 4 })
    expect(r).toMatch(/^La respuesta correcta es la \*\*B\*\*\./)
    expect(r).toContain('**B)** CORRECTA —')
    expect(r).toContain('**A)** INCORRECTA —')
  })

  test('HALLAZGO 2-bis: al barajar, apertura y veredictos siguen a la opción, no a la letra', () => {
    const d: any = {
      v: 1, estilo: 'impugnacion',
      options: { '0': 'Uno.', '1': 'Dos.', '2': 'Tres.', '3': 'Cuatro.' },
    }
    // La correcta (índice 1) pasa a la posición 0 → debe ser la A y llevar CORRECTA.
    const r = renderStructuredExplanation(d, { correctOption: 1, optionOrder: [1, 0, 2, 3], nOptions: 4 })
    expect(r).toMatch(/^La respuesta correcta es la \*\*A\*\*\./)
    expect(r).toContain('**A)** CORRECTA — Dos.')
    expect(r).toContain('**B)** INCORRECTA — Uno.')
  })

  test('HALLAZGO 3: una OPCIÓN que cita a otra por su letra impide barajar', () => {
    const opciones = ['Lo que dice el artículo.', 'La respuesta b) es correcta y además amplía el plazo.', 'Otra cosa.', 'Ninguna.']
    expect(optionsReferenceOtherOptions(opciones)).toBe(true)
    expect(isShuffleEligible({ shuffle_mode: 'full', explanation: 'Explicación limpia sin letras.', options: opciones })).toBe(false)
    // Sin esa referencia cruzada, la misma pregunta sí es elegible.
    expect(isShuffleEligible({ shuffle_mode: 'full', explanation: 'Explicación limpia sin letras.', options: ['Uno.', 'Dos.', 'Tres.', 'Cuatro.'] })).toBe(true)
  })

  test('el veredicto no se duplica si la razón ya lo trae escrito (histórico)', () => {
    const d: any = { v: 1, estilo: 'impugnacion', options: { '0': 'CORRECTA — Sí.', '1': 'INCORRECTA — No.' } }
    const r = renderStructuredExplanation(d, { correctOption: 0, optionOrder: null, nOptions: 2 })
    expect(r).toContain('**A)** CORRECTA — Sí.')
    expect(r).not.toContain('CORRECTA — CORRECTA')
  })
})
