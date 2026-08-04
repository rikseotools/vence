// __tests__/health/oposicionSinTemario.test.ts
//
// El criterio de «esta persona eligió una oposición que no existe». [T-397]
// Los casos vienen de la medición del 01/08 contra la BD real: 183 oposiciones, 594 usuarios,
// 4 premium. La trampa del UUID no es hipotética — ya hizo publicar una cifra equivocada.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const det = require('@/lib/health/oposicionSinTemario.cjs')

describe('esOposicionPersonalizada — la guarda que ya hizo caer a una sesión', () => {
  it('un UUID es una oposición PERSONALIZADA, no una rota', () => {
    // Su temario vive en `custom_oposiciones`. Contarlas como error infla la cifra y obliga
    // a rectificar en público, que es lo que pasó en la medición anterior.
    expect(det.esOposicionPersonalizada('3f2a91c4-7b6e-4d21-9f80-1a2b3c4d5e6f')).toBe(true)
  })

  it('un slug del catálogo no lo es', () => {
    expect(det.esOposicionPersonalizada('agente_hacienda')).toBe(false)
    expect(det.esOposicionPersonalizada('auxiliar_administrativo_estado')).toBe(false)
  })

  it('no confunde un slug que empieza por hexadecimal con un UUID', () => {
    // «abcdef12_algo» tiene ocho hex al principio y NO es un UUID: sin el patrón completo
    // (los cinco grupos), un slug así se excluiría del recuento sin que nadie lo notara.
    expect(det.esOposicionPersonalizada('abcdef12_bombero_madrid')).toBe(false)
  })

  it('tolera nulo y vacío sin reventar', () => {
    expect(det.esOposicionPersonalizada(null)).toBe(false)
    expect(det.esOposicionPersonalizada(undefined)).toBe(false)
    expect(det.esOposicionPersonalizada('')).toBe(false)
  })

  it('el filtro SQL excluye lo mismo que el de JavaScript', () => {
    // Dos criterios distintos para la misma exclusión darían cifras distintas según quién
    // pregunte. El SQL es más laxo a propósito (prefijo), pero nunca puede dejar pasar un
    // UUID que el de JS sí excluiría.
    expect(det.SQL_EXCLUIR_PERSONALIZADAS).toContain('target_oposicion')
    expect(det.SQL_EXCLUIR_PERSONALIZADAS).toContain('!~')
  })
})

describe('clasificarEleccion — la banda la decide quién PAGA, no el volumen', () => {
  it('con un premium es error: está pagando por algo que no existe', () => {
    // Caso real: `agente_hacienda`, 16 usuarios y 2 premium (medido 01/08).
    const h = det.clasificarEleccion({ slug: 'agente_hacienda', usuarios: 16, premium: 2, temasActivos: 0 })
    expect(h).toMatchObject({ severity: 'error', usuarios: 16, premium: 2 })
  })

  it('solo free es warn, por mucho volumen que tenga', () => {
    // `enfermero` son 58 personas — la más numerosa — y aun así no sube de banda: no hay
    // cobro de por medio. Si el volumen subiera la banda, los premium quedarían enterrados
    // debajo de las populares y la lista dejaría de servir para reparar.
    const h = det.clasificarEleccion({ slug: 'enfermero', usuarios: 58, premium: 0, temasActivos: 0 })
    expect(h?.severity).toBe('warn')
  })

  it('con temario NO es hallazgo aunque tenga poquísimos temas', () => {
    // Un temario corto es otro problema (cobertura), y ya tiene su propio detector.
    expect(det.clasificarEleccion({ slug: 'x', usuarios: 100, premium: 5, temasActivos: 1 })).toBeNull()
  })

  it('la CADENA VACÍA no es una oposición — y son 8 usuarios reales', () => {
    // Medido el 01/08: 8 perfiles con `target_oposicion = ''`. La consulta a mano los contaba
    // como una oposición sin temario más, inflando la cifra publicada en la ficha (183/594
    // frente a los 182/586 reales). No es «eligió algo que no existe»: es no haber elegido,
    // con el campo a cadena vacía en vez de NULL. Es otro problema y no se mezcla aquí.
    expect(det.clasificarEleccion({ slug: '', usuarios: 8, premium: 0, temasActivos: 0 })).toBeNull()
    expect(det.clasificarEleccion({ slug: null, usuarios: 8, premium: 0, temasActivos: 0 })).toBeNull()
  })

  it('una oposición sin temario que NADIE ha elegido no es hallazgo', () => {
    // El catálogo tiene miles; el problema no es que existan, es que alguien esté dentro.
    expect(det.clasificarEleccion({ slug: 'x', usuarios: 0, premium: 0, temasActivos: 0 })).toBeNull()
  })

  it('una personalizada nunca es hallazgo, aunque no tenga temas en `topics`', () => {
    // Es el caso que más se parece a un fallo y NO lo es: su temario está en otra tabla.
    expect(det.clasificarEleccion({
      slug: '3f2a91c4-7b6e-4d21-9f80-1a2b3c4d5e6f', usuarios: 9, premium: 1, temasActivos: 0,
    })).toBeNull()
  })
})

