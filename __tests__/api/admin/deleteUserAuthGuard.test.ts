/**
 * Guard de seguridad: /api/admin/delete-user DEBE exigir admin auth.
 *
 * El endpoint borra CUALQUIER cuenta por userId y es irreversible. No hay
 * middleware que proteja /api/admin/* (no existe middleware.ts), así que la
 * única barrera es el `requireAdmin` dentro del handler. Hallado 18/06/2026:
 * el endpoint era invocable SIN token (una llamada con solo Content-Type
 * borraba la cuenta). Este test impide que se vuelva a quitar el guard.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'app/api/admin/delete-user/route.ts'), 'utf8')

describe('/api/admin/delete-user — exige admin auth (anti-regresión)', () => {
  test('importa requireAdmin', () => {
    expect(src).toMatch(/import\s*\{[^}]*requireAdmin[^}]*\}\s*from\s*['"]@\/lib\/api\/shared\/auth['"]/)
  })

  test('llama requireAdmin y corta si !auth.ok ANTES de borrar nada', () => {
    const idxGuard = src.search(/const\s+auth\s*=\s*await\s+requireAdmin\(/)
    const idxDelete = src.search(/deleteUserData\(/)
    expect(idxGuard).toBeGreaterThan(-1)
    expect(idxDelete).toBeGreaterThan(-1)
    // el guard debe estar antes del borrado
    expect(idxGuard).toBeLessThan(idxDelete)
  })

  test('devuelve auth.response cuando no es admin', () => {
    expect(src).toMatch(/if\s*\(\s*!auth\.ok\s*\)\s*return\s+auth\.response/)
  })
})
