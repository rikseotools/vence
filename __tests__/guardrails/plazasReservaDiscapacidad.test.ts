// GUARDARRAÍL: nadie suma la reserva de discapacidad por su cuenta.
//
// ## Qué pasó (29/07/2026, lo reportó Concha Porras)
//
// El catálogo `/oposiciones` enseñaba **51 plazas** en el Ayuntamiento de Sevilla cuando
// la convocatoria tiene **46**, y **12** en Subalternos del Parlamento de Andalucía cuando
// son **11**. En ambas, la reserva de discapacidad va DENTRO del turno libre
// (`plazas_discapacidad_incluidas = true`), y el catálogo la sumaba igualmente.
//
// Lo grave no es el número: es que **la landing decía 46 y el catálogo 51 a la vez**, y
// todo estaba en verde. Los datos en BD eran correctos, los tests pasaban y ningún
// auditor compara superficies entre sí.
//
// El núcleo que resuelve la regla existía desde el día anterior (T-214,
// `lib/convocatoria/reservaDiscapacidad.ts`), pero se aplicó solo a la landing, que es
// donde se había visto el fallo. El catálogo hacía su propia cuenta en TRES sitios.
//
// Alcance en el momento de arreglarlo: **35 oposiciones activas** salían infladas, entre
// ellas Administrativo del Estado (2.523 en vez de 2.300) y Auxiliar del Estado (1.591 en
// vez de 1.450).
//
// Este test prohíbe el patrón: si una superficie nueva vuelve a sumar a pelo, falla aquí.
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { totalTurnoLibre } from '@/lib/convocatoria/reservaDiscapacidad'

const RAIZ = process.cwd()

/** Ficheros de app/ y components/ que pintan plazas. */
function ficherosDeUI(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(join(RAIZ, dir))) {
    if (nombre === 'node_modules' || nombre.startsWith('.')) continue
    const rel = `${dir}/${nombre}`
    const st = statSync(join(RAIZ, rel))
    if (st.isDirectory()) ficherosDeUI(rel, acc)
    else if (/\.(tsx?|jsx?)$/.test(nombre)) acc.push(rel)
  }
  return acc
}

// La suma manual: `(algo.plazas_libres ?? 0) + (algo.plazas_discapacidad ?? 0)` en
// cualquiera de sus formas (snake_case o camelCase, con o sin `?? 0`).
const SUMA_A_PELO =
  /plazas[_]?[lL]ibres[^\n]{0,30}\+[^\n]{0,30}plazas[_]?[dD]iscapacidad|plazas[_]?[dD]iscapacidad[^\n]{0,30}\+[^\n]{0,30}plazas[_]?[lL]ibres/

describe('la reserva de discapacidad solo la suma el núcleo', () => {
  it('ninguna pantalla suma plazas_libres + plazas_discapacidad por su cuenta', () => {
    const culpables: string[] = []
    for (const rel of [...ficherosDeUI('app'), ...ficherosDeUI('components')]) {
      const src = readFileSync(join(RAIZ, rel), 'utf8')
      for (const [i, linea] of src.split('\n').entries()) {
        if (linea.trimStart().startsWith('//') || linea.trimStart().startsWith('*')) continue
        if (SUMA_A_PELO.test(linea)) culpables.push(`${rel}:${i + 1} → ${linea.trim().slice(0, 100)}`)
      }
    }
    // Mensaje explícito: quien rompa esto tiene que saber QUÉ usar en su lugar.
    expect(culpables.join('\n') || 'ninguno').toBe('ninguno')
  })

  it('el núcleo NO suma cuando la reserva va dentro (el caso de Sevilla)', () => {
    expect(totalTurnoLibre(46, 5, true)).toBe(46)
    expect(totalTurnoLibre(11, 1, true)).toBe(11)
  })

  it('el núcleo SÍ suma cuando la reserva va aparte', () => {
    expect(totalTurnoLibre(43, 12, false)).toBe(55)
  })

  it('sin dato declarado no inventa una suma', () => {
    expect(totalTurnoLibre(46, 5, null)).toBe(46)
    expect(totalTurnoLibre(46, 5, undefined)).toBe(46)
  })

  it('sin plazas no devuelve 0 sino null (0 plazas y "no consta" no son lo mismo)', () => {
    expect(totalTurnoLibre(null, 5, true)).toBeNull()
  })

  it('las superficies del catálogo consultan el flag (no basta con no sumar)', () => {
    // Si la query no trae la columna, el núcleo recibe `undefined` y calla — que es
    // seguro, pero deja de distinguir "dentro" de "aparte" y vuelve a ser un dato mudo.
    for (const rel of [
      'app/oposiciones/page.tsx',
      'app/oposiciones/[filtro]/page.tsx',
    ]) {
      expect(readFileSync(join(RAIZ, rel), 'utf8')).toContain('plazas_discapacidad_incluidas')
    }
  })
})
