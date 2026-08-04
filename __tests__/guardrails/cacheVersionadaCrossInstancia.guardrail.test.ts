/**
 * Una caché que se invalida POR TAG tiene que ser versionada, o solo se limpia en una instancia.
 *
 * ── EL FALLO, medido dos veces el mismo día (T-510, 03/08/2026) ───────────────────────────────
 *
 * En AWS el frontend son N contenedores Next.js standalone, **cada uno con su `unstable_cache` EN
 * MEMORIA**. `revalidateTag()` solo limpia el proceso que lo ejecuta, así que una llamada a
 * `/api/admin/revalidate` limpia **una instancia de cuatro** y las demás siguen sirviendo lo viejo.
 * No falla: acierta a veces, que es peor, porque parece funcionar.
 *
 * Se vio al poblar los capítulos de 21 leyes. Con el dato correcto en la base de datos:
 *   · Ley 39/2015 → la URL limpia pasó a servir 7 títulos + 16 capítulos ✅
 *   · Ley 1/2000  → la URL limpia seguía en 8 títulos y 0 capítulos ❌, y con un parámetro
 *                   anti-caché salían sus 80. Mismo despliegue, mismo tag, misma tanda de
 *                   invalidaciones: la diferencia era a qué contenedor llegó cada petición.
 *
 * Antes de eso ya había costado un diagnóstico equivocado: di por hecho que fallaba el RENDER
 * (causa cara) sin descartar la CACHÉ (causa barata), y escribí esa conclusión en la ficha.
 *
 * ── LO QUE FIJA ESTE TEST ─────────────────────────────────────────────────────────────────────
 *
 * `versionedCache` mete la versión del tag —leída de Postgres, común a todas las instancias—
 * DENTRO de la clave, así que un bump la cambia para todas a la vez. Este guardarraíl impide que
 * `/leyes/[law]`, que es la página donde se midió, vuelva al `unstable_cache` plano; y lleva un
 * TRINQUETE sobre el resto del código: los ficheros que aún usan el patrón viejo solo pueden
 * DISMINUIR. Migrar uno baja el techo solo; añadir uno nuevo pone el test en rojo.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '../..')

function ficheros(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) ficheros(p, out)
    else if (/\.(ts|tsx)$/.test(e)) out.push(p)
  }
  return out
}

/**
 * Quita comentarios antes de mirar. Sin esto, el detector se dispara con la PROSA: el
 * comentario que explica por qué NO usar `unstable_cache` con `tags:['teoria']` contiene las
 * dos cadenas que busca, así que marcaba como infractor justo al fichero ya migrado. Un
 * guardarraíl que lee comentarios mide lo que se cuenta, no lo que se ejecuta.
 */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Usa `unstable_cache` con `tags:` (invalidable por tag) sin pasar por `versionedCache`. */
function usaTagSinVersionar(src: string): boolean {
  const code = sinComentarios(src)
  if (!code.includes('unstable_cache')) return false
  if (!/tags:\s*\[/.test(code)) return false
  // El propio wrapper usa unstable_cache con tags por dentro: es su implementación.
  return !code.includes('export function versionedCache')
}

describe('cachés invalidables por tag — cross-instancia (T-510)', () => {
  it('/leyes/[law] usa versionedCache, no unstable_cache plano', () => {
    const src = readFileSync(join(RAIZ, 'app/leyes/[law]/page.tsx'), 'utf8')
    expect(src).toContain('versionedCache')
    expect(usaTagSinVersionar(src)).toBe(false)
  })

  it('las dos cachés de esa página (secciones y artículos) están versionadas', () => {
    const src = readFileSync(join(RAIZ, 'app/leyes/[law]/page.tsx'), 'utf8')
    for (const clave of ['law-sections-ssr', 'law-articles-ssr']) {
      const i = src.indexOf(clave)
      expect(i).toBeGreaterThan(-1)
      // `versionedCache` aparece en la misma expresión que la clave
      expect(src.slice(Math.max(0, i - 220), i + 60)).toContain('versionedCache')
    }
  })

  it('el resto del código no AÑADE cachés por tag sin versionar (trinquete)', () => {
    // 8 ficheros el 03/08/2026. Solo puede bajar: migrar uno lo baja, añadir uno lo rompe.
    const TECHO = 8
    const pendientes = [...ficheros(join(RAIZ, 'app')), ...ficheros(join(RAIZ, 'lib'))]
      .filter((f) => usaTagSinVersionar(readFileSync(f, 'utf8')))
      .map((f) => f.replace(RAIZ + '/', ''))
    expect(pendientes.length).toBeLessThanOrEqual(TECHO)
  })
})
