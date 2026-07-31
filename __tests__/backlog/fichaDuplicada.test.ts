/**
 * Guardarraíl anti-ficha-duplicada (T-359).
 *
 * El caso que lo motivó: el 31/07 una sesión empezó a construir un lote de 385 ofertas de precio
 * que OTRA había terminado y verificado el día anterior. El claim no lo impide (protege una ficha,
 * no un trabajo) y `list` no lo enseña (solo muestra lo abierto, y la otra estaba CERRADA ayer).
 *
 * Los dos casos que importan están abajo y tiran en direcciones opuestas: que cace el duplicado
 * real, y que NO salte con títulos que solo comparten el vocabulario de la casa. Un aviso que salta
 * siempre se ignora, y entonces el guardarraíl no existe.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fichasParecidas, distintivas } = require('@/lib/backlog/fichaDuplicada.cjs') as {
  fichasParecidas: (t: string, e: any[], o?: { minComunes?: number }) => any[]
  distintivas: (t: string) => string[]
}

// Títulos REALES del backlog del 31/07.
const T341 = {
  id: 'T-341', status: 'done',
  title: 'Boton de recuperar el precio anterior para los afectados por el vaciado de Stripe',
  // El `outcome` REAL, recortado. Importa que sea el de verdad: es de ahí de donde salen palabras
  // como «oferta» o «cobra», que son las que hacen que el parecido llegue a la banda que exige
  // motivo escrito. Con un resumen inventado el test mediría otra cosa.
  outcome: 'Botón «Continuar con mi precio» vivo y VERIFICADO EN PRODUCCIÓN (sim 7/7 contra www.vence.es con datos reales). Recupera la tarifa del histórico de la cuenta antigua y crea la oferta en la que hoy cobra; reactivar en la antigua se rechaza.',
}
const T115 = { id: 'T-115', status: 'open', title: 'Generar preguntas para los artículos huérfanos del temario' }
const T296 = { id: 'T-296', status: 'done', title: 'El registro de sesiones no tiene latido: no se puede saber qué worktree está vivo', outcome: 'Latido en worktree_sessions' }

describe('fichasParecidas — el duplicado que costó una sesión', () => {
  it('caza T-341 desde el título con el que se iba a crear la ficha duplicada', () => {
    const titulo = 'Boton de recuperacion para los 385 del vaciado de Stripe: la oferta existe, falta crearla en lote y avisar'
    const r = fichasParecidas(titulo, [T341, T115, T296])
    expect(r.map((x) => x.id)).toContain('T-341')
    // Contra el backlog real esto dio 5 palabras comunes, o sea la banda que EXIGE motivo escrito
    // (`reserve` aborta). Se fija en 4 —la banda que avisa— porque el 5.º término salía del resto
    // del outcome, que aquí va recortado: lo que este test protege es que el duplicado se DETECTE.
    expect(r[0].comunes.length).toBeGreaterThanOrEqual(4)
  })

  it('mira también el `outcome` de las cerradas: ahí está lo que de verdad se hizo', () => {
    // Sin leer el outcome, un título que hable de «tarifa» e «historico» no casaría con el suyo.
    const r = fichasParecidas('Recuperar la tarifa del historico y dejar la oferta lista, verificado en produccion', [T341])
    expect(r).toHaveLength(1)
  })

  it('NO salta con tareas que solo comparten el vocabulario de la casa', () => {
    expect(fichasParecidas('Revisar los temas vacíos de la oposición y avisar en el panel', [T115, T296])).toEqual([])
  })

  it('un título corto no dispara nada (no hay firma que comparar)', () => {
    expect(fichasParecidas('Arreglar el badge', [T341, T115, T296])).toEqual([])
  })

  it('sin candidatas devuelve lista vacía, no revienta', () => {
    expect(fichasParecidas('cualquier cosa larga y distintiva sobre convocatorias andaluzas', [])).toEqual([])
  })
})

describe('distintivas — lo que hace que el aviso no sea ruido', () => {
  it('descarta las palabras que salen en medio backlog', () => {
    const p = distintivas('El sistema de usuarios premium tiene un error en los datos de la oposición')
    expect(p).not.toContain('sistema')
    expect(p).not.toContain('usuarios')
    expect(p).not.toContain('premium')
    expect(p).not.toContain('error')
  })

  it('conserva lo que sí distingue una tarea de otra', () => {
    expect(distintivas('vaciado de Stripe y oferta heredada')).toEqual(expect.arrayContaining(['vaciado', 'stripe', 'oferta', 'heredada']))
  })

  it('ignora tildes y mayúsculas (el mismo término escrito de dos formas es el mismo)', () => {
    expect(distintivas('Suplantación')).toEqual(distintivas('suplantacion'))
  })
})
