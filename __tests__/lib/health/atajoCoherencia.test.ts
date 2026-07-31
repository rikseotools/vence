// @ts-nocheck
const { extraerAtajos, normalizarTecla, contradicciones } = require('@/lib/health/atajoCoherencia')

describe('normalizarTecla — el mismo atajo escrito de seis maneras es UNO', () => {
  it('ordena los modificadores y no distingue mayúsculas', () => {
    const canon = 'Ctrl+Alt+O'
    for (const v of ['Alt+Ctrl+O', 'Ctrl+Alt+O', 'CTRL + ALT + o', 'Control+Alt+O', 'alt+ctrl+O', 'Ctrl  +  Alt  +  O']) {
      expect(normalizarTecla(v)).toBe(canon)
    }
  })

  it('trata Mayús y Shift como la misma tecla', () => {
    expect(normalizarTecla('Ctrl+Shift+V')).toBe(normalizarTecla('Mayús+Ctrl+V'))
  })

  it('conserva las teclas de función sin trocearlas', () => {
    expect(normalizarTecla('Ctrl+Alt+F9')).toBe('Ctrl+Alt+F9')
    expect(normalizarTecla('Ctrl+Alt+F9')).not.toBe(normalizarTecla('Ctrl+Alt+F'))
  })

  it('devuelve null si no hay modificador (una tecla suelta no es un atajo comparable)', () => {
    expect(normalizarTecla('F12')).toBeNull()
    expect(normalizarTecla('')).toBeNull()
  })
})

describe('extraerAtajos — solo emite cuando la atribución es inequívoca', () => {
  it('lee una fila de tabla markdown', () => {
    expect(extraerAtajos('| **Ctrl+Alt+O** | Insertar nota al pie |'))
      .toEqual([expect.objectContaining({ accion: 'nota_al_pie', tecla: 'Ctrl+Alt+O' })])
  })

  it('lee una línea en prosa con una sola tecla y una sola acción', () => {
    expect(extraerAtajos('- Insertar nota al pie (Alt+Ctrl+O)'))
      .toEqual([expect.objectContaining({ accion: 'nota_al_pie', tecla: 'Ctrl+Alt+O' })])
  })

  it('NO emite cuando la línea mezcla varias teclas: la atribución sería inventada', () => {
    expect(extraerAtajos('**Generales:** Ctrl+U (nuevo), Ctrl+A (abrir), Ctrl+G (guardar)')).toEqual([])
  })

  it('NO emite en líneas que CONTRASTAN con el inglés — esa es la buena práctica, no el defecto', () => {
    expect(extraerAtajos('- Ctrl+G: guardar (en inglés, Ctrl+S)')).toEqual([])
    expect(extraerAtajos('| Guardar | **Ctrl+G** (Guardar) | Ctrl+S (Save) |')).toEqual([])
    expect(extraerAtajos('📌 **Mnemónicos**: **F** = **F**ootnote (nota al pie); **D** = en**D**note (nota al final).')).toEqual([])
  })

  it('distingue nota al pie de nota al final aunque compartan la palabra «nota»', () => {
    const r = extraerAtajos('| Ctrl+Alt+L | Insertar nota al final |')
    expect(r).toEqual([expect.objectContaining({ accion: 'nota_al_final', tecla: 'Ctrl+Alt+L' })])
  })

  it('no confunde «guardar como» con «guardar» — son acciones distintas', () => {
    expect(extraerAtajos('| Ctrl+Alt+G | Guardar como |')[0].accion).toBe('guardar_como')
    expect(extraerAtajos('| Ctrl+G | Guardar el documento |')[0].accion).toBe('guardar')
  })

  it('IGNORA los atajos de tecla de función: no se localizan, así que Mayús+F12 y Ctrl+G son alias de Guardar, no una contradicción', () => {
    expect(extraerAtajos('| Mayús+F12 | Guardar |')).toEqual([])
    expect(extraerAtajos('| Alt+F7 | Buscar |')).toEqual([])
  })

  it('el complemento que CAMBIA la acción descarta el par (si no, se comparan cosas distintas)', () => {
    expect(extraerAtajos('| Ctrl+Mayús+D | Subrayado doble |')).toEqual([])
    expect(extraerAtajos('| Ctrl+Mayús+W | Subrayar palabras, pero no espacios |')).toEqual([])
    expect(extraerAtajos('| Ctrl+M | Guardar el registro actual sin moverse a otro |')).toEqual([])
    // pero el complemento inocuo NO estorba
    expect(extraerAtajos('| Ctrl+E | Seleccionar todo el contenido del documento |')[0].accion).toBe('seleccionar_todo')
  })

  it('ignora el texto vacío sin reventar', () => {
    expect(extraerAtajos(null)).toEqual([])
    expect(extraerAtajos('')).toEqual([])
  })
})

