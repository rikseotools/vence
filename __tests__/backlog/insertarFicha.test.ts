/**
 * Colocar una ficha nueva en `tareas-pendientes.md`. [T-515]
 *
 * El caso 1 NO es hipotético: es el fichero real reducido. La frase `## Abiertas` aparece dentro
 * del TEXTO de varias fichas (las que hablan justamente de este problema), y está **antes** que
 * el encabezado de verdad. Cualquier búsqueda de la cadena —`index()`, `sed`, «pégala arriba»—
 * acierta la mención y la ficha acaba en el preámbulo, fuera de toda sección: entonces `sync` no
 * reconcilia su título ni su prioridad, y el guardarraíl anti-colisión deja de protegerla.
 *
 * Ha pasado dos veces. La segunda, el ancla falsa con la que se tropezó era un bullet de otra
 * sesión avisando de esta misma trampa — la prueba de que un aviso escrito no es un guardarraíl.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { insertarFicha, lineaDeAbiertas, idsDeFichas } = require('@/lib/backlog/insertarFicha.cjs')

const FICHA = '### [T-999] 🟡 [ABIERTO 04/08] Una ficha nueva\n\n- **Esfuerzo: rato.**'

const MD = [
  '# Tareas pendientes',
  '',
  '### [T-100] 🟡 [ABIERTO 01/08] Una tarea anterior escrita fuera de sección',
  '',
  '- **Cabo detectado:** una tarea nueva escrita **encima de `## Abiertas`** se queda huérfana.',
  '',
  '## Abiertas',
  '',
  '### [T-505] 🟡 [ABIERTO 03/08] Otra tarea viva',
  '',
  '- **Esfuerzo: rato.**',
  '',
  '## Hechas',
  '',
  '### [T-050] ✅ 🟡 [HECHA 20/07] Una cerrada',
].join('\n')

describe('el encabezado se localiza por LÍNEA EXACTA, no por búsqueda de texto', () => {
  it('no confunde la mención dentro de una ficha con el encabezado', () => {
    const lineas = MD.split('\n')
    expect(lineaDeAbiertas(lineas)).toBe(6)
    // La prueba de que el peligro era real: la cadena aparece antes, en la línea 4.
    expect(MD.indexOf('## Abiertas')).toBeLessThan(MD.indexOf('\n## Abiertas'))
  })

  it('la ficha aterriza DEBAJO del encabezado, no en el preámbulo', () => {
    const r = insertarFicha(MD, 'T-999', FICHA)
    expect(r.ok).toBe(true)
    const lineas = r.md.split('\n')
    const iAb = lineas.findIndex((l: string) => l.trim() === '## Abiertas')
    const iFicha = lineas.findIndex((l: string) => l.startsWith('### [T-999]'))
    expect(iFicha).toBeGreaterThan(iAb)
    // Y por delante de las que ya estaban abiertas (la convención del fichero: la nueva arriba).
    expect(iFicha).toBeLessThan(lineas.findIndex((l: string) => l.startsWith('### [T-505]')))
  })

  it('sin encabezado real NO inventa un sitio: prefiere no escribir', () => {
    const r = insertarFicha('# Solo un título\n\ntexto que menciona ## Abiertas de pasada', 'T-999', FICHA)
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('sin_seccion')
  })
})

describe('lo que se niega a escribir', () => {
  it('un id que ya tiene ficha (duplicarlo desincroniza markdown y tabla)', () => {
    const r = insertarFicha(MD, 'T-505', '### [T-505] 🟡 [ABIERTO 04/08] Repetida')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('id_duplicado')
  })

  it('una ficha cuya cabecera dice OTRO id que el reservado', () => {
    const r = insertarFicha(MD, 'T-999', '### [T-998] 🟡 [ABIERTO 04/08] Descuadrada')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('id_no_coincide')
  })

  it('una ficha que NACE cerrada: el ✅ es la única marca de HECHA que se lee', () => {
    const r = insertarFicha(MD, 'T-999', '### [T-999] ✅ 🟡 [HECHA 04/08] Nace muerta')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('nace_cerrada')
  })

  it('texto que no empieza por una cabecera de ficha', () => {
    const r = insertarFicha(MD, 'T-999', '- **Esfuerzo: rato.** me he dejado la cabecera')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('sin_cabecera')
  })

  it('un id con forma inválida', () => {
    expect(insertarFicha(MD, 'T999', FICHA).motivo).toBe('id_invalido')
    expect(insertarFicha(MD, '', FICHA).motivo).toBe('id_invalido')
  })

  it('una ficha vacía', () => {
    expect(insertarFicha(MD, 'T-999', '   ').motivo).toBe('ficha_vacia')
  })
})

describe('no se pierde nada de lo que ya estaba', () => {
  it('todas las fichas previas siguen ahí (incluidas las de otras secciones)', () => {
    const antes = idsDeFichas(MD.split('\n'))
    const r = insertarFicha(MD, 'T-999', FICHA)
    const despues = idsDeFichas(r.md.split('\n'))
    for (const id of antes) expect(despues).toContain(id)
    expect(despues).toContain('T-999')
  })

  it('el resto del fichero queda intacto salvo la inserción', () => {
    const r = insertarFicha(MD, 'T-999', FICHA)
    // Quitando exactamente lo insertado se vuelve al original: nada más se ha movido.
    // Lo insertado es la ficha MÁS la línea en blanco que la separa de lo que venía debajo.
    expect(r.md.replace(FICHA + '\n\n', '')).toBe(MD)
  })
})

/**
 * Devolver a su sección las fichas que quedaron huérfanas. [T-515]
 *
 * Las 58 que había el 04/08 (27 vivas, cinco 🔴) son el rastro acumulado de insertar a mano.
 * `parseMarkdown.cjs` las sigue viendo —desde T-382 manda la cabecera, no la posición— así que
 * no desaparecen del CLI; lo que pasa es que un humano que abre el fichero y baja a
 * `## Abiertas` no las encuentra. Con cinco críticas dentro, eso sí cuesta.
 */
