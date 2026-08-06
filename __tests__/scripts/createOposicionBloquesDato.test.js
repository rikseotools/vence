/**
 * [T-611] El scaffolder da de alta los bloques del temario como DATO.
 *
 * Antes, crear una oposición copiaba la carpeta de una plantilla —incluido su
 * `TopicContentView.tsx`— y le reescribía dentro un `getBlockInfo`. Esa era la fábrica que
 * produjo 131 copias del mismo componente. Ahora la ruta monta el componente compartido y lo
 * único propio de la oposición es una fila en `lib/temario/bloquesPorOposicion.ts`.
 *
 * Si esto se rompe, la oposición nueva NO falla: sirve su temario sin etiqueta de bloque y con
 * el número de tema crudo (201 en vez de «Tema 1»). Por eso se fija aquí, y por eso el test de
 * cobertura de `bloquesPorOposicion` es el otro extremo de la misma cuerda.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { tramosDesdeSpec, registrarBloques } = require('../../scripts/create-oposicion.cjs')

const spec = {
  bloques: [
    { numero: 1, titulo: 'Bloque I' },
    { numero: 2, titulo: 'Bloque II' },
    { numero: 3, titulo: 'Sin temas' },
  ],
  temario: [
    { bloque: 1, topic_number: 1, numero: 1 },
    { bloque: 1, topic_number: 11, numero: 11 },
    { bloque: 2, topic_number: 201, numero: 1 },
    { bloque: 2, topic_number: 204, numero: 4 },
  ],
}

describe('tramosDesdeSpec', () => {
  it('deriva un tramo por bloque, con su rango y su offset', () => {
    expect(tramosDesdeSpec(spec)).toEqual([
      { desde: 1, hasta: 11, offset: 0, bloque: 'Bloque I' },
      { desde: 201, hasta: 204, offset: 200, bloque: 'Bloque II' },
    ])
  })

  it('un bloque declarado SIN temas no genera tramo (no inventa un rango vacío)', () => {
    expect(tramosDesdeSpec(spec).map((t) => t.bloque)).not.toContain('Sin temas')
  })

  it('un temario plano (sin prefijos) sale con offset 0 y se muestra tal cual', () => {
    const plano = {
      bloques: [{ numero: 1, titulo: 'Parte única' }],
      temario: [{ bloque: 1, topic_number: 3, numero: 3 }],
    }
    expect(tramosDesdeSpec(plano)).toEqual([
      { desde: 3, hasta: 3, offset: 0, bloque: 'Parte única' },
    ])
  })
})

describe('registrarBloques', () => {
  const ANCLA = 'export const BLOQUES_POR_OPOSICION: Record<string, TramoBloque[]> = {\n'
  let dir, cwd

  beforeEach(() => {
    cwd = process.cwd()
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 't611-'))
    fs.mkdirSync(path.join(dir, 'lib', 'temario'), { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'lib/temario/bloquesPorOposicion.ts'),
      `import type { TramoBloque } from './bloquesTemario'\n\n${ANCLA}  'ya-existe': [\n    { desde: 1, hasta: 2, offset: 0, bloque: "X" },\n  ],\n}\n`,
    )
    process.chdir(dir)
  })
  afterEach(() => {
    process.chdir(cwd)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const leer = () => fs.readFileSync(path.join(dir, 'lib/temario/bloquesPorOposicion.ts'), 'utf8')

  it('añade la entrada de la oposición nueva', () => {
    expect(registrarBloques('nueva-opo', 'Nueva', tramosDesdeSpec(spec))).toBe(true)
    const s = leer()
    expect(s).toContain("'nueva-opo': [")
    expect(s).toContain('{ desde: 201, hasta: 204, offset: 200, bloque: "Bloque II" },')
    expect(s).toContain("  // Nueva")
    // y no se lleva por delante lo que ya había
    expect(s).toContain("'ya-existe': [")
  })

  it('es IDEMPOTENTE: correrlo dos veces no duplica la entrada', () => {
    registrarBloques('nueva-opo', 'Nueva', tramosDesdeSpec(spec))
    expect(registrarBloques('nueva-opo', 'Nueva', tramosDesdeSpec(spec))).toBe(false)
    expect(leer().match(/'nueva-opo':/g)).toHaveLength(1)
  })

  it('escapa las comillas del título (un bloque puede llevarlas)', () => {
    registrarBloques('opo-comillas', 'C', [{ desde: 1, hasta: 2, offset: 0, bloque: 'El "Bloque"' }])
    expect(leer()).toContain('bloque: "El \\"Bloque\\"" }')
  })

  it('ABORTA si el fichero de dato ha cambiado de forma (mejor parar que escribir a ciegas)', () => {
    fs.writeFileSync(path.join(dir, 'lib/temario/bloquesPorOposicion.ts'), 'export const OTRA_COSA = {}\n')
    expect(() => registrarBloques('x', 'X', tramosDesdeSpec(spec))).toThrow(/ancla/i)
  })

  it('ABORTA si el fichero de dato no existe (no sigue como si nada)', () => {
    fs.rmSync(path.join(dir, 'lib/temario/bloquesPorOposicion.ts'))
    expect(() => registrarBloques('x', 'X', tramosDesdeSpec(spec))).toThrow(/bloquesPorOposicion/)
  })
})
