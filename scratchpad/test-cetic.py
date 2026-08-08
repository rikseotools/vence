import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/__tests__/lib/generacion/siglasSinDesarrollar.test.js')
s = p.read_text()

ancla = """  it('acepta el número de la norma como desarrollo (Ley 58/2003 ≡ LGT)', () => {"""

nuevo = """  // Se coló en el lote de Guardia Civil T17 (T-679) y NINGUNA de las dos auditorías la vio: la
  // explicación decía «los declara la CETIC según el artículo 10» sin desarrollarla antes en esa
  // misma pregunta. El gate falló por partida doble — no estaba catalogada, Y el llamante no le
  // pasaba el campo `explanation`. Por eso el tercer caso de aquí mira la EXPLICACIÓN, no solo el
  // enunciado: catalogarla sin ejercitar esa vía dejaría medio agujero abierto.
  it('marca CETIC sin desarrollar, también cuando aparece solo en la explicación (T-679, 08/08/2026)', () => {
    expect(analizarSiglas('Según el artículo 10, ¿qué declara la CETIC?').faltan).toEqual(['CETIC'])
    expect(
      analizarSiglas('Según el artículo 10, ¿qué declara la Comisión de Estrategia TIC (CETIC)?').faltan
    ).toEqual([])
    // La sigla NO está en el enunciado: solo en la explicación. Es el caso real de T-679.
    expect(
      analizarSiglas('Según el artículo 8, ¿qué determina la Estrategia TIC?',
        'Los proyectos de interés prioritario los declara la CETIC según el artículo 10.').faltan
    ).toEqual(['CETIC'])
    expect(
      analizarSiglas('Según el artículo 8, ¿qué determina la Estrategia TIC?',
        'Los proyectos los declara la Comisión de Estrategia TIC (CETIC) según el artículo 10.').faltan
    ).toEqual([])
  })

""" + ancla

assert ancla in s, 'ancla no encontrada'
p.write_text(s.replace(ancla, nuevo, 1))
print('test de CETIC añadido')