describe('reubicar huérfanas', () => {
  const { reubicarHuerfanas, huerfanas } = require('@/lib/backlog/insertarFicha.cjs')

  it('las localiza: solo lo que está antes de la PRIMERA sección', () => {
    const h = huerfanas(MD.split('\n'))
    expect(h.map((x: any) => x.id)).toEqual(['T-100'])
    // T-505 vive dentro de «## Abiertas» y T-050 dentro de «## Hechas»: no son huérfanas.
    expect(h.map((x: any) => x.id)).not.toContain('T-505')
    expect(h.map((x: any) => x.id)).not.toContain('T-050')
  })

  it('la mueve al FINAL de «## Abiertas», no al principio', () => {
    const r = reubicarHuerfanas(MD)
    expect(r.ok).toBe(true)
    expect(r.movidas).toEqual(['T-100'])
    const l = r.md.split('\n')
    const iAb = l.findIndex((x: string) => x.trim() === '## Abiertas')
    const i505 = l.findIndex((x: string) => x.startsWith('### [T-505]'))
    const i100 = l.findIndex((x: string) => x.startsWith('### [T-100]'))
    expect(i100).toBeGreaterThan(iAb)
    // Detrás de las que ya estaban: arriba es donde escriben las sesiones fichas NUEVAS, y
    // meter ahí las viejas garantiza chocar con quien esté creando una.
    expect(i100).toBeGreaterThan(i505)
    expect(i100).toBeLessThan(l.findIndex((x: string) => x.trim() === '## Hechas'))
  })

  it('el CUERPO de la ficha viaja con ella, no solo la cabecera', () => {
    const r = reubicarHuerfanas(MD)
    const l = r.md.split('\n')
    const i100 = l.findIndex((x: string) => x.startsWith('### [T-100]'))
    expect(l.slice(i100, i100 + 4).join('\n')).toContain('se queda huérfana')
  })

  it('NO toca las cerradas: su sitio sería «## Hechas» y hay tres, elegir una es adivinar', () => {
    const md = MD.replace('### [T-100] 🟡 [ABIERTO 01/08]', '### [T-100] ✅ 🟡 [HECHA 01/08]')
    const r = reubicarHuerfanas(md)
    expect(r.movidas).toEqual([])
    expect(r.dejadas).toEqual(['T-100'])
    expect(r.md).toBe(md)
  })

  it('sin huérfanas no cambia nada (se puede correr dos veces seguidas)', () => {
    const r1 = reubicarHuerfanas(MD)
    const r2 = reubicarHuerfanas(r1.md)
    expect(r2.movidas).toEqual([])
    expect(r2.md).toBe(r1.md)
  })

  it('no pierde ninguna ficha por el camino', () => {
    const r = reubicarHuerfanas(MD)
    const antes = idsDeFichas(MD.split('\n')).sort()
    const despues = idsDeFichas(r.md.split('\n')).sort()
    expect(despues).toEqual(antes)
  })
})
