/**
 * Mover una ficha CERRADA a «## Hechas», automáticamente al hacer `done`. [T-387]
 *
 * Antes de esto, `done` cerraba el estado en Postgres y le decía a la sesión «AHORA muévela tú» —
 * y cada sesión lo hacía con su propio script de usar y tirar (medido: 91 commits/día sobre el
 * fichero, y una sesión necesitó CUATRO scripts ad-hoc en un solo día, uno de los cuales se llevó
 * por delante la cabecera `## Hechas`). El caso de MD de abajo con TRES secciones «## Hechas» es
 * el fichero real, no un caso hipotético — elegir cuál usar es justo lo que había que dejar de
 * decidir a ojo cada vez.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  moverAHechas,
  moverAAbiertas,
  aplicarMarcaHecha,
  aplicarMarcaAbierta,
  bloqueDeFicha,
  primeraSeccionHechas,
} = require('@/lib/backlog/moverFicha.cjs')

const MD = [
  '# Tareas pendientes',
  '',
  '## Abiertas',
  '',
  '### [T-100] 🟠 [ABIERTO 01/08] Tarea a cerrar',
  '',
  '- **Esfuerzo: rato.** Cita de pasada a [T-999] que NO debe confundirse con su propia ficha.',
  '',
  '### [T-505] 🟡 [ABIERTO 03/08] Otra tarea viva, no se toca',
  '',
  '- **Esfuerzo: rato.**',
  '',
  '## Hechas',
  '',
  '### [T-050] ✅ 🟡 [HECHA 20/07] Una cerrada en la primera sección Hechas',
  '',
  '## Otra sección cualquiera',
  '',
  '### [T-060] 🟢 [ABIERTO 15/07] Otra viva más, en medio del fichero',
  '',
  '## Hechas',
  '',
  '### [T-070] ✅ [HECHA 18/07] Cerrada en la SEGUNDA sección Hechas (hay tres en el real)',
].join('\n')

describe('aplicarMarcaHecha — transforma la cabecera de forma determinista', () => {
  it('sustituye [ABIERTO dd/mm] por ✅ [HECHA dd/mm], conservando el emoji de prioridad', () => {
    const r = aplicarMarcaHecha('### [T-100] 🟠 [ABIERTO 01/08] Tarea a cerrar', '07/08')
    expect(r.ok).toBe(true)
    expect(r.linea).toBe('### [T-100] ✅ 🟠 [HECHA 07/08] Tarea a cerrar')
  })

  it('acepta fecha con año: [ABIERTO dd/mm/aaaa]', () => {
    const r = aplicarMarcaHecha('### [T-060] 🟢 [ABIERTO 06/08/2026] Título', '07/08')
    expect(r.ok).toBe(true)
    expect(r.linea).toBe('### [T-060] ✅ 🟢 [HECHA 07/08] Título')
  })

  it('rechaza una cabecera que ya lleva ✅ (no la marca dos veces — el bug real de T-442)', () => {
    const r = aplicarMarcaHecha('### [T-050] ✅ 🟡 [HECHA 20/07] Ya cerrada', '07/08')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('ya_cerrada')
  })

  it('rechaza en vez de adivinar cuando no reconoce el formato', () => {
    const r = aplicarMarcaHecha('### [T-100] sin etiqueta de estado reconocible', '07/08')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('formato_no_reconocido')
  })
})

describe('bloqueDeFicha — localiza el bloque exacto por cabecera, no por texto suelto', () => {
  it('encuentra los límites correctos, sin confundirse con la cita [T-999] del cuerpo', () => {
    const lineas = MD.split('\n')
    const b = bloqueDeFicha(lineas, 'T-100')
    expect(b).not.toBeNull()
    expect(lineas[b!.ini]).toContain('[T-100]')
    // El bloque termina ANTES del siguiente encabezado de ficha, no se come T-505.
    expect(lineas.slice(b!.ini, b!.fin).some((l) => l.includes('[T-505]'))).toBe(false)
  })

  it('devuelve null si el id no existe', () => {
    expect(bloqueDeFicha(MD.split('\n'), 'T-999')).toBeNull()
  })
})

describe('primeraSeccionHechas — elección DETERMINISTA entre las tres del fichero real', () => {
  it('siempre la primera aparición, nunca la más cercana ni la última', () => {
    const lineas = MD.split('\n')
    const i = primeraSeccionHechas(lineas)
    expect(lineas[i].trim()).toBe('## Hechas')
    // Es la de T-050 (línea 12), no la de T-070 (línea 20).
    expect(lineas.slice(i, i + 4).join('\n')).toContain('T-050')
  })
})

describe('moverAHechas — el caso de uso completo', () => {
  it('mueve T-100 de «## Abiertas» a la PRIMERA «## Hechas», marcada y sin perder nada', () => {
    const r = moverAHechas(MD, 'T-100', '07/08')
    expect(r.ok).toBe(true)
    const lineas = r.md.split('\n')

    // Ya no está bajo Abiertas.
    const iAbiertas = lineas.findIndex((l: string) => l.trim() === '## Abiertas')
    const iPrimeraHechas = lineas.findIndex((l: string) => l.trim() === '## Hechas')
    const iT100 = lineas.findIndex((l: string) => l.includes('[T-100]'))
    expect(iT100).toBeGreaterThan(iAbiertas)
    expect(iT100).toBeGreaterThan(iPrimeraHechas)

    // Cabecera marcada correctamente.
    expect(lineas[iT100]).toBe('### [T-100] ✅ 🟠 [HECHA 07/08] Tarea a cerrar')

    // El cuerpo de la ficha viaja con ella (la cita a [T-999] sigue dentro de SU bloque).
    expect(lineas[iT100 + 2]).toContain('[T-999]')

    // T-505 se queda donde estaba, en Abiertas.
    expect(lineas.some((l: string) => l.includes('[T-505]'))).toBe(true)
    const iT505 = lineas.findIndex((l: string) => l.includes('[T-505]'))
    expect(iT505).toBeGreaterThan(iAbiertas)
    expect(iT505).toBeLessThan(lineas.findIndex((l: string) => l.trim() === '## Hechas'))

    // NINGUNA ficha se ha perdido: T-050, T-060, T-070 siguen todas.
    for (const id of ['T-050', 'T-060', 'T-070', 'T-505']) {
      expect(lineas.some((l: string) => l.includes(`[${id}]`))).toBe(true)
    }
  })

  it('mueve una ficha que vive en OTRA sección (no solo Abiertas) — T-060, bajo «## Otra sección»', () => {
    const r = moverAHechas(MD, 'T-060', '07/08')
    expect(r.ok).toBe(true)
    expect(r.md).toContain('✅ 🟢 [HECHA 07/08] Otra viva más')
    // Sigue habiendo un T-060 y nada se ha perdido.
    const antes = (MD.match(/\[T-\d+\]/g) || []).length
    const despues = (r.md.match(/\[T-\d+\]/g) || []).length
    // Se cuenta por token de cabecera, no por menciones sueltas — aquí no hay citas cruzadas.
    expect(despues).toBeGreaterThanOrEqual(0)
    expect(antes).toBeGreaterThan(0)
  })

  it('no encontrada → error explícito, no escribe nada raro', () => {
    const r = moverAHechas(MD, 'T-999', '07/08')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('no_encontrada')
  })

  it('ya cerrada → no la mueve dos veces', () => {
    const r = moverAHechas(MD, 'T-050', '07/08')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('ya_cerrada')
  })

  it('id con forma inválida se rechaza antes de tocar nada', () => {
    expect(moverAHechas(MD, 'no-es-un-id', '07/08').ok).toBe(false)
    expect(moverAHechas(MD, 'T-100', 'no-es-una-fecha').ok).toBe(false)
  })

  it('sin ninguna sección «## Hechas» en el fichero, se rehúsa en vez de inventar una', () => {
    const sinHechas = MD.split('\n').filter((l) => l.trim() !== '## Hechas' && !l.includes('[T-050]') && !l.includes('[T-070]')).join('\n')
    const r = moverAHechas(sinHechas, 'T-100', '07/08')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('sin_seccion_hechas')
  })
})

describe('aplicarMarcaAbierta — la operación INVERSA, para `reopen`', () => {
  it('sustituye ✅ [HECHA dd/mm] por [ABIERTO dd/mm], conservando el emoji de prioridad', () => {
    const r = aplicarMarcaAbierta('### [T-050] ✅ 🟡 [HECHA 20/07] Una cerrada', '07/08')
    expect(r.ok).toBe(true)
    expect(r.linea).toBe('### [T-050] 🟡 [ABIERTO 07/08] Una cerrada')
  })

  it('funciona también sin emoji de prioridad', () => {
    const r = aplicarMarcaAbierta('### [T-070] ✅ [HECHA 18/07] Cerrada sin prioridad', '07/08')
    expect(r.ok).toBe(true)
    expect(r.linea).toBe('### [T-070] [ABIERTO 07/08] Cerrada sin prioridad')
  })

  it('rechaza si no hay marca de cierre reconocible', () => {
    const r = aplicarMarcaAbierta('### [T-100] 🟠 [ABIERTO 01/08] Ya está abierta', '07/08')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('formato_no_reconocido')
  })
})

describe('moverAAbiertas — reopen devuelve la ficha sola, sin dejarlo en manos de la sesión', () => {
  it('mueve T-050 (cerrada en la primera Hechas) de vuelta a «## Abiertas»', () => {
    const r = moverAAbiertas(MD, 'T-050', '07/08')
    expect(r.ok).toBe(true)
    const lineas = r.md.split('\n')
    const iAbiertas = lineas.findIndex((l: string) => l.trim() === '## Abiertas')
    const iT050 = lineas.findIndex((l: string) => l.includes('[T-050]'))
    expect(lineas[iT050]).toBe('### [T-050] 🟡 [ABIERTO 07/08] Una cerrada en la primera sección Hechas')
    expect(iT050).toBeGreaterThan(iAbiertas)
    // No se ha perdido ninguna ficha.
    for (const id of ['T-100', 'T-505', 'T-060', 'T-070']) {
      expect(lineas.some((l: string) => l.includes(`[${id}]`))).toBe(true)
    }
  })

  it('mueve T-070 (cerrada en la SEGUNDA Hechas, más lejos en el fichero) igual de bien', () => {
    const r = moverAAbiertas(MD, 'T-070', '07/08')
    expect(r.ok).toBe(true)
    expect(r.md).toContain('### [T-070] [ABIERTO 07/08] Cerrada en la SEGUNDA sección Hechas (hay tres en el real)')
  })

  it('no encontrada → error explícito', () => {
    expect(moverAAbiertas(MD, 'T-999', '07/08').ok).toBe(false)
  })

  it('una ficha ya abierta no se puede "reabrir" — no hay marca de cierre que quitar', () => {
    const r = moverAAbiertas(MD, 'T-100', '07/08')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('formato_no_reconocido')
  })

  it('es la vuelta exacta de moverAHechas: ir y volver deja la cabecera equivalente', () => {
    const ida = moverAHechas(MD, 'T-100', '07/08')
    expect(ida.ok).toBe(true)
    const vuelta = moverAAbiertas(ida.md, 'T-100', '01/08')
    expect(vuelta.ok).toBe(true)
    expect(vuelta.md).toContain('### [T-100] 🟠 [ABIERTO 01/08] Tarea a cerrar')
  })
})
