// __tests__/api/health/dbReady.test.ts
// Tests del endpoint /api/health/db-ready (readiness probe ECS).

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')

describe('/api/health/db-ready — contrato del endpoint', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'app/api/health/db-ready/route.ts'),
    'utf-8',
  )

  it('exporta GET handler', () => {
    expect(content).toMatch(/export const GET\s*=/)
  })

  it('devuelve 503 explícito si BD no responde (no 200 "degraded")', () => {
    // CRÍTICO: ALB target group depende del status code para marcar healthy/unhealthy.
    // Si devolviera 200 cuando la BD falla, el ALB seguiría mandando tráfico al
    // container con pool muerto. Eso anularía todo el propósito del endpoint.
    expect(content).toMatch(/status:\s*503/)
  })

  it('ejecuta SELECT 1 contra getDb() (no contra getPoolerDb directo)', () => {
    // El readiness probe debe verificar el pool que realmente se usará para
    // tráfico real. getDb() es el wrapper que decide entre Supavisor y self-hosted
    // según USE_SELF_HOSTED_POOLER.
    // Aceptamos tanto import estático como dynamic import (necesario aquí para
    // no bloquear el cold-start del módulo si la BD está fría).
    expect(content).toMatch(/(import\s*\{[^}]*getDb[^}]*\}\s*from\s*['"]@\/db\/client['"]|await\s+import\(['"]@\/db\/client['"]\))/)
    expect(content).toMatch(/getDb\(\)/)
    expect(content).toMatch(/SELECT 1/)
  })

  it('aplica timeout estricto de 2s (READINESS_TIMEOUT_MS)', () => {
    // 2s es la frontera entre "pool listo" y "cold start". Subir esto invalida
    // el propósito del readiness probe.
    expect(content).toMatch(/READINESS_TIMEOUT_MS\s*=\s*2000/)
  })

  it('incluye Retry-After header en 503 (HTTP correcto)', () => {
    expect(content).toMatch(/'Retry-After'/)
  })

  it('reporta qué pool se usa en la respuesta (self_hosted vs supavisor)', () => {
    // Útil para diagnóstico operacional: en /api/health/db-ready vemos en
    // tiempo real qué pool está activo en el container.
    expect(content).toMatch(/USE_SELF_HOSTED_POOLER/)
    expect(content).toMatch(/self_hosted|supavisor/)
  })

  it('no cachea la respuesta (Cache-Control: no-store)', () => {
    expect(content).toMatch(/Cache-Control.*no-store/)
  })

  it('usa withErrorLogging para que fallos se registren en validation_error_logs', () => {
    expect(content).toMatch(/withErrorLogging\(['"]\/api\/health\/db-ready['"]/)
  })
})

describe('db/client.ts — pool self-hosted robusto', () => {
  const content = fs.readFileSync(path.join(ROOT, 'db/client.ts'), 'utf-8')

  it('createPoolerDbClient usa max:8 (no max:1) para multiplexing PgBouncer', () => {
    // PgBouncer transaction mode multiplexa: cada query libera el slot upstream
    // al terminar. max:8 por instancia × 2 instancias = 16 conns lógicas, sin
    // saturar Postgres porque el pool upstream del PgBouncer es ~30.
    // Buscamos el bloque acotado entre `function createPoolerDbClient` y el
    // siguiente `return drizzle(conn` para evitar matchear max:N de otras funciones.
    const block = content.match(
      /function createPoolerDbClient[\s\S]*?return drizzle\(conn/,
    )
    expect(block).not.toBeNull()
    const maxMatch = block![0].match(/max:\s*(\d+)/)
    expect(maxMatch).not.toBeNull()
    expect(Number(maxMatch![1])).toBe(8)
  })

  it('createPoolerDbClient hace warmup robusto (3 conns en paralelo)', () => {
    // Sin warmup robusto, el pool arranca con 0 conexiones y la primera request
    // real espera el handshake TCP/TLS — la causa raíz de Hipótesis D.
    expect(content).toMatch(/Promise\.allSettled\(\[\s*conn`SELECT 1`,\s*conn`SELECT 1`,\s*conn`SELECT 1`/)
  })

  it('createPoolerDbClient loggea fallos de warmup (no fire-and-forget silencioso)', () => {
    // El warmup silencioso del pasado escondió incidentes. Ahora cualquier
    // fallo de warmup queda visible en CloudWatch.
    expect(content).toMatch(/console\.warn\(\s*[`'"]\[poolerDb\] warmup parcial/)
  })

  it('createDbClient (path principal) sigue con max:1 hasta migración completa', () => {
    // Cambiar max:1 → max:8 también aquí sería arriesgado SIN haber probado primero
    // en el pool self-hosted. La Fase 1 es activar self-hosted; cambiar primary
    // queda para Fase 1.5 o posterior cuando self-hosted esté probado en prod.
    // Buscamos el bloque acotado para no matchear max:N de otras funciones.
    const block = content.match(
      /function createDbClient[\s\S]*?return drizzle\(conn/,
    )
    expect(block).not.toBeNull()
    const maxMatch = block![0].match(/max:\s*(\d+)/)
    expect(maxMatch).not.toBeNull()
    expect(Number(maxMatch![1])).toBe(1)
  })

  it('createPoolerDbClient SIGUE con prepare:false (compat PgBouncer transaction mode)', () => {
    // PgBouncer en transaction mode NO soporta prepared statements (cada query
    // puede ir a una conexión upstream distinta). Cambiar esto rompe en prod.
    const block = content.match(
      /function createPoolerDbClient[\s\S]*?return drizzle\(conn/,
    )
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/prepare:\s*false/)
  })
})
