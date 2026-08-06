// __tests__/temario/bloquesTemario.test.ts
//
// Tres capas sobre los bloques del temario (T-611):
//   1. el núcleo puro `resolverBloque` hace lo que dice;
//   2. EQUIVALENCIA — el dato reproduce, tema a tema, lo que hacían las 131
//      `getBlockInfo` copiadas en los TopicContentView, congelado en un fixture
//      generado ANTES de borrarlas (la prueba sobrevive al borrado);
//   3. COBERTURA — ninguna ruta de temario se queda sin sus bloques.
import fs from 'fs'
import path from 'path'
import { resolverBloque, type TramoBloque } from '@/lib/temario/bloquesTemario'
import { BLOQUES_POR_OPOSICION } from '@/lib/temario/bloquesPorOposicion'

describe('resolverBloque (núcleo puro)', () => {
  const tramos: TramoBloque[] = [
    { desde: 1, hasta: 11, offset: 0, bloque: 'Bloque I' },
    { desde: 201, hasta: 204, offset: 200, bloque: 'Bloque II' },
  ]

  it('devuelve el bloque y el número tal cual cuando no hay desplazamiento', () => {
    expect(resolverBloque(tramos, 5)).toEqual({ block: 'Bloque I', displayNum: 5 })
  })

  it('resta el desplazamiento: el tema 202 se enseña como el 2 de su bloque', () => {
    expect(resolverBloque(tramos, 202)).toEqual({ block: 'Bloque II', displayNum: 2 })
  })

  it('incluye los dos extremos del tramo', () => {
    expect(resolverBloque(tramos, 1).block).toBe('Bloque I')
    expect(resolverBloque(tramos, 11).block).toBe('Bloque I')
    expect(resolverBloque(tramos, 201).displayNum).toBe(1)
    expect(resolverBloque(tramos, 204).displayNum).toBe(4)
  })

  it('un tema fuera de todos los tramos NO es un error: sale sin bloque y con su número', () => {
    // Contrato heredado de las 131 originales (su `return` por defecto). Hay temarios
    // planos y temas fuera de rango; el componente simplemente no pinta la etiqueta.
    expect(resolverBloque(tramos, 12)).toEqual({ block: '', displayNum: 12 })
    expect(resolverBloque(tramos, 999)).toEqual({ block: '', displayNum: 999 })
  })

  it('aguanta una oposición sin bloques (lista vacía o sin entrada)', () => {
    expect(resolverBloque([], 3)).toEqual({ block: '', displayNum: 3 })
    expect(resolverBloque(undefined, 3)).toEqual({ block: '', displayNum: 3 })
  })

  it('gana el PRIMER tramo que casa (los solapes no cambian el resultado en silencio)', () => {
    const solapados: TramoBloque[] = [
      { desde: 1, hasta: 10, offset: 0, bloque: 'A' },
      { desde: 5, hasta: 15, offset: 4, bloque: 'B' },
    ]
    expect(resolverBloque(solapados, 7)).toEqual({ block: 'A', displayNum: 7 })
  })
})

describe('EQUIVALENCIA con las 131 getBlockInfo originales', () => {
  const fixture = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), '__tests__/temario/fixtures/bloques-originales.json'),
      'utf8',
    ),
  ) as {
    maxTema: number
    // [desde, hasta, bloque, offset] — comportamiento original comprimido en tramos.
    // Incluye los tramos SIN bloque: son el caso por defecto, que el dato no almacena.
    oposiciones: Record<string, Array<[number, number, string, number]>>
  }

  const slugs = Object.keys(fixture.oposiciones)

  it('el fixture cubre las 131 oposiciones que tenían componente propio', () => {
    expect(slugs.length).toBe(131)
  })

  it('el fixture llega hasta el 999 (los bloques numeran 201..608, no 1..N)', () => {
    // La primera versión del generador muestreó hasta 120 y perdió los bloques II a VI
    // de administrativo-estado SIN divergencias, porque comprobaba sobre el mismo rango
    // truncado. Este test fija el techo para que no se pueda repetir.
    expect(fixture.maxTema).toBeGreaterThanOrEqual(608)
  })

  it.each(slugs)('%s: el dato reproduce el comportamiento original, tema a tema', (slug) => {
    const tramos = BLOQUES_POR_OPOSICION[slug]
    let comprobados = 0
    for (const [desde, hasta, block, offset] of fixture.oposiciones[slug]) {
      for (let n = desde; n <= hasta; n++) {
        comprobados++
        const r = resolverBloque(tramos, n)
        if (r.block !== block || r.displayNum !== n - offset) {
          throw new Error(
            `${slug} tema ${n}: antes "${block}"/${n - offset}, ahora "${r.block}"/${r.displayNum}`,
          )
        }
      }
    }
    // Que el tramo comprimido se haya expandido de verdad: un fixture mal leído pasaría
    // "sin comprobar nada" y el test sería un sello.
    expect(comprobados).toBe(fixture.maxTema)
  })

  it('administrativo-estado conserva sus SEIS bloques (el caso que cazó el truncamiento)', () => {
    const bloques = new Set(
      (BLOQUES_POR_OPOSICION['administrativo-estado'] ?? []).map((t) => t.bloque),
    )
    expect(bloques).toEqual(
      new Set(['Bloque I', 'Bloque II', 'Bloque III', 'Bloque IV', 'Bloque V', 'Bloque VI']),
    )
  })
})

describe('COBERTURA — ninguna ruta de temario sin bloques', () => {
  function rutasDeTemario(): string[] {
    const raiz = path.join(process.cwd(), 'app')
    return fs
      .readdirSync(raiz, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => fs.existsSync(path.join(raiz, e.name, 'temario', '[slug]', 'page.tsx')))
      .map((e) => e.name)
  }

  it('cada oposición con página de tema tiene entrada en BLOQUES_POR_OPOSICION', () => {
    // Al dar de alta una oposición nueva hay que añadir su fila. Sin esto, su temario
    // se serviría sin etiqueta de bloque y con el número crudo — y nadie se enteraría,
    // que es exactamente cómo nacieron los 131 duplicados.
    const faltan = rutasDeTemario().filter((slug) => !(slug in BLOQUES_POR_OPOSICION))
    expect(faltan).toEqual([])
  })

  it('los tramos están bien formados (desde <= hasta, con nombre, offset entero)', () => {
    const rotos: string[] = []
    for (const [slug, tramos] of Object.entries(BLOQUES_POR_OPOSICION)) {
      for (const t of tramos) {
        if (t.desde > t.hasta) rotos.push(`${slug}: tramo al revés ${t.desde}..${t.hasta}`)
        if (!t.bloque.trim()) rotos.push(`${slug}: tramo ${t.desde}..${t.hasta} sin nombre`)
        if (!Number.isInteger(t.offset)) rotos.push(`${slug}: offset no entero (${t.offset})`)
      }
    }
    expect(rotos).toEqual([])
  })
})
