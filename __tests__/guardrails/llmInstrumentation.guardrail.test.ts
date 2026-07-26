// __tests__/guardrails/llmInstrumentation.guardrail.test.ts
//
// Guardarraíl de COBERTURA de la observabilidad de LLM (26/07/2026). CI, sin red ni BD.
//
// El núcleo `lib/observability/llm.ts` instrumenta los clientes compartidos, pero solo pasa por
// ahí quien los usa: medido al montarlo, **15 de 27 call-sites hablaban con el proveedor en
// crudo**, así que más de la mitad del gasto no aparecía en ningún sitio y los ~31,7 USD/30 días
// que enseñaban los eventos eran un suelo, no el total.
//
// Este test convierte eso en un contrato: todo call-site registrado, los crudos con motivo, y un
// trinquete para que el número no crezca. Mismo patrón que `toolRegistry.guardrail`.

import fs from 'fs'
import path from 'path'
import { LLM_CALL_SITES, crudos, TECHO_CRUDOS } from '../../lib/observability/llmCallSites'

const REPO = path.resolve(__dirname, '../..')
const DIRS = ['lib', 'app', 'backend/src', 'scripts']
const EXT = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs'])

// Habla con un proveedor: SDK propio o HTTP directo a su API.
const HABLA_CON_PROVEEDOR = /new Anthropic\(|new OpenAI\(|api\.anthropic\.com|api\.openai\.com|openrouter\.ai/
// Pasa por el núcleo instrumentado (cliente compartido o registro explícito).
const INSTRUMENTADO = /getAnthropic|getOpenAI|instrumentAnthropic|instrumentOpenAI|recordLlmCall|llmFetch/

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
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '_archive') continue
      yield* walk(p)
    } else if (EXT.has(path.extname(e.name))) {
      yield p
    }
  }
}

/** Escaneo único: ruta relativa → ¿pasa por el núcleo? */
const encontrados = (() => {
  const out = new Map<string, boolean>()
  for (const dir of DIRS) {
    for (const f of walk(path.join(REPO, dir))) {
      const rel = path.relative(REPO, f)
      if (/\.test\.|\.spec\./.test(rel)) continue
      // El propio registro NOMBRA los patrones para documentarlos (`new OpenAI()`, la URL de la
      // API…) y se detectaba a sí mismo. Se excluye por ruta y no por heurística de contenido:
      // es un fichero concreto y conocido, y una heurística aquí abriría un hueco de verdad.
      if (rel === 'lib/observability/llmCallSites.ts') continue
      const codigo = fs.readFileSync(f, 'utf8')
      if (!HABLA_CON_PROVEEDOR.test(codigo)) continue
      out.set(rel, INSTRUMENTADO.test(codigo))
    }
  }
  return out
})()

describe('observabilidad LLM — el registro describe la realidad', () => {
  it('cada entrada del registro apunta a un fichero que existe', () => {
    const rotas = LLM_CALL_SITES.filter((s) => !fs.existsSync(path.join(REPO, s.ruta))).map((s) => s.ruta)
    expect(rotas).toEqual([])
  })

  it('el escaneo encuentra call-sites (sanity: si el patrón deja de casar, el test mentiría)', () => {
    expect(encontrados.size).toBeGreaterThanOrEqual(20)
  })

  it('TODO call-site que habla con un proveedor está registrado', () => {
    const registradas = new Set(LLM_CALL_SITES.map((s) => s.ruta))
    const sinRegistrar = [...encontrados.keys()].filter((f) => !registradas.has(f)).sort()
    if (sinRegistrar.length) {
      throw new Error(
        'Call-sites de LLM SIN registrar en lib/observability/llmCallSites.ts:\n' +
          sinRegistrar.map((f) => `  · ${f}`).join('\n') +
          '\n\nSi habla con un proveedor, su gasto tiene que ser visible: pásalo por el cliente ' +
          'compartido (getAnthropic/getOpenAI) o regístralo como `crudo` con su motivo.',
      )
    }
    expect(sinRegistrar).toEqual([])
  })

  it('lo que el registro dice de cada call-site coincide con el código', () => {
    // Evita la entrada optimista: alguien marca "instrumentado" y el fichero sigue en crudo.
    const mentiras: string[] = []
    for (const s of LLM_CALL_SITES) {
      const real = encontrados.get(s.ruta)
      if (real === undefined) continue // ya lo cubre el test de rutas rotas
      const declarado = s.estado === 'instrumentado'
      if (real !== declarado) {
        mentiras.push(`${s.ruta}: el registro dice "${s.estado}" y el código dice "${real ? 'instrumentado' : 'crudo'}"`)
      }
    }
    expect(mentiras).toEqual([])
  })
})

describe('observabilidad LLM — el gasto invisible no puede crecer', () => {
  it('todo call-site crudo declara POR QUÉ lo es y qué haría falta', () => {
    const mudos = crudos()
      .filter((s) => !s.motivo || s.motivo.trim().length < 30)
      .map((s) => s.ruta)
    expect(mudos).toEqual([])
  })

  it('cada call-site declara su feature (sin ella no se puede atribuir el gasto)', () => {
    const sinFeature = LLM_CALL_SITES.filter((s) => !s.feature || !s.feature.trim()).map((s) => s.ruta)
    expect(sinFeature).toEqual([])
  })

  it('TRINQUETE: el número de call-sites crudos no crece', () => {
    // Bajar sí, subir no. Si esto se pone rojo, alguien ha abierto una puerta nueva al proveedor
    // sin observabilidad — y entonces el gasto vuelve a ser un número que nadie puede auditar.
    expect(crudos().length).toBeLessThanOrEqual(TECHO_CRUDOS)
  })

  it('el trinquete está declarado con el número medido, no a ojo', () => {
    expect(TECHO_CRUDOS).toBeGreaterThan(0)
    expect(TECHO_CRUDOS).toBeLessThanOrEqual(LLM_CALL_SITES.length)
  })
})
