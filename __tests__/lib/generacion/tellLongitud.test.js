const { analizarLongitud } = require('../../../lib/generacion/tellLongitud')

// Casos reales de los batches del Bloque II / Bloque I de T-045.

describe('analizarLongitud — tell de longitud calibrado', () => {
  // --- Falsos positivos del ±30% plano que hubo que eliminar ---

  it('NO marca cuando la correcta es la MÁS CORTA (Ley 14/1990 art. 27)', () => {
    // se organiza en: viceconsejerías(31) / departamentos ministeriales(43) /
    // direcciones generales(37) / CONSEJERÍAS(27, correcta)
    const opts = [
      'se organiza en viceconsejerías.',
      'se organiza en departamentos ministeriales.',
      'se organiza en direcciones generales.',
      'se organiza en consejerías.',
    ]
    expect(analizarLongitud(opts, 3).tell).toBe(false)
  })

  it('NO marca cuando la correcta es media entre distractores cortos (Ley 14/1990 art. 23)', () => {
    const opts = [
      'la persona titular de la Presidencia.', // 37
      'la persona titular de la Dirección.', // 35 correcta
      'el Consejo Rector de la agencia.', // 32
      'la consejería competente en materia tributaria.', // 47
    ]
    expect(analizarLongitud(opts, 1).tell).toBe(false)
  })

  // --- Verdaderos positivos: el tell SÍ es explotable ---

  it('marca el patrón prohibido explícito (correcta >100 ch, distractor <60)', () => {
    const correcta = 'x'.repeat(140)
    const opts = [correcta, 'y'.repeat(40), 'z'.repeat(50), 'w'.repeat(55)]
    const r = analizarLongitud(opts, 0)
    expect(r.tell).toBe(true)
    expect(r.motivo).toContain('patrón prohibido')
  })

  it('marca cuando la correcta es la más larga y supera al mayor distractor en >30%', () => {
    const opts = ['a'.repeat(90), 'b'.repeat(60), 'c'.repeat(65), 'd'.repeat(55)]
    const r = analizarLongitud(opts, 0)
    expect(r.tell).toBe(true)
    expect(r.motivo).toContain('más larga')
  })

  // --- Negativos legítimos: opciones largas y equilibradas (ISD/ITPAJD/Patrimonio) ---

  it('NO marca opciones largas equilibradas (correcta la más larga pero por poco)', () => {
    const opts = ['a'.repeat(120), 'b'.repeat(110), 'c'.repeat(105), 'd'.repeat(115)]
    expect(analizarLongitud(opts, 0).tell).toBe(false)
  })

  it('NO marca cuando la correcta larga NO es la más larga', () => {
    const opts = ['a'.repeat(100), 'b'.repeat(130), 'c'.repeat(90), 'd'.repeat(95)]
    expect(analizarLongitud(opts, 0).tell).toBe(false)
  })
})
