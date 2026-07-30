// GUARDARRAÍL: las rutas de los imports tienen que casar EXACTAMENTE con lo que hay en git.
//
// ## De dónde sale (30/07/2026)
//
// Al crear dos componentes en `components/admin/` (minúscula), git los registró en
// `components/Admin/` — la carpeta que ya existía— porque el repositorio tiene
// `core.ignorecase=true`. En el disco local todo funcionaba: los ficheros estaban donde
// decían los imports y el `next dev` compilaba.
//
// Pero el contenedor de producción es Linux y **sí distingue mayúsculas**: al clonar habría
// creado `components/Admin/BotonVerComoUsuario.tsx`, y el `import '@/components/admin/…'`
// no habría resuelto. Es decir, **el build de producción habría fallado con todo verde en
// local**, que es la peor forma de romperlo. Se detectó al ir a empujar, porque git marcaba
// los ficheros como borrados.
//
// Este test compara los imports con el índice de git de forma sensible a la caja.
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'

const RAIZ = process.cwd()

function ficherosDeGit(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean)
}

const CARPETAS = ['components/', 'lib/', 'app/', 'utils/', 'hooks/', 'contexts/', 'db/', 'types/']

describe('las rutas casan exactamente (Linux distingue mayúsculas)', () => {
  const ficheros = ficherosDeGit()
  const conjunto = new Set(ficheros)

  it('hay ficheros que revisar', () => {
    expect(ficheros.length).toBeGreaterThan(500)
  })

  it('git no tiene la MISMA ruta registrada dos veces con distinta caja', () => {
    // Un duplicado así significa que alguien creó `Foo/` teniendo `foo/`: en local se ve una
    // sola carpeta y en el contenedor aparecen dos, cada una a medias.
    const porMinuscula = new Map<string, string[]>()
    for (const f of ficheros) {
      const k = f.toLowerCase()
      porMinuscula.set(k, [...(porMinuscula.get(k) ?? []), f])
    }
    const dups = [...porMinuscula.values()].filter((v) => v.length > 1)
    expect(dups.map((d) => d.join(' ≠ ')).join('\n') || 'ninguno').toBe('ninguno')
  })

  it('ningún import con alias @/ resuelve SOLO ignorando mayúsculas', () => {
    const malos: string[] = []
    for (const f of ficheros) {
      if (!/\.(ts|tsx|js|jsx)$/.test(f)) continue
      let src = ''
      try {
        src = readFileSync(f, 'utf8')
      } catch {
        continue
      }
      for (const m of src.matchAll(/from ['"]@\/([^'"]+)['"]/g)) {
        const destino = m[1]
        if (!CARPETAS.some((c) => destino.startsWith(c))) continue
        const exacto = [...conjunto].some(
          (x) => x === destino || x.startsWith(destino + '.') || x.startsWith(destino + '/'),
        )
        if (exacto) continue
        const flexible = ficheros.some(
          (x) => x.toLowerCase() === destino.toLowerCase() || x.toLowerCase().startsWith(destino.toLowerCase() + '.'),
        )
        // Solo se denuncia si existe con OTRA caja: si no existe de ninguna forma, es otro
        // problema (un import roto de verdad) y lo canta el typecheck.
        if (flexible) malos.push(`${f} → @/${destino}`)
      }
    }
    expect(malos.join('\n') || 'ninguno').toBe('ninguno')
  })
})
