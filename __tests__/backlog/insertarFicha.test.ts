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
