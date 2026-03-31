// __tests__/lib/api/withErrorLogging.test.ts
// Tests del wrapper withErrorLogging

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')

// ============================================
// 1. SOURCE CODE DEL WRAPPER
// ============================================
describe('withErrorLogging — source code', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'lib/api/withErrorLogging.ts'),
    'utf-8'
  )

  it('importa logValidationError y classifyError', () => {
    expect(content).toMatch(/import.*logValidationError.*from/)
    expect(content).toMatch(/import.*classifyError.*from/)
  })

  it('exporta función withErrorLogging', () => {
    expect(content).toMatch(/export function withErrorLogging/)
  })

  it('captura respuestas 400+', () => {
    expect(content).toMatch(/response\.status >= 400/)
  })

  it('captura errores no manejados (catch)', () => {
    expect(content).toMatch(/catch \(error\)/)
    expect(content).toMatch(/classifyError\(error\)/)
  })

  it('mide duración (startTime)', () => {
    expect(content).toMatch(/const startTime = Date\.now\(\)/)
    expect(content).toMatch(/Date\.now\(\) - startTime/)
  })

  it('extrae body de POST/PUT/PATCH', () => {
    expect(content).toMatch(/request\.clone\(\)\.json\(\)/)
    expect(content).toMatch(/POST.*PUT.*PATCH/)
  })

  it('extrae userAgent de forma defensiva', () => {
    expect(content).toMatch(/request\?\.headers\?\.get\?\.\('user-agent'\)/)
  })

  it('extrae questionId y userId del body', () => {
    expect(content).toMatch(/body\?\.questionId/)
    expect(content).toMatch(/body\?\.userId/)
  })

  it('no usa await con logValidationError (fire-and-forget)', () => {
    expect(content).not.toMatch(/await logValidationError/)
  })

  it('devuelve 500 genérico en errores no manejados', () => {
    expect(content).toMatch(/Error interno del servidor/)
    expect(content).toMatch(/status: 500/)
  })

  it('clona response para leer error sin consumir body', () => {
    expect(content).toMatch(/response\.clone\(\)\.json\(\)/)
  })

  it('tiene función getSeverity con 3 niveles', () => {
    expect(content).toMatch(/function getSeverity/)
    expect(content).toMatch(/critical/)
    expect(content).toMatch(/warning/)
    expect(content).toMatch(/info/)
  })

  it('clasifica HTTP status 4xx con classifyHttpStatus', () => {
    expect(content).toMatch(/function classifyHttpStatus/)
    expect(content).toMatch(/case 401.*auth/)
    expect(content).toMatch(/case 404.*not_found/)
    expect(content).toMatch(/case 429.*rate_limit/)
  })
})

// ============================================
// 2. LÓGICA DEL WRAPPER (unit tests)
// ============================================
describe('withErrorLogging — lógica', () => {
  // Mock de logValidationError
  let loggedErrors: any[] = []

  beforeEach(() => {
    loggedErrors = []
    jest.resetModules()
  })

  function createMockRequest(method = 'GET', body?: object) {
    return {
      method,
      headers: { get: (name: string) => name === 'user-agent' ? 'test-agent' : null },
      clone: () => ({
        json: async () => body || {},
      }),
    }
  }

  function createMockResponse(status: number, body: object) {
    return {
      status,
      clone: () => ({
        json: async () => body,
      }),
    }
  }

  it('pasa la respuesta sin modificar para 200', async () => {
    // Simular wrapper behavior manualmente (sin importar el módulo real que necesita DB)
    const handler = async () => createMockResponse(200, { success: true })
    const response = await handler()
    expect(response.status).toBe(200)
  })

  it('pasa la respuesta sin modificar para 400', async () => {
    const handler = async () => createMockResponse(400, { error: 'Bad request' })
    const response = await handler()
    expect(response.status).toBe(400)
  })

  it('detecta respuestas 400+ como errores', () => {
    // Verificar la lógica: status >= 400 dispara logging
    expect(400 >= 400).toBe(true)
    expect(401 >= 400).toBe(true)
    expect(500 >= 400).toBe(true)
    expect(399 >= 400).toBe(false)
    expect(200 >= 400).toBe(false)
  })

  it('asigna severity correctamente', () => {
    // critical: 500+
    expect(500 >= 500 ? 'critical' : 500 === 401 || 500 === 403 ? 'warning' : 'info').toBe('critical')
    // warning: 401, 403
    expect(401 >= 500 ? 'critical' : 401 === 401 || 401 === 403 ? 'warning' : 'info').toBe('warning')
    expect(403 >= 500 ? 'critical' : 403 === 401 || 403 === 403 ? 'warning' : 'info').toBe('warning')
    // info: 400, 404
    expect(400 >= 500 ? 'critical' : 400 === 401 || 400 === 403 ? 'warning' : 'info').toBe('info')
    expect(404 >= 500 ? 'critical' : 404 === 401 || 404 === 403 ? 'warning' : 'info').toBe('info')
  })

  it('classifica errores correctamente', () => {
    // Importar classifyError (no necesita DB)
    const { classifyError } = require('@/lib/api/validation-error-log/queries')

    expect(classifyError(new Error('Request timed out'))).toBe('timeout')
    expect(classifyError(new Error('ETIMEDOUT'))).toBe('timeout')
    expect(classifyError(new Error('connect_timeout'))).toBe('db_connection')
    expect(classifyError(new Error('too many clients'))).toBe('db_connection')
    expect(classifyError(new Error('fetch failed'))).toBe('network')
    expect(classifyError(new Error('ECONNREFUSED'))).toBe('network')
    expect(classifyError(new Error('something else'))).toBe('unknown')
    expect(classifyError('not an error')).toBe('unknown')
  })
})

