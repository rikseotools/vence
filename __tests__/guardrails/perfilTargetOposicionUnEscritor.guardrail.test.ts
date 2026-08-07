/**
 * Guardarraíl [T-569]: `target_oposicion` tiene UN escritor del lado del cliente
 * (`lib/api/setTargetOposicion.ts`), y `saveProfile()` de `/perfil` no puede volver a
 * duplicarlo.
 *
 * El bug: `app/perfil/page.tsx` "limpiaba" en pantalla un `target_oposicion` inválido (UUID,
 * JSON, slug fuera de `ALL_OPOSICION_IDS`) poniéndolo a `''` — mostrar vacío, razonable. El
 * problema era que `saveProfile()` mandaba ESE `''` de vuelta al guardar CUALQUIER otro campo
 * (el apodo, la meta diaria…), sin que el usuario tocara el selector de oposición. Resultado:
 * 11 cuentas con `target_oposicion=''`, un TERCER estado que ningún `IS NULL` ve — cualquier
 * código que trata "sin oposición" mirando NULL las cuenta como si tuvieran una, y el
 * configurador "por leyes" les responde `positionType required`.
 *
 * El arreglo: `saveProfile()` deja de mandar `targetOposicion`/`targetOposicionData` — la
 * oposición se cambia SOLO a través de `setTargetOposicion` (`promoteToTarget` y
 * `OposicionChangeModal.onSelect`), que persiste + sincroniza `profile` en el momento, sin
 * depender del botón "Guardar cambios". Y `hasRealChanges` deja de comparar
 * `formData.target_oposicion`, porque compararlo contra el valor CRUDO de `profile` daba un
 * falso "hay cambios" en cuanto el loader limpiaba un valor inválido en pantalla.
 *
 * Por qué texto y no comportamiento: el componente es un client component de ~3800 líneas sin
 * arnés de render en este repo; lo que SÍ se puede fijar con certeza es la FORMA del payload
 * que se manda a `/api/profile` y qué compara `hasChanges` — que es exactamente donde vivía el
 * defecto. Mismo patrón que `profileFetchNeedsToken.test.ts` para el mismo fichero.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = readFileSync(join(process.cwd(), 'app/perfil/page.tsx'), 'utf8')

/** Cuerpo de `saveProfile`, desde su declaración hasta el siguiente `const <nombre> = ` a nivel de función. */
function cuerpoSaveProfile(src: string): string {
  const i = src.indexOf('const saveProfile = async () => {')
  expect(i).toBeGreaterThan(-1)
  const resto = src.slice(i)
  // NO usar el siguiente `const handleDirectChange`: entre medias vive
  // `createInitialProfile` (otra función, que SÍ mapea target_oposicion legítimamente al
  // leer el perfil recién creado) — coger hasta ahí daría un falso positivo.
  const fin = resto.indexOf('\n  // Extraer datos del avatar')
  expect(fin).toBeGreaterThan(-1)
  return resto.slice(0, fin)
}

/** Cuerpo del efecto que calcula `hasRealChanges` (empieza en el comentario que lo marca). */
function cuerpoHasChanges(src: string): string {
  const i = src.indexOf('// Verificar si hay cambios REALES')
  expect(i).toBeGreaterThan(-1)
  const resto = src.slice(i)
  const fin = resto.indexOf('setHasChanges(hasRealChanges)')
  expect(fin).toBeGreaterThan(-1)
  return resto.slice(0, fin)
}

describe('[T-569] /perfil — target_oposicion tiene UN solo escritor', () => {
  test('saveProfile() NO manda targetOposicion ni targetOposicionData al API', () => {
    const cuerpo = cuerpoSaveProfile(SRC)
    expect(cuerpo).not.toMatch(/targetOposicion\s*:/)
    expect(cuerpo).not.toMatch(/targetOposicionData\s*:/)
  })

  test('saveProfile() NO sincroniza target_oposicion/target_oposicion_data en el estado local', () => {
    const cuerpo = cuerpoSaveProfile(SRC)
    // El resto de campos SÍ se sincronizan (nickname, study_goal…) — solo estos dos no.
    expect(cuerpo).not.toMatch(/target_oposicion\s*:/)
    expect(cuerpo).not.toMatch(/target_oposicion_data\s*:/)
  })

  test('hasRealChanges ya NO compara formData.target_oposicion', () => {
    const cuerpo = cuerpoHasChanges(SRC)
    expect(cuerpo).not.toMatch(/formData\.target_oposicion/)
  })

  test('el ÚNICO escritor sigue siendo setTargetOposicion, en los dos sitios que cambian la oposición', () => {
    expect(SRC).toContain("import { setTargetOposicion } from '@/lib/api/setTargetOposicion'")
    const usos = SRC.split('await setTargetOposicion(').length - 1
    expect(usos).toBeGreaterThanOrEqual(2) // promoteToTarget + OposicionChangeModal.onSelect
  })

  test('el escritor canónico (lib/api/setTargetOposicion.ts) sigue escribiendo NULL para limpiar, nunca vacío', () => {
    const writer = readFileSync(join(process.cwd(), 'lib/api/setTargetOposicion.ts'), 'utf8')
    expect(writer).toContain('oposicionId: string | null')
  })

  test('el limpiador de valores inválidos emite un evento propio, no solo console.warn (BENIGNO)', () => {
    const i = SRC.indexOf('Limpiar datos sucios (UUIDs, JSON, slugs desconocidos)')
    expect(i).toBeGreaterThan(-1)
    const bloque = SRC.slice(i, i + 700)
    expect(bloque).toContain("eventType: 'perfil_target_oposicion_invalido'")
  })

  test("'perfil_target_oposicion_invalido' está registrado en ClientEventType", () => {
    const clientTs = readFileSync(join(process.cwd(), 'lib/observability/client.ts'), 'utf8')
    expect(clientTs).toContain("'perfil_target_oposicion_invalido'")
  })

  test("'perfil_target_oposicion_invalido' NO está marcado benigno (interesa vigilarlo)", () => {
    const benign = readFileSync(join(process.cwd(), 'lib/observability/benignSignals.ts'), 'utf8')
    expect(benign).not.toContain("'perfil_target_oposicion_invalido'")
  })
})
