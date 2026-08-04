/**
 * «No se manda un enlace que no se ha abierto» — ahora lo comprueba el código.
 *
 * Los tres casos que fijan el criterio son REALES y los tres han pasado en esta casa:
 *   · CE art. 53 → `#a53` lleva al artículo 53 ✅ (lo que se envió el 02/08)
 *   · Código Civil → `#a3` EXISTE y lleva a «Artículo 301 a 324. (Derogados)» ❌ (el fallo
 *     que no da 404 y por eso engaña)
 *   · LO 3/2018 → `#a17` no existe; el artículo 17 vive en `#a1-9` ❌
 */

const {
  extraerEnlacesBoe,
  anclaDe,
  articuloCitadoEnElTexto,
  extraerCitas,
  verificarDocumento,
} = require('@/lib/impugnaciones/verificarEnlaces.cjs')

describe('lo que se saca del mensaje', () => {
  const mensaje = `Hola Pepe,

El artículo 53.2 dice: «Cualquier ciudadano podrá recabar la tutela de las libertades y derechos reconocidos en el artículo 14 y la Sección primera del Capítulo segundo».

Puedes verlo aquí: https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229#a53

Muchas gracias.`

  it('encuentra el enlace del BOE sin llevarse el punto final', () => {
    expect(extraerEnlacesBoe(mensaje)).toEqual([
      'https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229#a53',
    ])
  })

  it('saca el ancla', () => {
    expect(anclaDe('https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229#a53')).toBe('a53')
    expect(anclaDe('https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229')).toBeNull()
  })

  it('coge el artículo que INTRODUCE la cita, no el primero que se nombra', () => {
    // El caso real: la respuesta a Pepe empieza rebatiendo lo del artículo 14 y luego cita
    // el 53.2. Con el primero, el guardarraíl abortaba un mensaje correcto.
    expect(articuloCitadoEnElTexto(mensaje)).toBe('53')
  })

  it('saca la cita entrecomillada', () => {
    expect(extraerCitas(mensaje)[0]).toContain('Cualquier ciudadano podrá recabar')
  })

  it('no confunde una comilla decorativa corta con una cita', () => {
    expect(extraerCitas('dice «sí» y poco más')).toEqual([])
  })
})

describe('verificarDocumento', () => {
  // Trozo con la forma real del BOE: id, marcador de bloque y rúbrica.
  const CE = `
    <p class="parrafo" id="a53"> [Bloque 62: #a53] </p>
    <p class="articulo">Artículo 53</p>
    <p>1. Los derechos y libertades reconocidos en el Cap&iacute;tulo segundo vinculan a todos los poderes p&uacute;blicos.</p>
    <p>2. Cualquier ciudadano podr&aacute; recabar la tutela de las libertades y derechos reconocidos en el art&iacute;culo 14 y la Secci&oacute;n primera del Cap&iacute;tulo segundo.</p>`

  it('✅ el ancla lleva al artículo que decimos y la cita está literal', () => {
    const r = verificarDocumento(CE, {
      ancla: 'a53',
      articulo: '53',
      citas: ['Cualquier ciudadano podrá recabar la tutela de las libertades y derechos reconocidos en el artículo 14'],
    })
    expect(r.ok).toBe(true)
    expect(r.problemas).toEqual([])
    expect(r.tituloDelBloque).toBe('Artículo 53')
  })

  // Las leyes viejas rotulan «Art. 20.» y no «Artículo 20». Sin aceptar la abreviatura, la
  // regex saltaba a la primera referencia cruzada del cuerpo y abortaba el envío de un
  // mensaje CORRECTO diciendo «lleva a Artículo 23» (impugnación `70110a29`, 04/08). Un
  // falso positivo con diagnóstico seguro es peor que no comprobar: manda a «arreglar» un
  // enlace que estaba bien.
  const MADRID = `
    <p class="parrafo" id="a20"> [Bloque 29: #a20] </p>
    <p class="articulo">Art. 20.</p>
    <p>1. De conformidad con el art&iacute;culo 23 del Estatuto de Autonom&iacute;a, el Consejo de Gobierno cesa tras la celebraci&oacute;n de elecciones a la Asamblea.</p>`

  it('✅ acepta la rúbrica ABREVIADA «Art. 20.» de las leyes viejas', () => {
    const r = verificarDocumento(MADRID, { ancla: 'a20', articulo: '20' })
    expect(r.ok).toBe(true)
    expect(r.problemas).toEqual([])
    expect(r.tituloDelBloque).toBe('Artículo 20')
  })

  it('❌ una referencia cruzada en MINÚSCULA no valida un ancla equivocada', () => {
    // El cuerpo del art. 20 nombra el «artículo 23», pero en minúscula porque es una
    // remisión, no una rúbrica. Si esto pasara, el ancla #a20 valdría para el 23.
    const r = verificarDocumento(MADRID, { ancla: 'a20', articulo: '23' })
    expect(r.ok).toBe(false)
    expect(r.problemas[0]).toContain('NO lleva al artículo 23')
    expect(r.problemas[0]).toContain('Artículo 20')
  })

  it('❌ el ancla EXISTE pero lleva a otro artículo (el caso del Código Civil)', () => {
    const CC = `<p id="a3"> [Bloque 9: #a3] </p><p class="articulo">Artículo 301 a 324</p><p>(Derogados)</p>`
    const r = verificarDocumento(CC, { ancla: 'a3', articulo: '3' })
    expect(r.ok).toBe(false)
    expect(r.problemas[0]).toContain('NO lleva al artículo 3')
    expect(r.problemas[0]).toContain('Artículo 301')
  })

  it('❌ el ancla no existe (el caso de la LO 3/2018, donde el 17 vive en #a1-9)', () => {
    const LO = `<p id="a1-9"> [Bloque 23: #a1-9] </p><p class="articulo">Artículo 17</p>`
    const r = verificarDocumento(LO, { ancla: 'a17', articulo: '17' })
    expect(r.ok).toBe(false)
    expect(r.problemas[0]).toContain('NO EXISTE')
  })

  it('❌ la cita no está en el documento (cita inventada o de otra norma)', () => {
    const r = verificarDocumento(CE, {
      ancla: 'a53',
      articulo: '53',
      citas: ['El plazo será de tres meses desde la notificación'],
    })
    expect(r.ok).toBe(false)
    expect(r.problemas[0]).toContain('NO aparece literal')
  })

  it('la comparación aguanta acentos codificados y saltos de línea', () => {
    const r = verificarDocumento(CE, {
      ancla: 'a53',
      articulo: '53',
      citas: ['los derechos y libertades reconocidos\n   en el Capítulo segundo vinculan a todos los poderes públicos'],
    })
    expect(r.ok).toBe(true)
  })

  it('sin ancla no inventa problemas: un enlace al documento entero es legítimo', () => {
    const r = verificarDocumento(CE, { ancla: null, articulo: '53' })
    expect(r.ok).toBe(true)
  })
})
