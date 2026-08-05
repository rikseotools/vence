/**
 * Guardarraíl (T-397): el guardado GENÉRICO de /perfil (`saveProfile`, PUT /api/profile) NO debe
 * mandar `targetOposicion`/`targetOposicionData`.
 *
 * ── EL BUG QUE ESTO EVITA ────────────────────────────────────────────────────────────────────
 *
 * `target_oposicion` ya tiene su ÚNICO punto de escritura dedicado: `PUT /api/profile/target`
 * (usado por `promoteToTarget` y `OposicionChangeModal`), que valida el id contra el catálogo/
 * personalizadas y RECHAZA vacíos (ver `app/api/profile/target/route.ts`).
 *
 * `saveProfile()` reenviaba ADEMÁS `formData.target_oposicion` sin condición en cada guardado de
 * nickname/meta/edad/ciudad/horas. Esa variable se resetea a `''` en la carga de la página para
 * CUALQUIER objetivo real que no esté en `ALL_OPOSICION_IDS` (el catálogo estático del código) —
 * exactamente el caso de las oposiciones catalogadas sin temario que persigue esta tarea, y
 * también el de un UUID de oposición personalizada. Y `PUT /api/profile` (a diferencia de
 * `/api/profile/target`) NO valida ni rechaza ese `''`: lo escribe tal cual.
 *
 * Resultado medido: Félix Peña (premium, 04/08/2026) tenía
 * `target_oposicion='cuerpo_superior_de_la_administracion_castilla_y_leon_bocyl'` (no está en
 * `ALL_OPOSICION_IDS`) y, tras pasar por /perfil, pasó a cadena vacía — sin haber tocado nada de
 * oposición. El propio `hasChanges` de la página consideraba esto "cambio pendiente" con solo
 * ABRIR /perfil (formData.target_oposicion='' ≠ profile.target_oposicion=<real>), así que el
 * botón "Guardar cambios" quedaba activo desde el primer instante.
 *
 * `DailyGoalBanner.tsx` ya sigue el patrón correcto: cada PUT a /api/profile manda solo el
 * campo que de verdad cambia (`{ studyGoal: goal }`, `{ showDailyGoalBanner: false }`). Este
 * test fija que `app/perfil/page.tsx` no vuelva a mandar target_oposicion "de propina".
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const PERFIL_PATH = join(process.cwd(), 'app/perfil/page.tsx')

function readPerfil(): string {
  return readFileSync(PERFIL_PATH, 'utf8')
}

/** Extrae el cuerpo de `saveProfile` (desde su declaración hasta el cierre de `saveProfile`). */
function saveProfileBody(src: string): string {
  const start = src.indexOf('const saveProfile = async ()')
  expect(start).toBeGreaterThan(-1)
  const nextFn = src.indexOf('\n  const ', start + 10)
  expect(nextFn).toBeGreaterThan(start)
  return src.slice(start, nextFn)
}

describe('T-397 — /perfil no borra target_oposicion al guardar cambios ajenos', () => {
  test('saveProfile() existe y es medible (el test no es un no-op)', () => {
    const body = saveProfileBody(readPerfil())
    expect(body.length).toBeGreaterThan(200)
    expect(body).toMatch(/fetch\(\s*['"`]\/api\/profile['"`]/)
  })

  test('el payload de saveProfile() (PUT /api/profile) NO manda targetOposicion ni targetOposicionData', () => {
    const body = saveProfileBody(readPerfil())
    expect(body).not.toMatch(/targetOposicion\s*:/)
    expect(body).not.toMatch(/targetOposicionData\s*:/)
  })

  test('hasChanges no cuenta target_oposicion como cambio pendiente del guardado genérico', () => {
    const src = readPerfil()
    const start = src.indexOf('const hasRealChanges =')
    expect(start).toBeGreaterThan(-1)
    const end = src.indexOf('setHasChanges(hasRealChanges)', start)
    expect(end).toBeGreaterThan(start)
    const block = src.slice(start, end)
    expect(block).not.toMatch(/target_oposicion/)
  })

  test('el punto de escritura DEDICADO sigue vivo y sigue rechazando vacíos (no se movió el bug de sitio)', () => {
    const routeSrc = readFileSync(
      join(process.cwd(), 'app/api/profile/target/route.ts'),
      'utf8',
    )
    // null explícito = limpiar a propósito; string vacío tras trim = 400, nunca se escribe ''.
    expect(routeSrc).toMatch(/clearing\s*=\s*raw\s*===\s*null/)
    expect(routeSrc).toMatch(/!clearing\s*&&\s*!oposicionId/)
  })
})
