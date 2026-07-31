// GUARDARRAÍL: el criterio de vigilancia de fuentes legales es UNO, en dos copias. [T-380]
//
// POR QUÉ: el CLI (`scripts/laws/vigilar-fuentes-legales.cjs`, núcleo en
// `lib/laws/sourceWatch.cjs`) y el cron del backend (`backend/src/law-source-watch/`) tienen
// que clasificar IGUAL. Si divergen, la línea base que fija uno la lee el otro como «cambiada»
// y la señal se convierte en ruido — que es justo el fallo que costó un 8-de-8 en falso el
// 31/07, allí entre dos criterios de hash distintos.
//
// El backend no importa de `lib/` (son paquetes separados), así que el patrón de la casa es
// copia + paridad vigilada por test, como `lib/observability/benignSignals` y su gemelo.
// Este test compara lo que IMPORTA (umbrales, firmas de bloqueo y hash resultante), no el
// formato: el backend es TypeScript y el núcleo CommonJS, y forzar identidad textual haría
// fallar el guardarraíl por un punto y coma.

import { readFileSync } from 'fs'
import { join } from 'path'
import {
  hashFuente, clasificarVigilancia, pareceBloqueo, MINIMO_SERVIBLE,
} from '@/lib/laws/sourceWatch.cjs'

const raiz = process.cwd()
const backend = readFileSync(join(raiz, 'backend/src/law-source-watch/source-watch.core.ts'), 'utf8')
const nucleo = readFileSync(join(raiz, 'lib/laws/sourceWatch.cjs'), 'utf8')

/** Firmas de bloqueo declaradas en un fichero, como texto de la expresión regular. */
function firmasDe(src: string): string[] {
  const i = src.indexOf('FIRMAS_BLOQUEO')
  const abre = src.indexOf('[', i)
  // El cierre se busca como `]` a secas: el núcleo es CommonJS y no lleva punto y coma, el
  // backend es TS y sí. Exigir `];` hacía que este guardarraíl leyera CERO firmas del núcleo
  // y pasara en verde comparando dos listas vacías — un guardarraíl que no mira nada.
  const cierra = src.indexOf(']', abre)
  return [...src.slice(abre, cierra).matchAll(/\/(.+?)\/[a-z]*,/g)].map((m) => m[1])
}

describe('paridad del criterio de vigilancia de fuentes legales', () => {
  it('las dos copias declaran las MISMAS firmas de bloqueo', () => {
    // Si el backend aprende a reconocer un WAF nuevo y el CLI no, la misma fuente saldrá
    // «inaccesible» para uno y «cambiada» para el otro.
    expect(firmasDe(backend)).toEqual(firmasDe(nucleo))
    expect(firmasDe(nucleo).length).toBeGreaterThan(5)
  })

  it('el umbral de documento servible es el mismo', () => {
    const delBackend = backend.match(/MINIMO_SERVIBLE\s*=\s*(\d+)/)
    expect(Number(delBackend?.[1])).toBe(MINIMO_SERVIBLE)
  })

  it('las dos normalizan igual: mismas reglas de limpieza', () => {
    // Comparar las transformaciones declaradas, no el texto: basta con que una copia deje de
    // ignorar la fecha de consulta para que sus hashes dejen de coincidir.
    const reglas = (src: string) =>
      (src.match(/\.replace\(([^)]+)/g) || []).map((r) => r.replace(/\s+/g, ''))
    const soloNorm = (src: string) => {
      const i = src.indexOf('function normalizarParaHash')
      return src.slice(i, src.indexOf('\n}', i))
    }
    expect(reglas(soloNorm(backend))).toEqual(reglas(soloNorm(nucleo)))
  })

  it('el backend declara los mismos cuatro estados', () => {
    for (const estado of ['sin_cambio', 'cambiada', 'inaccesible', 'linea_base']) {
      expect(backend).toContain(`'${estado}'`)
    }
  })

  it('el núcleo sigue clasificando como se espera (ancla de comportamiento)', () => {
    // Si alguien cambia la lógica de los dos a la vez, la paridad textual seguiría verde. Esto
    // fija el comportamiento en sí, que es lo que de verdad se comparte.
    const doc = 'Artículo 1. '.padEnd(MINIMO_SERVIBLE + 100, 'texto ')
    expect(clasificarVigilancia({ hashPrevio: null, textoDescargado: doc }).estado).toBe('linea_base')
    expect(clasificarVigilancia({ hashPrevio: hashFuente(doc), textoDescargado: doc }).estado).toBe('sin_cambio')
    expect(pareceBloqueo('please solve this captcha')).toBe(true)
  })

  it('la copia del backend avisa de que es copia', () => {
    expect(backend).toMatch(/COPIA PARITARIA/)
    expect(backend).toContain('lib/laws/sourceWatch.cjs')
  })
})
