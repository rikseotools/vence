// Guardarraíl (fix UX 12/07/2026 — Alfonso): en /test/por-leyes, AuthContext NO
// bloquea `loading` en el fetch de perfil (tarda 6.8s+, background) → `authLoading`
// pasa a false con `userProfile` aún null. Si cargábamos leyes ya, iban SIN acotar a
// su oposición y al llegar el perfil re-scope → parpadeo de lista incoherente. Fix:
// gate `profileSettled` (espera al perfil, con techo de 4s). Este test verifica POR
// FUENTE que el gate sigue puesto y — crítico — que tiene TECHO (no cuelga sin perfil).
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(
  join(__dirname, '..', '..', 'app', 'test', 'por-leyes', 'page.tsx'),
  'utf-8',
)

describe('/test/por-leyes — espera al perfil antes de cargar leyes (anti flash sin acotar)', () => {
  it('existe el gate profileSettled', () => {
    expect(src).toMatch(/profileSettled/)
    expect(src).toMatch(/setProfileSettled/)
  })

  it('la carga de leyes espera al perfil (loadLaws gateado por profileSettled)', () => {
    expect(src).toMatch(/if\s*\(\s*authLoading\s*\|\|\s*!profileSettled\s*\)\s*return/)
  })

  it('el spinner cubre la espera del perfil', () => {
    expect(src).toMatch(/loading\s*\|\|\s*authLoading\s*\|\|\s*!profileSettled/)
  })

  it('el gate tiene TECHO (setTimeout) para no colgar a un usuario sin perfil', () => {
    // debe resolver profileSettled=true tras un timeout aunque el perfil no llegue
    expect(src).toMatch(/setTimeout\([\s\S]*?setProfileSettled\(true\)[\s\S]*?\d{3,}\s*\)/)
  })

  it('profileSettled está en las deps del efecto de carga de leyes', () => {
    expect(src).toMatch(/\[authLoading,\s*profileSettled/)
  })
})
