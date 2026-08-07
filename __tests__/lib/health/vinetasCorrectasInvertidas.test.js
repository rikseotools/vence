const { reparar, esNegativa, esPositiva, invertirVineta } = require('@/lib/health/vinetasCorrectasInvertidas.cjs')

// Casos REALES del banco (T-219, medido 06/08/2026), verificados uno a uno contra el texto
// del artículo en BD: en los 9, las opciones "las demás" SÍ aparecen literalmente en el
// artículo (o quedan explícitamente incluidas/excluidas por él) y la clave es la única que no
// encaja — confirma que el defecto vive en la POLARIDAD de la viñeta, no en la clave.
describe('vinetasCorrectasInvertidas — reparar (casos reales verificados contra el artículo)', () => {
  it('8d8b8e01 (art. 117 EAAnd) — plantilla "no es correcta según lo dispuesto"', () => {
    const exp =
      '**Por qué A) es la incorrecta (correcta como respuesta):** El presidente delega, no designa.\n\n' +
      '**Por qué las demás opciones son correctas:**\n\n' +
      '- **B)** "Designar y separar a los Consejeros y Consejeras." - Esta opción no es correcta según lo dispuesto en la normativa aplicable.\n' +
      '- **C)** "Dirigir y coordinar la actividad del Consejo de Gobierno." - Esta opción no es correcta según lo dispuesto en la normativa aplicable.\n' +
      '- **D)** "Proponer consultas populares." - Esta opción no es correcta según lo dispuesto en la normativa aplicable.'
    const out = reparar(exp)
    expect(out).not.toBeNull()
    expect(out).toContain('- **B)** "Designar y separar a los Consejeros y Consejeras." - Esta opción sí es correcta según lo dispuesto en la normativa aplicable.')
    expect(out).toContain('- **C)** "Dirigir y coordinar la actividad del Consejo de Gobierno." - Esta opción sí es correcta según lo dispuesto en la normativa aplicable.')
    expect(out).toContain('- **D)** "Proponer consultas populares." - Esta opción sí es correcta según lo dispuesto en la normativa aplicable.')
    // El párrafo de la clave, INTACTO — este script no toca esa parte.
    expect(out).toContain('**Por qué A) es la incorrecta (correcta como respuesta):** El presidente delega, no designa.')
  })

  it('6ca2ca57 (Decreto 622/2019 art. 3) — plantilla con la contradicción interna "no es correcta porque sí"', () => {
    const exp =
      '**Por qué B es correcta:** La respuesta correcta es "Libre concurrencia."\n\n' +
      '**Por qué las demás opciones son correctas:**\n\n' +
      '- **A)** "Eficacia y eficiencia." - Esta opción no es correcta porque sí está contemplada en la normativa aplicable.\n' +
      '- **C)** "Economía procedimental y organizativa." - Esta opción no es correcta porque sí está contemplada en la normativa aplicable.\n' +
      '- **D)** "Transparencia administrativa." - Esta opción no es correcta porque sí está contemplada en la normativa aplicable.'
    const out = reparar(exp)
    expect(out).toContain('- **A)** "Eficacia y eficiencia." - Esta opción sí es correcta porque sí está contemplada en la normativa aplicable.')
    // Ya no queda ningún "no es correcta" en el bloque reparado.
    const bloque = out.slice(out.indexOf('Por qué las demás'))
    expect(bloque).not.toMatch(/\bno es correcta\b/i)
  })

  it('747792da (Reglamento Parlamento And. art. 27) — plantilla "- No es correcta según lo establecido"', () => {
    const exp =
      '**Por qué C es correcta:** La Mesa tiene 4 Vicepresidentes según esta opción, pero el artículo dice 3.\n\n' +
      '**Por qué las demás opciones son correctas:**\n\n' +
      '- **A)** "El Presidente dirige y coordina la acción de la Mesa." - No es correcta según lo establecido en la normativa aplicable.\n' +
      '- **B)** "La Mesa es el órgano rector de la Cámara." - No es correcta según lo establecido en la normativa aplicable.\n' +
      '- **D)** "La Mesa ostenta la representación colegiada." - No es correcta según lo establecido en la normativa aplicable.'
    const out = reparar(exp)
    expect(out).toContain('- **A)** "El Presidente dirige y coordina la acción de la Mesa." - Sí es correcta según lo establecido en la normativa aplicable.')
  })
})

