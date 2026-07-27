// Política de reescritura de `articles.content` contra la fuente oficial (T-184, 27/07/2026).
//
// Lo que se protege aquí: reescribir un artículo es tocar el texto legal que lee el opositor y
// contra el que se validaron las claves de sus preguntas. La regla de oro de estos tests es que
// **ante la duda NO se escribe** — si la clasificación se equivoca, que lo haga hacia el lado que
// no destruye nada.

const {
  decidirReescritura,
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

  it('BLOQUEA `contaminado` — y el motivo avisa de que la clase puede estar mintiendo', () => {
    const d = decidirReescritura('contaminado')
    expect(d.accion).toBe('bloquear')
    // El aviso importa: en el RGPD marcó 73 de 99 y eran variantes de redacción, no material ajeno.
    expect(d.motivo).toMatch(/VARIANTE DE REDACCIÓN/)
    expect(d.motivo).toMatch(/73/)
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