describe('contradicciones — el caso real que nadie vio (30/07/2026)', () => {
  const base = { familia: 'word', contenedor: 'Word 365', ref: 'a1' }

  it('caza dos teclas distintas para la misma acción', () => {
    const r = contradicciones([
      { ...base, accion: 'nota_al_pie', tecla: 'Ctrl+Alt+O', ref: 'q-987f0ad1' },
      { ...base, accion: 'nota_al_pie', tecla: 'Ctrl+Alt+F', ref: 'q-1ee365af' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].teclas.sort()).toEqual(['Ctrl+Alt+F', 'Ctrl+Alt+O'])
  })

  it('no dice cuál es la correcta — solo que no puede haber dos', () => {
    const r = contradicciones([
      { ...base, accion: 'guardar', tecla: 'Ctrl+G', ref: 'a1' },
      { ...base, accion: 'guardar', tecla: 'Ctrl+S', ref: 'a2' },
    ])
    expect(Object.keys(r[0])).not.toContain('correcta')
  })

  it('callar es lo normal: sin desacuerdo no hay hallazgo', () => {
    expect(contradicciones([
      { ...base, accion: 'guardar', tecla: 'Ctrl+G', ref: 'a1' },
      { ...base, accion: 'guardar', tecla: 'Ctrl+G', ref: 'a2' },
    ])).toEqual([])
  })

  it('banda «interna» cuando UN MISMO texto se contradice: es lo más grave y no admite defensa', () => {
    const r = contradicciones([
      { ...base, accion: 'seleccionar_todo', tecla: 'Ctrl+E', ref: 'art-w365esc-5' },
      { ...base, accion: 'seleccionar_todo', tecla: 'Ctrl+A', ref: 'art-w365esc-5' },
    ])
    expect(r[0].banda).toBe('interna')
  })

  it('banda «contenedor» cuando discrepan dos textos del mismo contenedor', () => {
    const r = contradicciones([
      { ...base, accion: 'guardar', tecla: 'Ctrl+G', ref: 'art-1' },
      { ...base, accion: 'guardar', tecla: 'Ctrl+S', ref: 'art-2' },
    ])
    expect(r[0].banda).toBe('contenedor')
  })

  it('banda «familia» entre hermanos: Escritorio y común PUEDEN diferir de verdad, lo juzga una persona', () => {
    const r = contradicciones([
      { familia: 'word', contenedor: 'Word 365', accion: 'guardar', tecla: 'Ctrl+G', ref: 'art-1' },
      { familia: 'word', contenedor: 'Word 365 Escritorio', accion: 'guardar', tecla: 'Ctrl+S', ref: 'art-2' },
    ])
    expect(r[0].banda).toBe('familia')
  })

  it('no cruza familias: Outlook y Word usan la misma tecla para cosas distintas y es correcto', () => {
    expect(contradicciones([
      { familia: 'word', contenedor: 'Word 365', accion: 'buscar', tecla: 'Ctrl+B', ref: 'a1' },
      { familia: 'outlook', contenedor: 'Outlook 365', accion: 'buscar', tecla: 'Ctrl+E', ref: 'a2' },
    ])).toEqual([])
  })

  it('ordena lo indefendible primero', () => {
    const r = contradicciones([
      { familia: 'word', contenedor: 'W1', accion: 'guardar', tecla: 'Ctrl+G', ref: 'a1' },
      { familia: 'word', contenedor: 'W2', accion: 'guardar', tecla: 'Ctrl+S', ref: 'a2' },
      { familia: 'excel', contenedor: 'E1', accion: 'negrita', tecla: 'Ctrl+N', ref: 'b1' },
      { familia: 'excel', contenedor: 'E1', accion: 'negrita', tecla: 'Ctrl+B', ref: 'b1' },
    ])
    expect(r[0].banda).toBe('interna')
  })
})
