import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/__tests__/lib/generacion/siglasSinDesarrollar.test.js')
s = p.read_text()

ancla = """  it('acepta el número de la norma como desarrollo (Ley 58/2003 ≡ LGT)', () => {"""

nuevo = """  // «REx» es lo CONTRARIO de «RD»/«TIC» (que están en la ALLOWLIST): una abreviatura NUESTRA que
  // el opositor no reconoce. 16 de las 17 preguntas del lote de Policía Nacional T11 la usaban a
  // pelo — el «LBRL a pelo» que dio origen a la regla, otra vez.
  it('marca REx sin desarrollar y la acepta con el nombre o el RD (T-681, 08/08/2026)', () => {
    expect(analizarSiglas('Según el artículo 220 del REx 2024, ¿qué ocurre?').faltan).toEqual(['REx'])
    expect(
      analizarSiglas('Según el artículo 220 del Reglamento de Extranjería (REx 2024), ¿qué ocurre?').faltan
    ).toEqual([])
    expect(
      analizarSiglas('Según el artículo 220 del Real Decreto 1155/2024 (REx 2024), ¿qué ocurre?').faltan
    ).toEqual([])
  })

  // El MISMO defecto del `\\b` de JavaScript que se arregló ese día en explicacionEcoClave (T-557),
  // aquí en el detector de candidatas: la Ó de «SANCIÓN» abre una frontera falsa y la palabra se
  // lee como la sigla «SANCI». Un aviso que salta en falso cada lote deja de leerse.
  it('una palabra con tilde NO se lee como sigla («la SANCIÓN» ≠ SANCI)', () => {
    for (const frase of [
      'el plazo de prescripción de la SANCIÓN será de cinco años',
      'la ADMINISTRACIÓN resolverá en el plazo previsto',
      'la RESOLUCIÓN pondrá fin al procedimiento',
    ]) {
      expect(analizarSiglas(frase).candidatas).toEqual([])
    }
  })

  it('…y las siglas de verdad se siguen viendo (el arreglo no ciega el detector)', () => {
    expect(analizarSiglas('del REGAGE se deriva la constancia').candidatas).toEqual(['REGAGE'])
    expect(analizarSiglas('el IPREM sube este año').candidatas).toEqual(['IPREM'])
  })

""" + ancla

assert ancla in s, 'ancla no encontrada'
p.write_text(s.replace(ancla, nuevo, 1))
print('tests de REx y SANCI añadidos')
