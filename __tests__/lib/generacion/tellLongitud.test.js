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

// --- (I) Tell INVERTIDO: la correcta destaca por ser la más corta ---
// Añadido 25/07/2026: la auditoría ciega lo cazó 7 veces en dos lotes seguidos
// (gen_atc_t202 y gen_atc_t214) y el detector no lo veía.

describe('analizarLongitud — tell invertido (correcta anómalamente corta)', () => {
  it('marca el caso severo del art. 231.1 LGT (42 ch frente a 95/96/98)', () => {
    const opts = [
      'En Pleno y en Salas, sin que quepa en ningún caso el funcionamiento unipersonal de sus miembros.', // 96
      'En Pleno, en Salas y en Secciones especializadas por razón de la materia objeto de reclamación.', // 95
      'Exclusivamente en Salas presididas por el Presidente del Tribunal o por el Vocal en quien delegue.', // 98
      'En Pleno, en Salas y de forma unipersonal.', // 42 correcta
    ]
    const r = analizarLongitud(opts, 3)
    expect(r.tell).toBe(true)
    expect(r.motivo).toMatch(/INVERTIDO/)
  })

  it('marca el art. 4.1 LGT (51 ch frente a distractores de 80-98)', () => {
    const opts = [
      'Corresponde al Estado y a las comunidades autónomas, mediante ley, de acuerdo con la Constitución.',
      'Corresponde exclusivamente al Estado, mediante ley orgánica aprobada por las Cortes Generales.',
      'Corresponde exclusivamente al Ministerio de Hacienda, mediante orden ministerial de desarrollo.',
      'Corresponde exclusivamente al Estado, mediante ley.',
    ]
    expect(analizarLongitud(opts, 3).tell).toBe(true)
  })

  it('NO marca el falso positivo ya calibrado (Ley 14/1990 art. 27: correcta 27 ch, mínimo distractor 31)', () => {
    // El más corto de los distractores solo la supera en un 15%: no destaca.
    const opts = [
      'se organiza en viceconsejerías.',
      'se organiza en departamentos ministeriales.',
      'se organiza en direcciones generales.',
      'se organiza en consejerías.',
    ]
    expect(analizarLongitud(opts, 3).tell).toBe(false)
  })

  it('NO marca si UN distractor se acerca a la correcta aunque otros sean largos', () => {
    // Basta que uno iguale el registro para que la correcta deje de ser "la rara".
    const opts = [
      'Se resolverán en única instancia por los tribunales económico-administrativos.', // 77 correcta
      'Se resolverán en única instancia por el Tribunal Económico-Administrativo Central.', // 81
      'Se resolverán en primera instancia, con alzada ante el Tribunal Económico-Administrativo Central.', // 96
      'Se resolverán en única instancia por órganos unipersonales del Ministerio de Hacienda.', // 85
    ]
    expect(analizarLongitud(opts, 0).tell).toBe(false)
  })
})
