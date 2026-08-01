/**
 * @jest-environment node
 */
// GUARDARRAÍL: las cifras de VOLUMEN que la plataforma se atribuye no se escriben a mano [T-460].
//
// ## De dónde sale (01/08/2026)
//
// Manuel abrió la página de una pregunta y vio «En Vence tenemos +5000 preguntas». Había **145.206**
// activas: veintinueve veces más. Al barrer el repo aparecieron 13 sitios con cifras clavadas, y
// ninguna se acercaba: el footer —que sale en TODAS las páginas— decía «Más de 20.000», la sección de
// leyes «+3000» (48 veces menos), la landing de Ads «5.000+».
//
// El fallo de fondo no era que un número envejeciera, sino que **no había de dónde sacarlo bien**:
// cada pantalla se inventó el suyo el día que se escribió. Con `getPlatformStats()` ya lo hay, así
// que a partir de aquí escribirlo a mano es una regresión, no un descuido.
//
// Lo que NO vigila: cifras que son HECHOS y no volumen — las «110 preguntas» de un simulacro (formato
// del examen) o los «169 artículos» de la Constitución. Por eso la lista de ficheros es explícita en
// vez de un barrido ciego: un guardarraíl que grita por lo legítimo se acaba desactivando.
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/** Superficies de usuario donde una cifra de volumen a mano es siempre un defecto. */
const VIGILADOS = [
  'app/Footer.tsx',
  'app/pregunta/[id]/page.tsx',
]

/** «+20.000 preguntas», «Más de 500 preguntas», «5.000+ preguntas», «+3000 tests»… */
const CIFRA_A_MANO =
  /(\+\s?[0-9][0-9.,]{2,}|[0-9][0-9.,]{2,}\s?\+|(más|mas) de\s+[0-9][0-9.,]{2,})\s*(preguntas|tests|oposiciones|leyes)/i

describe('las cifras de volumen salen de la BD, no del teclado', () => {
  it.each(VIGILADOS)('%s no clava una cifra de volumen', (rel) => {
    const src = leer(rel)
    const m = src.match(CIFRA_A_MANO)
    expect(m ? `${rel}: «${m[0]}»` : null).toBeNull()
  })

  it('existe la fuente única y expone lo que hace falta', () => {
    expect(leer('lib/api/platform-stats/queries.ts')).toMatch(/export async function getPlatformStats/)
    const puro = leer('lib/api/platform-stats/shared.ts')
    expect(puro).toMatch(/export function formatVolumen/)
    expect(puro).toMatch(/export const MINIMOS_GARANTIZADOS/)
  })

  it('lo que viaja al NAVEGADOR no arrastra la BD', () => {
    // Lo cazó la prueba en navegador, no un test: con `formatVolumen` viviendo junto a la consulta,
    // el hook de cliente arrastraba `getDb → postgres → tls` al bundle. El navegador respondía
    // «Module not found: Can't resolve 'tls'» y la página se quedaba SIN footer y SIN CTA, con los
    // 13 tests en verde y el typecheck limpio. Este es el invariante que lo impide.
    // Se miran las líneas de IMPORT, no el texto: la primera versión de este test fallaba porque la
    // palabra «postgres» aparece en el comentario que explica el bug. Un guardarraíl que salta por
    // su propia documentación se acaba borrando.
    const imports = leer('lib/api/platform-stats/shared.ts')
      .split('\n')
      .filter((l) => /^\s*import\b/.test(l))
      .join('\n')
    expect(imports).not.toMatch(/@\/db\/|drizzle-orm|postgres|versionedCache|next\/cache/)
    // Y el hook de cliente tiene que beber de ahí, no del módulo con la consulta.
    expect(leer('hooks/usePlatformStats.ts')).toMatch(/platform-stats\/shared/)
    expect(leer('hooks/usePlatformStats.ts')).not.toMatch(/platform-stats\/queries/)
  })

  it('está CACHEADA: esto sale en el footer de todas las páginas', () => {
    // Sin caché, cada carga de página metería tres COUNT sobre tablas de cientos de miles de filas.
    const src = leer('lib/api/platform-stats/queries.ts')
    expect(src).toMatch(/versionedCache|unstable_cache/)
    expect(src).toMatch(/tag: 'platform-stats'/)
  })

  it('un fallo de BD NO se cachea: devolvería ceros durante 24 h', () => {
    // La lección la dejó `law-stats`: un timeout envenenó su caché 6 h y generó una tanda de
    // feedbacks de «no cargan los tests». Aquí la variante interna lanza en vez de devolver 0.
    const src = leer('lib/api/platform-stats/queries.ts')
    expect(src).toMatch(/OrThrow/)
    expect(src).toMatch(/no se cachea/)
  })

  it('los componentes vigilados consumen la fuente única', () => {
    for (const rel of VIGILADOS) {
      if (!existsSync(join(process.cwd(), rel))) continue
      expect(leer(rel)).toMatch(/usePlatformStats|getPlatformStats/)
    }
  })
})
