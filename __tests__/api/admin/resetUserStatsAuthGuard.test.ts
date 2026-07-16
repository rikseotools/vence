/**
 * Guard de seguridad: /api/admin/reset-user-stats DEBE exigir admin auth.
 *
 * El endpoint borra las métricas de CUALQUIER usuario por userId. No hay
 * middleware que proteja /api/admin/* (no existe middleware.ts), así que la
 * única barrera es el `requireAdmin` dentro del handler — misma clase de bug
 * que se halló en delete-user el 18/06/2026 (invocable sin token).
 *
 * Cubre además el audit trail: sin `reason` y sin registrar QUIÉN lo pidió,
 * esto sería un botón de destruir sin testigos.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/admin/reset-user-stats/route.ts'),
  'utf8'
)
const schemaSrc = readFileSync(
  join(process.cwd(), 'lib/api/admin-reset-user-stats/schemas.ts'),
  'utf8'
)

describe('/api/admin/reset-user-stats — exige admin auth (anti-regresión)', () => {
  test('importa requireAdmin', () => {
    expect(routeSrc).toMatch(
      /import\s*\{[^}]*requireAdmin[^}]*\}\s*from\s*['"]@\/lib\/api\/shared\/auth['"]/
    )
  })

  test('llama requireAdmin y corta si !auth.ok ANTES de resetear nada', () => {
    const idxGuard = routeSrc.search(/const\s+auth\s*=\s*await\s+requireAdmin\(/)
    const idxReset = routeSrc.search(/resetUserStats\(/)
    expect(idxGuard).toBeGreaterThan(-1)
    expect(idxReset).toBeGreaterThan(-1)
    expect(idxGuard).toBeLessThan(idxReset)
  })

  test('devuelve auth.response cuando no es admin', () => {
    expect(routeSrc).toMatch(/if\s*\(\s*!auth\.ok\s*\)\s*return\s+auth\.response/)
  })
})

describe('/api/admin/reset-user-stats — audit trail', () => {
  test('reason es obligatorio en el schema (no vacío)', () => {
    expect(schemaSrc).toMatch(/reason:\s*z\s*\.string\(\)[\s\S]*?\.min\(/)
  })

  test('el admin que lo pide se toma del token, NUNCA del body', () => {
    // requestedBy derivado de auth.user → un caller no puede firmar como otro.
    expect(routeSrc).toMatch(/requestedBy\s*=\s*auth\.user\.email/)
    expect(schemaSrc).not.toMatch(/requestedBy/)
  })

  test('emite evento de observabilidad awaited (no fire-and-forget)', () => {
    expect(routeSrc).toMatch(/await\s+emit\(/)
    expect(routeSrc).not.toMatch(/emitFireAndForget/)
    expect(routeSrc).toMatch(/eventType:\s*'user_stats_reset'/)
  })

  test('el handler va envuelto en withErrorLogging', () => {
    expect(routeSrc).toMatch(/export\s+const\s+POST\s*=\s*withErrorLogging\(/)
  })
})