describe('ordenarPorUrgencia — reparar no se ordena como construir', () => {
  it('un solo premium pesa más que cincuenta free', () => {
    const orden = det.ordenarPorUrgencia([
      { slug: 'enfermero', usuarios: 58, premium: 0 },
      { slug: 'castilla_leon', usuarios: 1, premium: 1 },
      { slug: 'agente_hacienda', usuarios: 16, premium: 2 },
    ]).map((x: { slug: string }) => x.slug)
    expect(orden).toEqual(['agente_hacienda', 'castilla_leon', 'enfermero'])
  })

  it('a igualdad de premium manda el volumen, y el desempate es estable', () => {
    const orden = det.ordenarPorUrgencia([
      { slug: 'b', usuarios: 5, premium: 0 },
      { slug: 'a', usuarios: 5, premium: 0 },
      { slug: 'c', usuarios: 9, premium: 0 },
    ]).map((x: { slug: string }) => x.slug)
    expect(orden).toEqual(['c', 'a', 'b'])
  })
})

describe('resumir', () => {
  it('cuenta oposiciones, usuarios y premium por separado', () => {
    // Los tres números dicen cosas distintas: cuántos temarios faltan, a cuánta gente afecta
    // y cuánto de eso está cobrado. Sumarlos en uno solo perdería la única banda accionable.
    const r = det.resumir([
      { slug: 'a', usuarios: 16, premium: 2 },
      { slug: 'b', usuarios: 58, premium: 0 },
    ])
    expect(r).toEqual({ oposiciones: 2, usuarios: 74, premium: 2, conPremium: 1 })
  })

  it('sin hallazgos da ceros, no NaN', () => {
    expect(det.resumir([])).toEqual({ oposiciones: 0, usuarios: 0, premium: 0, conPremium: 0 })
  })
})

/**
 * Las personalizadas del formato NUEVO se juzgan por los HECHOS. [T-508]
 *
 * Antes de esto el detector las listaba por accidente (el regex de exclusión solo reconoce el
 * UUID pelado) mientras su pie de página anunciaba que estaban excluidas y «NO están rotas».
 * Una salida que se desmiente a sí misma no es una señal: el 03/08/2026 ya traía a una usuaria
 * premium con 0 temas —que ese mismo día escribió reportando el 404 que eso produce— y el texto
 * de al lado mandaba ignorarla.
 *
 * Lo que se fija aquí es la ASIMETRÍA, que es lo que no es obvio:
 *   · formato viejo (UUID pelado) → EXCLUIR siempre: sus temas cuelgan de otro `position_type`,
 *     el join daría 0 para todas y contarlas fabrica hallazgos (ya pasó una vez).
 *   · formato nuevo (`personalizada_<uuid>`) → MEDIR: aquí el target ES el `position_type`, así
 *     que un 0 es un 0 de verdad.
 */
describe('personalizadas: cuál se mide y cuál no', () => {
  const NUEVA = 'personalizada_cddb52fd92ea4cbb9e2223ad53a36adc'
  const VIEJA = 'cddb52fd-92ea-4cbb-9e22-23ad53a36adc'

  it('reconoce el formato nuevo y NO lo confunde con el viejo', () => {
    expect(det.esPersonalizadaConTemarioPropio(NUEVA)).toBe(true)
    expect(det.esPersonalizadaConTemarioPropio(VIEJA)).toBe(false)
    expect(det.esOposicionPersonalizada(VIEJA)).toBe(true)
    expect(det.esOposicionPersonalizada(NUEVA)).toBe(false)
  })

  it('una personalizada nueva y VACÍA es hallazgo, y premium la pone en rojo', () => {
    const h = det.clasificarEleccion({ slug: NUEVA, usuarios: 1, premium: 1, temasActivos: 0 })
    expect(h).not.toBeNull()
    expect(h.severity).toBe('error')
    expect(h.tipo).toBe('personalizada')
  })

  it('con temario NO es hallazgo — la función es legítima', () => {
    expect(det.clasificarEleccion({ slug: NUEVA, usuarios: 4, premium: 2, temasActivos: 7 })).toBeNull()
  })

  it('la del formato viejo sigue fuera aunque salga a cero (no se puede medir, no es que esté bien)', () => {
    expect(det.clasificarEleccion({ slug: VIEJA, usuarios: 9, premium: 3, temasActivos: 0 })).toBeNull()
  })

  it('el `tipo` distingue la reparación: catálogo se construye, personalizada se edita', () => {
    const cat = det.clasificarEleccion({ slug: 'enfermero', usuarios: 58, premium: 0, temasActivos: 0 })
    expect(cat.tipo).toBe('catalogo')
  })
})