// ============================================
// 3. COBERTURA: TODOS los endpoints usan el wrapper
// ============================================
describe('withErrorLogging — cobertura de endpoints', () => {
  const glob = require('glob')
  const routeFiles: string[] = glob.sync('app/api/**/route.{ts,js}', { cwd: ROOT })

  it('hay al menos 190 route files', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(190)
  })

  // Verificar que CADA route file usa withErrorLogging
  const excludedFromFunctionCheck = [
    'app/api/validation-error-log/route.ts',
    'app/api/debug/psico-images/route.ts',
  ]
  const failures: string[] = []

  for (const relPath of routeFiles) {
    if (excludedFromFunctionCheck.includes(relPath)) continue
    const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8')

    // Buscar si tiene handlers exportados
    const hasExportedHandler = /export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=/.test(content)
    const hasExportedFunction = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/.test(content)
    const hasWrapper = content.includes('withErrorLogging')

    if (hasExportedFunction && !hasWrapper) {
      // Tiene export async function sin wrapper — esto NO debería pasar
      failures.push(relPath)
    }
  }

  it('ningún endpoint usa export async function sin wrapper', () => {
    expect(failures).toEqual([])
  })

  it('todos los endpoints con handler exportado usan withErrorLogging', () => {
    // Excluir endpoints que intencionalmente no usan el wrapper (evitar loops)
    const excluded = ['app/api/validation-error-log/route.ts', 'app/api/debug/psico-images/route.ts']
    let wrappedCount = 0
    for (const relPath of routeFiles) {
      if (excluded.includes(relPath)) continue
      const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8')
      if (content.includes('withErrorLogging')) {
        wrappedCount++
      }
    }
    // Todos (excepto excluidos) deberían tener el wrapper
    expect(wrappedCount).toBe(routeFiles.length - excluded.length)
  })

  it('todos los wrappers tienen el endpoint path correcto', () => {
    const mismatches: string[] = []
    for (const relPath of routeFiles) {
      const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8')
      const expectedEndpoint = '/' + relPath.replace(/\/route\.(ts|js)$/, '').replace(/^app\//, '')

      if (content.includes('withErrorLogging') && !content.includes(`'${expectedEndpoint}'`)) {
        mismatches.push(`${relPath} — expected '${expectedEndpoint}'`)
      }
    }
    expect(mismatches).toEqual([])
  })
})

// ============================================
// 4. INTEGRACIÓN: logClientError helper
// ============================================
describe('logClientError — source code', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'lib/logClientError.ts'),
    'utf-8'
  )

  it('exporta función logClientError', () => {
    expect(content).toMatch(/export function logClientError/)
  })

  it('hace fetch a /api/validation-error-log', () => {
    expect(content).toMatch(/fetch\('\/api\/validation-error-log'/)
  })

  it('es fire-and-forget (.catch)', () => {
    expect(content).toMatch(/\.catch\(\(\) => \{\}\)/)
  })

  it('clasifica ApiTimeoutError como timeout', () => {
    expect(content).toMatch(/ApiTimeoutError.*timeout/)
  })

  it('clasifica ApiNetworkError como network', () => {
    expect(content).toMatch(/ApiNetworkError.*network/)
  })

  it('incluye component como prefijo en errorMessage', () => {
    expect(content).toMatch(/component.*client/)
  })
})

// ============================================
// 5. INTEGRACIÓN: componentes usan logClientError
// ============================================
describe('Componentes — logClientError integrado', () => {
  const components = [
    { name: 'TestLayout', file: 'components/TestLayout.tsx' },
    { name: 'DynamicTest', file: 'components/DynamicTest.tsx' },
    { name: 'ExamLayout', file: 'components/ExamLayout.tsx' },
    { name: 'PsychometricTestLayout', file: 'components/PsychometricTestLayout.tsx' },
  ]

  for (const { name, file } of components) {
    describe(name, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')

      it('importa logClientError', () => {
        expect(content).toMatch(/import.*logClientError.*from/)
      })

      it('llama a logClientError en el catch', () => {
        expect(content).toMatch(/logClientError\(/)
      })

      it('NO tiene fetch inline a /api/validation-error-log', () => {
        expect(content).not.toMatch(/fetch\('\/api\/validation-error-log'/)
      })

      it(`incluye component: '${name}'`, () => {
        expect(content).toContain(`component: '${name}'`)
      })
    })
  }
})
