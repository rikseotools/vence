/**
 * `subsecciones()` del dump de verify-topic-scope (runbook verificar-epigrafes-scope §1).
 *
 * Qué defiende: el dump es el ÚNICO input de los agentes verificadores. Cuando exponía solo
 * el TÍTULO del artículo, los agentes concluían "falta el concepto X del epígrafe" porque
 * ningún título lo nombraba — aunque el contenido sí lo cubriera. Es el word-matching que el
 * propio runbook prohíbe, inducido por el input.
 *
 * Caso real (16/07/2026, T603/T107/T34 de AGE): 4 agentes marcaron ISSUES por "falta
 * Operaciones de búsqueda"; el contenido la cubría en el art. 2 (Ctrl+E/F3) y en el art. 4
 * (sección «Búsqueda»), y «Este equipo»/«Acceso rápido» estaban en el art. 3. Solo el agente
 * que fue a leer el contenido a la BD lo vio.
 *
 * Las DOS convenciones de encabezado del banco editorial deben cazarse: markdown (##) y
 * línea entera en negrita (**Navegación:**). Si solo se caza una, los artículos escritos con
 * la otra vuelven a salir "vacíos" y el falso ISSUES reaparece.
 */

const path = require('path')
const { subsecciones } = require(path.join(process.cwd(), 'scripts/verify-topic-scope.cjs'))

describe('subsecciones() — el dump debe mostrar QUÉ cubre el artículo, no solo su título', () => {
  test('caza encabezados markdown (##/###)', () => {
    const out = subsecciones('## Herramientas del sistema\n\ntexto\n\n### 1. Restaurar sistema\n\nmás texto')
    expect(out).toContain('Herramientas del sistema')
    expect(out).toContain('1. Restaurar sistema')
  })

  test('CASO REAL: caza líneas en negrita como epígrafe (arts 2/3/4 del Explorador)', () => {
    // Formato real del art. 4: sin ##, con **Bold:** como separador de sección.
    const art4 = [
      'Gestión de archivos y carpetas en Windows 11:',
      '',
      '**Operaciones básicas:**',
      '- Crear carpeta: Ctrl + Mayús + N',
      '',
      '**Búsqueda:**',
      '- Filtros: tipo:, tamaño:, fecha:',
    ].join('\n')
    const out = subsecciones(art4)
    expect(out).toContain('Búsqueda')          // <- lo que 4 agentes dieron por ausente
    expect(out).toContain('Operaciones básicas')
  })

  test('no confunde negrita EN MEDIO de un párrafo con un encabezado', () => {
    const out = subsecciones('Un párrafo con **una palabra** en negrita y más texto detrás.')
    expect(out).toBe('')
  })

  test('sin contenido → cadena vacía (no rompe el dump)', () => {
    expect(subsecciones(null)).toBe('')
    expect(subsecciones('')).toBe('')
    expect(subsecciones('Texto plano sin secciones.')).toBe('')
  })

  test('deduplica y acota (un contenedor de 100k no puede inflar el dump)', () => {
    const many = Array.from({ length: 40 }, (_, i) => `## Sección ${i}`).join('\n')
    const out = subsecciones(many + '\n## Sección 0')
    expect(out.split('·').length).toBeLessThanOrEqual(12)
  })
})
