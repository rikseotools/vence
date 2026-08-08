/**
 * [T-718] Un detector no publica una cifra sin declarar sus anclas.
 *
 * Los casos NO son inventados: reproducen los tres fallos de medición del 08/08/2026, que iban
 * camino de decidir cosas reales.
 *   1. Se dio por «suelo sano» un 36 % que era la propia avería → [T-692] casi se cierra en falso.
 *   2. Un detector dijo «2 de 21 artículos son resumen»; eran 21 de 21 (solo miraba la 1ª palabra).
 *   3. El siguiente intento marcó la CONSTITUCIÓN (4.606 preguntas) como texto no literal.
 *
 * El tercero es el que justifica la regla dura de este módulo: **sin anclas negativas no vale**.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { evaluarAnclas, validarAnclas, explicarAnclas } = require('@/lib/calidad/anclas.cjs')

const ANCLAS_OK = {
  positivos: [{ id: 'decreto-168-art-1', porque: 'es una descripción nuestra, no el articulado del BOJA' }],
  negativos: [{ id: 'CE-art-14', porque: 'la Constitución está importada literal: no puede salir nunca' }],
}

describe('evaluarAnclas (T-718)', () => {
  it('el detector caza su positivo y respeta su negativo → verde', () => {
    const r = evaluarAnclas(['decreto-168-art-1'], ANCLAS_OK)
    expect(r.ok).toBe(true)
    expect(explicarAnclas('x', r)).toBe('')
  })

  it('EL FALLO Nº2: el criterio se afloja y deja de cazar su positivo → rojo', () => {
    const r = evaluarAnclas([], ANCLAS_OK)
    expect(r.ok).toBe(false)
    expect(r.positivosPerdidos.map((a: { id: string }) => a.id)).toEqual(['decreto-168-art-1'])
    expect(explicarAnclas('resumen', r)).toContain('DEJÓ DE CAZAR')
  })

  it('EL FALLO Nº3: el criterio caza de más y marca la Constitución → rojo', () => {
    const r = evaluarAnclas(['decreto-168-art-1', 'CE-art-14'], ANCLAS_OK)
    expect(r.ok).toBe(false)
    expect(r.negativosCazados.map((a: { id: string }) => a.id)).toEqual(['CE-art-14'])
    expect(explicarAnclas('resumen', r)).toContain('CAZA DE MÁS')
  })

  it('acepta Set además de array (los detectores devuelven de todo)', () => {
    expect(evaluarAnclas(new Set(['decreto-168-art-1']), ANCLAS_OK).ok).toBe(true)
  })

  it('compara por texto: un id numérico no se escapa por el tipo', () => {
    const anclas = {
      positivos: [{ id: '42', porque: 'caso verificado a mano el 08/08, sigue siendo resumen' }],
      negativos: [{ id: '7', porque: 'literal comprobado contra el boletín, no puede salir' }],
    }
    expect(evaluarAnclas([42], anclas).ok).toBe(true)
    expect(evaluarAnclas([42, 7], anclas).negativosCazados).toHaveLength(1)
  })
})

describe('validarAnclas — las reglas que impiden engañarse', () => {
  it('sin anclas NEGATIVAS no vale: «márcalo todo» pasaría el examen', () => {
    const motivo = validarAnclas({ positivos: ANCLAS_OK.positivos, negativos: [] })
    expect(motivo).toContain('NEGATIVAS')
    // Y el resultado NO puede salir ok aunque cace todos sus positivos.
    const r = evaluarAnclas(['decreto-168-art-1'], { positivos: ANCLAS_OK.positivos, negativos: [] })
    expect(r.ok).toBe(false)
    expect(r.motivoInvalido).toContain('NEGATIVAS')
  })

  it('sin anclas POSITIVAS tampoco: no se podría afirmar que sigue cazando lo suyo', () => {
    expect(validarAnclas({ positivos: [], negativos: ANCLAS_OK.negativos })).toContain('POSITIVAS')
  })

  it('un ancla sin porqué es un id pegado: el siguiente la borrará cuando estorbe', () => {
    expect(validarAnclas({
      positivos: [{ id: 'a', porque: 'corto' }],
      negativos: ANCLAS_OK.negativos,
    })).toContain('porqué')
  })

  it('el mismo id no puede ser positivo y negativo a la vez', () => {
    expect(validarAnclas({
      positivos: [{ id: 'a', porque: 'verificado a mano: es un resumen' }],
      negativos: [{ id: 'a', porque: 'verificado a mano: es literal' }],
    })).toContain('dos veces')
  })

  it('unas anclas bien declaradas no dan motivo', () => {
    expect(validarAnclas(ANCLAS_OK)).toBeNull()
  })

  it('sin declarar nada, el veredicto es «mal declaradas», no «verde»', () => {
    // Importa: si `undefined` pasara como verde, un detector sin anclas publicaría su cifra.
    const r = evaluarAnclas(['lo-que-sea'], undefined)
    expect(r.ok).toBe(false)
    expect(explicarAnclas('x', r)).toContain('mal declaradas')
  })
})
