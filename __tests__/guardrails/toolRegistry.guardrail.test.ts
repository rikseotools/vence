// __tests__/guardrails/toolRegistry.guardrail.test.ts
//
// Guardarraíl ANTI-DUPLICADO de herramientas (T-130). Corre en CI, sin BD y sin red.
//
// El problema que ataca, medido el 26/07/2026 en una sola sesión: se escribió una herramienta para
// escribir `seguimiento_url` sin ver que ya había otras, y se apuntó como "pendiente de construir"
// un headless-fetcher que llevaba meses desplegado (`oposiciones.fetcher_type`, 67 filas). Con
// 2-10 sesiones en paralelo, "acuérdate de mirar si ya existe" no es un mecanismo. Esto sí.
//
// Mismo patrón que `runbookRegistry` (kind→guía + frase en CLAUDE.md), `content-sweep-parity`
// (CLI ↔ @Cron) y `backlogRegistry` (toda tarea con id): registro + test que se pone rojo.
//
// Lo que NO hace, a propósito: catalogar los cientos de scripts del repo. Solo mira una lista
// EXPLÍCITA de recursos sensibles (`RECURSOS_SENSIBLES`). Un registro que intenta abarcarlo todo
// se queda desactualizado en una semana y se aprende a ignorar.

import fs from 'fs'
import path from 'path'
import {
  RECURSOS_SENSIBLES,
  recursosEscritos,
  escribeRecurso,
  esDefinicionDeEsquema,
} from '../../lib/admin/toolWriters'
import { TOOL_REGISTRY, escritoresVivos } from '../../lib/admin/toolRegistry'

const REPO = path.resolve(__dirname, '../..')
const DIRS = ['scripts', 'lib', 'app', 'backend/src', 'db']
const EXT = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs'])

function* walk(dir: string): Generator<string> {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('_tmp')) continue
      yield* walk(p)
    } else if (EXT.has(path.extname(e.name))) {
      yield p
    }
  }
}

/** Escaneo único del repo: ruta relativa → recursos sensibles que escribe. */
const escritores = (() => {
  const out = new Map<string, string[]>()
  for (const dir of DIRS) {
    for (const f of walk(path.join(REPO, dir))) {
      const rel = path.relative(REPO, f)
      if (/\.spec\.|\.test\./.test(rel)) continue
      const codigo = fs.readFileSync(f, 'utf8')
      if (esDefinicionDeEsquema(codigo)) continue
      const rec = recursosEscritos(codigo)
      if (rec.length) out.set(rel, rec)
    }
  }
  return out
})()

const escritoresDe = (recurso: string): string[] =>
  [...escritores.entries()].filter(([, r]) => r.includes(recurso)).map(([f]) => f).sort()

describe('toolRegistry — el registro describe la realidad', () => {
  it('toda herramienta registrada apunta a un fichero que existe', () => {
    const rotas = Object.entries(TOOL_REGISTRY)
      .filter(([, h]) => !fs.existsSync(path.join(REPO, h.ruta)))
      .map(([k, h]) => `${k} → ${h.ruta}`)
    expect(rotas).toEqual([])
  })

  it('todo runbook referenciado existe (si no, la guía es humo)', () => {
    const rotos = Object.entries(TOOL_REGISTRY)
      .filter(([, h]) => h.runbook && !fs.existsSync(path.join(REPO, h.runbook as string)))
      .map(([k, h]) => `${k} → ${h.runbook}`)
    expect(rotos).toEqual([])
  })

  it('una herramienta deprecada dice por cuál se sustituye', () => {
    const huerfanas = Object.entries(TOOL_REGISTRY)
      .filter(([, h]) => h.estado === 'deprecado' && !h.reemplazadaPor)
      .map(([k]) => k)
    expect(huerfanas).toEqual([])
    const apuntanANada = Object.entries(TOOL_REGISTRY)
      .filter(([, h]) => h.reemplazadaPor && !TOOL_REGISTRY[h.reemplazadaPor])
      .map(([k, h]) => `${k} → ${h.reemplazadaPor}`)
    expect(apuntanANada).toEqual([])
  })

  it('lo que el registro dice que escribe, lo escribe de verdad', () => {
    // Evita la entrada optimista: alguien registra "escribe seguimiento_url" y el script no la toca.
    const mentiras: string[] = []
    for (const [k, h] of Object.entries(TOOL_REGISTRY)) {
      if (!h.escribe?.length) continue
      const abs = path.join(REPO, h.ruta)
      if (!fs.existsSync(abs)) continue
      const codigo = fs.readFileSync(abs, 'utf8')
      for (const col of h.escribe) {
        const rec = RECURSOS_SENSIBLES.find((r) => r.columna === col)
        if (rec && !escribeRecurso(codigo, rec)) mentiras.push(`${k} dice escribir ${col} y no lo hace`)
      }
    }
    expect(mentiras).toEqual([])
  })
})

