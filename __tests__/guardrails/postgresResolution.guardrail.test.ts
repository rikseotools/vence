/**
 * GUARDARRAÍL — ningún script resuelve `postgres` contra `backend/node_modules`.
 *
 * POR QUÉ (T-131, 26/07/2026): 45 scripts hacían
 *   require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
 * y nueve de ellos llevaban cableada la ruta ABSOLUTA de una máquina concreta
 * (`/home/manuel/Documentos/github/vence/...`). Ese directorio NO existe en un
 * worktree recién creado ni en el CI, que no instala las dependencias del backend:
 *
 *   · en CI tumbó la suite unit entera a través del test que importa
 *     `auditar-batch-input` → `main` en rojo → y como el gate de los scripts de
 *     deploy exige unit en verde, **no se podía desplegar nada**;
 *   · en local reventaba el pipeline de generación en cualquier worktree limpio.
 *
 * `postgres` está en las dependencies del paquete raíz, así que `require('postgres')`
 * resuelve desde cualquier script del repo. Se admite el patrón defensivo
 * try { require('postgres') } catch { …backend… } porque intenta la raíz primero.
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const DIRS = ['scripts', 'lib', 'verify-live-scripts']

/** Ficheros de código bajo los directorios vigilados. */
function ficheros(dir: string, out: string[] = []): string[] {
  let entradas
  try {
    entradas = readdirSync(join(RAIZ, dir), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entradas) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      ficheros(rel, out)
    } else if (/\.(cjs|js|ts)$/.test(e.name)) {
      out.push(rel)
    }
  }
  return out
}

/** Quita comentarios de línea: varios scripts DOCUMENTAN el patrón a propósito. */
function sinComentarios(src: string): string {
  return src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')
}

// require(...) que acaba en backend/node_modules/postgres, en cualquiera de sus formas.
const FRAGIL =
  /require\([^)]*backend[^)]*node_modules[^)]*postgres[^)]*\)|require\(\s*'[^']*backend\/node_modules\/postgres'\s*\)/

describe('GUARDARRAÍL — resolución de `postgres` en scripts', () => {
  const infractores: string[] = []

  for (const rel of DIRS.flatMap((d) => ficheros(d))) {
    let src: string
    try {
      src = readFileSync(join(RAIZ, rel), 'utf8')
    } catch {
      continue
    }
    const codigo = sinComentarios(src)
    if (!FRAGIL.test(codigo)) continue
    // Patrón defensivo admitido: intenta la raíz ANTES de mirar el backend.
    if (/try\s*\{\s*return require\('postgres'\)/.test(codigo)) continue
    infractores.push(rel)
  }

  it('ningún script resuelve `postgres` contra backend/node_modules', () => {
    expect(infractores).toEqual([])
  })

  it('ninguno cablea una ruta absoluta de una máquina concreta', () => {
    const absolutos = DIRS.flatMap((d) => ficheros(d)).filter((rel) => {
      try {
        return /require\(\s*'\/(home|Users)\//.test(sinComentarios(readFileSync(join(RAIZ, rel), 'utf8')))
      } catch {
        return false
      }
    })
    expect(absolutos).toEqual([])
  })
})
