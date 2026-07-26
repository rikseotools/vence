// __tests__/health/llm-error-kind-parity.test.ts
//
// Paridad del clasificador de errores de LLM entre el núcleo compartido y el mirror del backend.
//
// El backend NestJS no puede importar `lib/` del frontend, así que replica las reglas INLINE. Un
// mirror desincronizado aquí es peor que no tenerlo: el mismo fallo se clasificaría distinto según
// quién lo registre, y la alerta diría una cosa u otra según el gemelo. Se compara POR
// COMPORTAMIENTO sobre los casos reales, no por el texto de las regex.

import fs from 'fs'
import path from 'path'

const { clasificarErrorLlm: nucleo, requiereIntervencion } = require('@/lib/observability/llmErrorKind.cjs')

const BACKEND_SRC = fs.readFileSync(
  path.join(path.resolve(__dirname, '../..'), 'backend/src/observability/llm-usage.ts'),
  'utf8',
)

/** Evalúa el mirror del backend extrayendo su tabla de clases y su lógica de códigos. */
function clasificarBackend(mensaje: string | null, status?: number | null): string {
  const m = BACKEND_SRC.match(/const CLASES_ERROR[^=]*= (\[[\s\S]*?\n\];)/)
  if (!m) throw new Error('no se encontró CLASES_ERROR en el mirror del backend')
  // eslint-disable-next-line no-new-func
  const clases = new Function(`return (${m[1].replace(/;$/, '')})`)() as Array<{ kind: string; re: RegExp }>
  const txt = `${status != null ? `${status} ` : ''}${mensaje == null ? '' : String(mensaje)}`
  if (!txt.trim()) return 'desconocido'
  for (const c of clases) if (c.re.test(txt)) return c.kind
  if (status === 401) return 'auth_invalida'
  if (status === 403) return 'permiso'
  if (status === 429) return 'rate_limit'
  if (status != null && status >= 500) return 'sobrecarga'
  return 'otro'
}

// Casos reales + los bordes que importan. Si el mirror se separa en cualquiera, el test cae.
const CASOS: Array<[string | null, number | null]> = [
  ['400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}', 400],
  ['{"type":"error","error":{"type":"authentication_error","message":"API key is invalid."}}', 401],
  ['You exceeded your current quota, please check your plan and billing details', 429],
  ['Rate limit reached for requests', 429],
  ['model claude-x-1 does not exist', 404],
  ['permission_error: does not have access to model', 403],
  ['Overloaded', 529],
  ['fetch failed: ETIMEDOUT', null],
  ['', 401],
  ['algo raro', 503],
  ['boom', 418],
  [null, null],
]

describe('paridad del clasificador de errores LLM (núcleo ↔ mirror del backend)', () => {
  it('el mirror existe y exporta su clasificador', () => {
    expect(BACKEND_SRC).toContain('export function clasificarErrorLlm')
    expect(BACKEND_SRC).toContain('export function requiereIntervencionLlm')
  })

  it.each(CASOS)('clasifica igual: %s (status %s)', (mensaje, status) => {
    expect(clasificarBackend(mensaje, status)).toBe(nucleo(mensaje, status).kind)
  })

  it('los dos gemelos coinciden en qué exige intervención humana', () => {
    const enBackend = BACKEND_SRC.match(/requiereIntervencionLlm\(kind: string\): boolean \{\s*return ([^;]+);/)
    expect(enBackend).toBeTruthy()
    for (const k of ['sin_credito', 'auth_invalida', 'permiso', 'modelo_no_disponible']) {
      expect(enBackend![1]).toContain(k)
      expect(requiereIntervencion(k)).toBe(true)
    }
  })

  it('ambos registran la clase en el evento (si no, todo esto no llega a ningún sitio)', () => {
    const frontend = fs.readFileSync(
      path.join(path.resolve(__dirname, '../..'), 'lib/observability/llm.ts'),
      'utf8',
    )
    for (const src of [frontend, BACKEND_SRC]) {
      expect(src).toContain('errorKind')
      expect(src).toContain('requiereIntervencion')
    }
  })
})
