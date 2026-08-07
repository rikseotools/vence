// __tests__/guardrails/retoForzadoPuertaUnica.guardrail.test.ts
//
// La marca de "retar siempre" (`captcha:force:*` en Redis) tiene UNA sola puerta de escritura:
// `markForcedChallenge`, en lib/security/challengePolicy/forceChallenge.ts. Ahí vive la exención
// de las cuentas sintéticas (07/08/2026, ver ese fichero) y ahí tiene que seguir.
//
// Sin este guardarraíl la protección se pierde de la forma habitual: alguien añade un segundo
// sitio que escribe la clave a mano —o llama a la puerta sin decirle de quién es la cuenta— y la
// exención deja de aplicarse sin que nada se ponga rojo. Es el mismo modo de fallo que ya costó
// los cinco escritores de `seguimiento_url` (T-130).

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const PUERTA = 'lib/security/challengePolicy/forceChallenge.ts'
const IGNORAR = new Set(['node_modules', '.next', '.git', 'coverage', 'scratchpad', 'dist', 'build'])

function ficherosDeCodigo(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (IGNORAR.has(nombre)) continue
    const ruta = join(dir, nombre)
    const st = statSync(ruta)
    if (st.isDirectory()) ficherosDeCodigo(ruta, acc)
    else if (/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(nombre)) acc.push(ruta)
  }
  return acc
}

/**
 * Quita comentarios antes de juzgar. Nombrar la clave EXPLICANDO por qué solo se construye en un
 * sitio es justo lo que se quiere que la gente escriba; lo que no puede haber es una segunda
 * pieza que la fabrique. Sin esto, el guardarraíl castigaba la documentación y empujaba a
 * borrarla — que es lo contrario de lo que persigue.
 */
function soloCodigo(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|#)/.test(l))
    .join('\n')
}

describe('guardarraíl: una sola puerta para el reto forzado', () => {
  const ficheros = ficherosDeCodigo(RAIZ)

  it('nadie construye la clave `captcha:force:` fuera de la puerta', () => {
    const infractores = ficheros.filter((f) => {
      const rel = f.slice(RAIZ.length + 1)
      if (rel === PUERTA) return false
      if (rel.startsWith('__tests__/')) return false // los tests la citan para comprobarla
      return soloCodigo(readFileSync(f, 'utf8')).includes('captcha:force:')
    })
    expect(infractores.map((f) => f.slice(RAIZ.length + 1))).toEqual([])
  })

  it('todo el que llama a markForcedChallenge le pasa el userId (sin él no hay exención posible)', () => {
    const llamantes = ficheros.filter((f) => {
      const rel = f.slice(RAIZ.length + 1)
      if (rel === PUERTA || rel.startsWith('__tests__/')) return false
      return readFileSync(f, 'utf8').includes('markForcedChallenge(')
    })

    expect(llamantes.length).toBeGreaterThan(0) // si nadie la llama, este guardarraíl miente

    const sinUserId = llamantes.filter((f) => {
      const src = readFileSync(f, 'utf8')
      // la llamada y sus argumentos, hasta el cierre de la invocación
      const m = src.match(/markForcedChallenge\(([\s\S]{0,300}?)\)\s*[\.\;\n]/)
      return !m || !/userId/.test(m[1])
    })
    expect(sinUserId.map((f) => f.slice(RAIZ.length + 1))).toEqual([])
  })
})