describe('vinetasCorrectasInvertidas — reparar NO toca lo que no debe', () => {
  it('sin cabecera "las demás son correctas" → null (no aplica)', () => {
    expect(reparar('**Por qué A es correcta:** porque sí.\n\n**Por qué las demás son incorrectas:**\n- **B)** es cierto.')).toBeNull()
  })

  it('bloque de una sola viñeta → null (sin patrón sistemático que confirmar)', () => {
    const exp = '**Por qué las demás son correctas:**\n\n- **B)** "X" - No es correcta.'
    expect(reparar(exp)).toBeNull()
  })

  it('bloque YA coherente (viñetas afirman "sí es correcta") → null, no se toca', () => {
    const exp =
      '**Por qué las demás son correctas:**\n\n' +
      '- **A)** Sí es correcta, aparece en el artículo.\n' +
      '- **B)** Sí es correcta, aparece en el artículo.'
    expect(reparar(exp)).toBeNull()
  })

  it('MEZCLA (una viñeta niega, otra afirma) → null, exige lectura humana', () => {
    // El caso real de "todas las anteriores": una opción SÍ es un distractor falso por sí
    // misma (ese "no es correcta" es legítimo) y las otras SÍ afirman correctamente.
    const exp =
      '**Por qué las demás son correctas:**\n\n' +
      '- **A) Calendario** — Sí aparece en la barra de navegación.\n' +
      '- **D) Todos los elementos anteriores** — Es incorrecta porque Carpetas no forma parte de la barra.'
    expect(reparar(exp)).toBeNull()
  })

  it('no toca el enunciado, las opciones ni el párrafo de la clave — solo el bloque de las demás', () => {
    const exp =
      'ENUNCIADO INTACTO\n\n**Por qué B es correcta:** argumento de la clave, intacto.\n\n' +
      '**Por qué las demás opciones son correctas:**\n\n' +
      '- **A)** "x" - No es correcta según lo establecido.\n' +
      '- **C)** "y" - No es correcta según lo establecido.'
    const out = reparar(exp)
    expect(out.startsWith('ENUNCIADO INTACTO')).toBe(true)
    expect(out).toContain('**Por qué B es correcta:** argumento de la clave, intacto.')
  })

  it('preserva el resto del texto tras el bloque (cola: otra sección "**...")', () => {
    const exp =
      '**Por qué las demás son correctas:**\n\n' +
      '- **A)** "x" - No es correcta según lo establecido.\n' +
      '- **C)** "y" - No es correcta según lo establecido.\n\n' +
      '**Nota adicional:** esto debe sobrevivir intacto.'
    const out = reparar(exp)
    expect(out).toContain('**Nota adicional:** esto debe sobrevivir intacto.')
  })
})

describe('esNegativa / esPositiva / invertirVineta', () => {
  it('esNegativa detecta las dos variantes de plantilla medidas', () => {
    expect(esNegativa('- **A)** "x" - Esta opción no es correcta según lo dispuesto.')).toBe(true)
    expect(esNegativa('- **A)** "x" - No es correcta según lo establecido.')).toBe(true)
    expect(esNegativa('- **A)** "x" - Es incorrecta porque no aparece.')).toBe(true)
  })

  it('esNegativa NO marca una viñeta que ya afirma correctamente', () => {
    expect(esNegativa('- **A)** "x" - Sí es correcta, aparece en el artículo.')).toBe(false)
  })

  it('esPositiva detecta una viñeta ya coherente y la distingue de una negativa', () => {
    expect(esPositiva('- **A)** Sí es correcta, aparece en el artículo.')).toBe(true)
    expect(esPositiva('- **A)** No es correcta según lo dispuesto.')).toBe(false)
  })

  it('invertirVineta preserva mayúscula inicial de frase', () => {
    expect(invertirVineta('No es correcta según lo establecido.')).toBe('Sí es correcta según lo establecido.')
    expect(invertirVineta('- Esta opción no es correcta porque sí está contemplada.'))
      .toBe('- Esta opción sí es correcta porque sí está contemplada.')
  })

  it('invertirVineta no toca una viñeta que no menciona la polaridad', () => {
    const v = '- **A)** "x" - Es la respuesta prevista en el artículo 5.'
    expect(invertirVineta(v)).toBe(v)
  })
})
