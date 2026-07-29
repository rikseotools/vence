/**
 * @jest-environment node
 */
// Unitarios del núcleo PURO que reparte un tema en partes descargables (T-273).
// Importa el módulo REAL de producción, nunca una copia.
//
// Los tamaños son los MEDIDOS: el tema 29 de `auxiliar-administrativo-diputacion-segovia` son 651
// páginas y 1.337.214 caracteres en 7 bloques, y el mayor (Excel 365, 410.592) NO cabe él solo bajo
// el techo de 400.000 — que es justo el caso que obliga a tener dos niveles de corte.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { planPartes, necesitaPartes } = require('@/lib/temario/pdf/planPartes.cjs') as {
  planPartes: (c: Contenido, max: number) => { total: number; partes: Parte[] }
  necesitaPartes: (c: Contenido, max: number) => boolean
}

interface Art { article_number?: string | number; content?: string | null }
interface Bloque { law?: { short_name?: string }; articles?: Art[] }
interface Contenido { laws?: Bloque[] }
interface Parte { indice: number; total: number; etiqueta: string; chars: number; laws: Bloque[] }

const MAX = 400_000
/** Un bloque con `n` artículos que suman `chars` caracteres repartidos por igual. */
const bloque = (nombre: string, chars: number, nArts = 4): Bloque => ({
  law: { short_name: nombre },
  articles: Array.from({ length: nArts }, (_, i) => ({
    article_number: String(i + 1),
    content: 'x'.repeat(Math.floor(chars / nArts)),
  })),
})

// La composición REAL del tema de 651 páginas.
const TEMA_29: Contenido = {
  laws: [
    bloque('Excel 365', 410_592, 21),
    bloque('Access 365', 334_048, 5),
    bloque('Word 365', 167_880, 6),
    bloque('Word 365 Escritorio', 166_894, 6),
    bloque('Informática Básica', 145_522, 6),
    bloque('Excel 365 Escritorio', 74_492, 4),
    bloque('Windows 10', 37_786, 4),
  ],
}

describe('planPartes — el tema real de 651 páginas', () => {
  const plan = planPartes(TEMA_29, MAX)

  it('lo reparte en varias partes, ninguna por encima del techo', () => {
    expect(plan.total).toBeGreaterThan(1)
    for (const p of plan.partes) expect(p.chars).toBeLessThanOrEqual(MAX)
  })

  it('NO pierde contenido: la suma de las partes es el total', () => {
    // Lo más importante del troceado. Si esto falla, al opositor le falta materia y no lo sabe.
    const totalPartes = plan.partes.reduce((n, p) => n + p.chars, 0)
    const totalOriginal = TEMA_29.laws!.reduce(
      (n, b) => n + b.articles!.reduce((m, a) => m + (a.content?.length ?? 0), 0), 0)
    expect(totalPartes).toBe(totalOriginal)
  })

  it('parte Excel 365 por RANGO DE ARTÍCULOS, porque no cabe él solo', () => {
    // 410.592 > 400.000. Es el caso que obliga al segundo nivel de corte.
    const conRango = plan.partes.filter(p => /Excel 365 \(arts?\./.test(p.etiqueta))
    expect(conRango.length).toBeGreaterThanOrEqual(2)
    expect(conRango[0].etiqueta).toMatch(/Excel 365 \(arts\. 1-\d+\)/)
  })

  it('respeta el ORDEN del documento (reordenar rompería la lógica del temario)', () => {
    const primeraEtiqueta = plan.partes[0].etiqueta
    expect(primeraEtiqueta).toMatch(/^Excel 365/)
  })

  it('las partes se numeran 1..N con el total correcto', () => {
    plan.partes.forEach((p, i) => {
      expect(p.indice).toBe(i + 1)
      expect(p.total).toBe(plan.total)
    })
  })
})

describe('planPartes — lo que NO debe trocear', () => {
  it('un tema que cabe entero da UNA parte y no se presenta troceado', () => {
    const chico: Contenido = { laws: [bloque('Ley 39/2015', 50_000)] }
    expect(planPartes(chico, MAX).total).toBe(1)
    expect(necesitaPartes(chico, MAX)).toBe(false)
  })

  it('agrupa bloques pequeños en vez de hacer una parte por cada uno', () => {
    // Siete bloques de 10k no pueden dar siete descargas: eso es peor que un PDF grande.
    const many: Contenido = { laws: Array.from({ length: 7 }, (_, i) => bloque(`Ley ${i}`, 10_000)) }
    expect(planPartes(many, MAX).total).toBe(1)
  })

  it('un tema vacío o sin bloques no revienta', () => {
    expect(planPartes({}, MAX).total).toBe(0)
    expect(planPartes({ laws: [] }, MAX).total).toBe(0)
    // @ts-expect-error — entrada inválida a propósito
    expect(planPartes(undefined, MAX).total).toBe(0)
  })
})

describe('planPartes — no partir un artículo por la mitad', () => {
  it('un artículo gigante va en su propia parte antes que trocearse', () => {
    // Un artículo cortado a la mitad no sirve para estudiar; una parte grande, sí.
    const cajon: Contenido = {
      laws: [{ law: { short_name: 'Artículo-cajón' }, articles: [{ article_number: '1', content: 'x'.repeat(600_000) }] }],
    }
    const plan = planPartes(cajon, MAX)
    expect(plan.total).toBe(1)
    expect(plan.partes[0].chars).toBe(600_000)
  })

  it('los tramos de un bloque partido son CONSECUTIVOS y sin solape', () => {
    const grande: Contenido = { laws: [bloque('Excel 365', 900_000, 9)] }
    const plan = planPartes(grande, MAX)
    const numeros = plan.partes.flatMap(p => p.laws.flatMap(l => (l.articles ?? []).map(a => Number(a.article_number))))
    expect(numeros).toEqual([...numeros].sort((a, b) => a - b))
    expect(new Set(numeros).size).toBe(numeros.length)
  })
})

describe('planPartes — la etiqueta la lee un humano', () => {
  it('con un bloque, la etiqueta es su nombre', () => {
    const p = planPartes({ laws: [bloque('Ley 39/2015', 100_000)] }, MAX).partes[0]
    expect(p.etiqueta).toBe('Ley 39/2015')
  })

  it('con muchos bloques resume en vez de encadenar siete nombres', () => {
    const many: Contenido = { laws: Array.from({ length: 5 }, (_, i) => bloque(`Ley ${i}`, 10_000)) }
    expect(planPartes(many, MAX).partes[0].etiqueta).toMatch(/y 3 más$/)
  })
})