describe('toolRegistry — recursos con guardarraíl compartido', () => {
  const compartidos = RECURSOS_SENSIBLES.filter((r) => r.regla === 'guardarrail_compartido')

  it.each(compartidos.map((r) => [r.columna, r] as const))(
    'todo escritor de %s está registrado (nadie abre una puerta nueva en silencio)',
    (columna, recurso) => {
      const enCodigo = escritoresDe(columna)
      const registrados = new Set(Object.values(TOOL_REGISTRY).map((h) => h.ruta))
      const sinRegistrar = enCodigo.filter((f) => !registrados.has(f))
      if (sinRegistrar.length) {
        throw new Error(
          `Escritores de \`${columna}\` SIN registrar en lib/admin/toolRegistry.ts:\n` +
            sinRegistrar.map((f) => `  · ${f}`).join('\n') +
            `\n\n¿Por qué importa? ${recurso.porQue}\n` +
            `Antes de añadir una herramienta nueva: npm run tools:buscar ${columna}\n` +
            `Si el script es de una construcción puntual, regístralo como estado 'historico'.`,
        )
      }
      expect(sinRegistrar).toEqual([])
    },
  )

  it.each(compartidos.map((r) => [r.columna, r] as const))(
    'toda herramienta VIVA que escribe %s pasa por el guardarraíl compartido',
    (columna, recurso) => {
      const vivos = escritoresVivos(columna)
      const sinGuardarrail = vivos.filter((k) => {
        const abs = path.join(REPO, TOOL_REGISTRY[k].ruta)
        if (!fs.existsSync(abs)) return false
        // Se busca el BASENAME, no la ruta completa: un `require(path.join(__dirname, '..',
        // 'lib', 'convocatoria', 'seguimientoVigilable.cjs'))` es una referencia perfectamente
        // válida y no contiene la cadena 'lib/convocatoria/...'. Comprobar la ruta literal daría
        // un falso positivo justo contra la forma que usan los scripts .cjs del repo.
        const modulo = path.basename(recurso.moduloGuardarrail as string)
        return !fs.readFileSync(abs, 'utf8').includes(modulo)
      })
      if (sinGuardarrail.length) {
        throw new Error(
          `Estas herramientas vivas escriben \`${columna}\` SIN pasar por ` +
            `\`${recurso.moduloGuardarrail}\`: ${sinGuardarrail.join(', ')}.\n` +
            'Dos puertas al mismo dato con criterios distintos = el guardarraíl de la buena no ' +
            'protege nada, porque basta entrar por la otra.',
        )
      }
      expect(sinGuardarrail).toEqual([])
    },
  )
})

describe('toolRegistry — recursos con trinquete (no crecer)', () => {
  const trinquetes = RECURSOS_SENSIBLES.filter((r) => r.regla === 'trinquete')

  it.each(trinquetes.map((r) => [r.columna, r] as const))(
    'el número de escritores de %s no crece',
    (columna, recurso) => {
      const n = escritoresDe(columna).length
      if (n > (recurso.techo as number)) {
        throw new Error(
          `\`${columna}\` tenía ${recurso.techo} escritores y ahora hay ${n}.\n` +
            `Su protección real vive en: ${recurso.guardarrailPropio}\n` +
            'Usa esa vía. Si el escritor nuevo es legítimo (script de construcción puntual), sube ' +
            'el `techo` en lib/admin/toolWriters.ts A CONCIENCIA y di por qué en el commit.',
        )
      }
      expect(n).toBeLessThanOrEqual(recurso.techo as number)
    },
  )

  it('los trinquetes declaran dónde vive su protección real (anti-silo)', () => {
    const sinApuntar = trinquetes.filter((r) => !r.guardarrailPropio).map((r) => r.columna)
    expect(sinApuntar).toEqual([])
  })
})

describe('toolRegistry — descubribilidad (que no haya que saberse el fichero)', () => {
  it('CLAUDE.md menciona el registro y el comando de búsqueda', () => {
    const md = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8')
    expect(md).toContain('toolRegistry')
    expect(md).toContain('tools:buscar')
  })

  it('el comando tools:buscar existe en package.json y apunta a un script real', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
    const cmd = pkg.scripts?.['tools:buscar']
    expect(cmd).toBeTruthy()
    const ruta = String(cmd).match(/scripts\/[\w./-]+/)?.[0]
    expect(ruta).toBeTruthy()
    expect(fs.existsSync(path.join(REPO, ruta as string))).toBe(true)
  })
})
