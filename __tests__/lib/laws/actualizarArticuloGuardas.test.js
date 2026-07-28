// Política de reescritura de `articles.content` contra la fuente oficial (T-184, 27/07/2026).
//
// Lo que se protege aquí: reescribir un artículo es tocar el texto legal que lee el opositor y
// contra el que se validaron las claves de sus preguntas. La regla de oro de estos tests es que
// **ante la duda NO se escribe** — si la clasificación se equivoca, que lo haga hacia el lado que
// no destruye nada.

const {
  decidirReescritura,
  revisarTextoOficial,
  resumirPlan,
  CLASES_SEGURAS,
  CLASES_BLOQUEADAS,
} = require('../../../lib/laws/actualizarArticuloGuardas')

describe('decidirReescritura — qué se toca y qué no', () => {
  it('NO reescribe lo que ya es idéntico (escribir manda a re-verificar sus preguntas)', () => {
    const d = decidirReescritura('identico')
    expect(d.accion).toBe('omitir')
    expect(d.motivo).toMatch(/re-verificar/)
  })

  it('reescribe `incompleto`: nos falta materia del oficial', () => {
    // Caso real: el art. 28 del RGPD servía 12 párrafos de menos.
    expect(decidirReescritura('incompleto').accion).toBe('reescribir')
  })

  it('reescribe `erratas`: es el oficial mal copiado', () => {
    expect(decidirReescritura('erratas').accion).toBe('reescribir')
  })

  it('BLOQUEA `contaminado` por defecto, y el motivo dice qué hacer antes de forzar', () => {
    const d = decidirReescritura('contaminado')
    expect(d.accion).toBe('bloquear')
    expect(d.motivo).toMatch(/Averigua el origen ANTES/)
    expect(d.motivo).toMatch(/--reimportar-parafrasis/)
  })

  // T-193 (28/07): el RGPD servía una redacción NO oficial en 72 de 99 artículos. El origen se
  // investigó y se documentó, así que existe una puerta — pero hay que EMPUJARLA a mano.
  it('`contaminado` se reescribe SOLO si se pide explícitamente', () => {
    expect(decidirReescritura('contaminado', {}).accion).toBe('bloquear')
    expect(decidirReescritura('contaminado', { incluirParafrasis: true }).accion).toBe('reescribir')
  })

  it('la puerta de la paráfrasis NO se abre con la del reordenado (son decisiones distintas)', () => {
    expect(decidirReescritura('contaminado', { incluirReordenado: true }).accion).toBe('bloquear')
    expect(decidirReescritura('reordenado', { incluirParafrasis: true }).accion).toBe('bloquear')
  })

  it('al forzar, el motivo deja constancia de que el texto anterior se conserva', () => {
    const d = decidirReescritura('contaminado', { incluirParafrasis: true })
    expect(d.motivo).toMatch(/article_versions/)
    expect(d.motivo).toMatch(/NO oficial/)
  })

  // La puerta es para `contaminado`, no un comodín: `sin_oficial` significa que no hemos podido
  // leer la fuente, y ahí no hay nada con lo que reescribir.
  it('`incluirParafrasis` NO desbloquea `sin_oficial`', () => {
    expect(decidirReescritura('sin_oficial', { incluirParafrasis: true }).accion).toBe('bloquear')
  })

  it('BLOQUEA `sin_oficial`: escribir a ciegas es lo contrario de verificar', () => {
    expect(decidirReescritura('sin_oficial').accion).toBe('bloquear')
  })

  it('`reordenado` NO entra en una tanda masiva salvo que se pida', () => {
    expect(decidirReescritura('reordenado').accion).toBe('bloquear')
    expect(decidirReescritura('reordenado', { incluirReordenado: true }).accion).toBe('reescribir')
  })

  it('una clase que no conoce se bloquea, no se asume segura', () => {
    // Si mañana el comparador añade una clase, el fallo debe ser hacia NO escribir.
    const d = decidirReescritura('clase_nueva_del_futuro')
    expect(d.accion).toBe('bloquear')
    expect(d.motivo).toMatch(/no se entiende/)
  })

  it('las listas no se solapan (una clase no puede ser segura y bloqueada a la vez)', () => {
    for (const c of CLASES_SEGURAS) expect(CLASES_BLOQUEADAS).not.toContain(c)
  })
})

describe('resumirPlan', () => {
  it('cuenta la tanda por acción', () => {
    const d = ['incompleto', 'erratas', 'identico', 'contaminado', 'contaminado']
      .map((c) => decidirReescritura(c))
    expect(resumirPlan(d)).toEqual({ reescribir: 2, omitir: 1, bloquear: 2 })
  })
})

// La re-comparación DENTRO de la transacción no sirve para esto: compara lo escrito contra el
// texto extraído, así que un defecto de extracción cuadra consigo mismo y pasa limpio. Estos dos
// casos son defectos REALES que se colaron y se cazaron leyendo el texto, no contándolo.
describe('revisarTextoOficial — el filtro que la re-comparación no puede hacer', () => {
  const CUERPO = '1. El Comité elegirá por mayoría simple de entre sus miembros un presidente y dos vicepresidentes.'

  it('acepta un artículo con pinta de artículo', () => {
    expect(revisarTextoOficial(CUERPO, 'Presidencia').ok).toBe(true)
  })

  // Art. 73 del RGPD (28/07): guardamos «Presidente», EUR-Lex rotula «Presidencia», la poda por
  // cadena no casaba y «Presidencia» se colaba como primera línea del texto legal.
  it('RECHAZA el texto que empieza por su propia rúbrica (en la BD eso vive en `title`)', () => {
    const r = revisarTextoOficial(`Presidencia\n${CUERPO}`, 'Presidencia')
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/rúbrica/)
  })

  it('la detección de la rúbrica no depende de mayúsculas ni de espacios de más', () => {
    expect(revisarTextoOficial(`PRESIDENCIA\n${CUERPO}`, '  presidencia ').ok).toBe(false)
  })

  // Art. 31 del RGPD: acababa en «…en el desempeño de sus funciones. Sección 2 Seguridad…».
  it('RECHAZA el texto que termina en un encabezado de división', () => {
    const r = revisarTextoOficial(`${CUERPO}\nSección 2`, 'Presidencia')
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/divisi[óo]n/)
  })

  it('NO confunde una REFERENCIA a un capítulo dentro de la frase con un encabezado colado', () => {
    expect(revisarTextoOficial('Las transferencias reguladas en el Capítulo V se harán conforme a lo previsto.', 'Transferencias').ok).toBe(true)
  })

  it('RECHAZA el texto vacío y el sospechosamente corto: no se escribe la nada sobre un artículo', () => {
    expect(revisarTextoOficial('', 'X').ok).toBe(false)
    expect(revisarTextoOficial('   ', 'X').ok).toBe(false)
    expect(revisarTextoOficial('1. Sí.', 'X').ok).toBe(false)
  })

  it('sin rúbrica conocida sigue validando lo demás (no se desactiva por no saber el título)', () => {
    expect(revisarTextoOficial(CUERPO).ok).toBe(true)
    expect(revisarTextoOficial('', undefined).ok).toBe(false)
  })
})
