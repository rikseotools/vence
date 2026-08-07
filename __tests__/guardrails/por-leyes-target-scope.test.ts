// __tests__/guardrails/por-leyes-target-scope.test.ts
//
// GUARDRAIL de la feature "test por leyes acotado a la oposición" (target scope).
// Diseño: un usuario CON oposición seleccionada ve por defecto SOLO sus leyes + su
// temario; un usuario SIN target (o /leyes/[law] explícito) sigue viendo la ley
// completa. El flag es opt-in (`scopeToPosition`) — NO debe filtrarse a los otros
// ~30 call-sites de isLawOnlyMode. Este guardrail blinda el cableado por lectura de
// código (corre en CI, sin BD). El comportamiento real se prueba en el test de
// integración (porLeyesScopeToPosition.integration).

import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('GUARDRAIL: test por leyes acotado a la oposición (opt-in scopeToPosition)', () => {
  it('el schema declara scopeToPosition con default false (opt-in)', () => {
    const src = read('lib/api/filtered-questions/schemas.ts')
    expect(src).toMatch(/scopeToPosition:\s*z\.boolean\(\)\.default\(false\)/)
  })

  it('isLawOnlyMode aplica el topic_scope SOLO cuando scopeToPosition (si no, ley completa)', () => {
    const src = read('lib/api/filtered-questions/queries.ts')
    // la rama acotada existe y usa topic_scope del positionType
    expect(src).toMatch(/else if \(scopeToPosition\)/)
    expect(src).toMatch(/\.from\(topicScope\)/)
    // y sigue existiendo el fallback "ley completa" (default)
    expect(src).toMatch(/LEY COMPLETA/i)
  })

  it('por-leyes: usa el target del usuario (no hardcodea Estado) y propaga scoped=1', () => {
    const src = read('app/test/por-leyes/page.tsx')
    expect(src).toMatch(/target_oposicion/)
    expect(src).toMatch(/positionType=\{targetPositionType \|\| 'auxiliar_administrativo_estado'\}/)
    expect(src).toMatch(/params\.set\('scoped', '1'\)/)
    // el hardcode viejo NO debe volver
    expect(src).not.toMatch(/positionType="auxiliar_administrativo_estado"/)
  })

  it('multi-ley: pasa scopeToPosition al API, gated por target real', () => {
    const src = read('app/test/multi-ley/page.tsx')
    expect(src).toMatch(/scopedRequested && !!userProfile\?\.target_oposicion/)
    expect(src).toMatch(/scopeToPosition,/)
  })

  it('laws-configurator filtra la lista de leyes por positionType', () => {
    const q = read('lib/api/laws-configurator/queries.ts')
    expect(q).toMatch(/getAllLawsWithStats\(positionType\?/)
    // Acotado por ARTÍCULO vía topic_scope del positionType (antes con el helper
    // articleInPositionScopeExists; desde el fix 24/07 con un CTE que materializa el
    // set de artículos escopados y mantiene count(DISTINCT) — evita el timeout de 30s).
    expect(q).toMatch(/topic_scope/)
    expect(q).toMatch(/article_number = ANY\(ts\.article_numbers\)/)
    const route = read('app/api/laws-configurator/route.ts')
    expect(route).toMatch(/searchParams\.get\('positionType'\)/)
  })

  it('ANTI-REGRESIÓN: /leyes/[law] NO usa scoped (el poweruser sigue con ley completa)', () => {
    const cfg = read('app/leyes/[law]/LawTestConfigurator.tsx')
    expect(cfg).not.toMatch(/scoped/)
    expect(cfg).not.toMatch(/scopeToPosition/)
  })

  // ── Fixes de la auditoría independiente (la PANTALLA, no solo el test servido) ──

  it('FIX auditoría: el conteo de leyes se acota por artículo (no por ley entera)', () => {
    const q = read('lib/api/laws-configurator/queries.ts')
    // El CTE filtra por artículo dentro del topic_scope del positionType (no la ley entera).
    expect(q).toMatch(/article_number = ANY\(ts\.article_numbers\)/)
  })

  it('FIX auditoría: el selector de artículos aplica scopeToPosition sin topicNumber', () => {
    const q = read('lib/api/test-config/queries.ts')
    expect(q).toMatch(/scopeToPosition && !topicNumber/)
    expect(q).toMatch(/articleInPositionScopeExists/)
    const schema = read('lib/api/test-config/schemas.ts')
    expect(schema).toMatch(/scopeToPosition:\s*z\.boolean\(\)\.default\(false\)/)
  })

  it('FIX auditoría: TestConfigurator recibe y propaga scopeToPosition; por-leyes lo pasa', () => {
    const cfg = read('components/TestConfigurator.tsx')
    expect(cfg).toMatch(/scopeToPosition = false/)          // prop con default
    expect(cfg).toMatch(/params\.set\('scopeToPosition', 'true'\)/) // al fetch de artículos
    const page = read('app/test/por-leyes/page.tsx')
    expect(page).toMatch(/scopeToPosition=\{effectiveScoped\}/)
  })

  it('FIX auditoría: isLawOnlyMode intersecta selección manual con el scope', () => {
    const q = read('lib/api/filtered-questions/queries.ts')
    expect(q).toMatch(/specificArticles\.length > 0 && scopeToPosition/)
    // Oposición CON temario → intersección (defensa en profundidad, sin regresión).
    expect(q).toMatch(/specificArticles\.filter\(a => scopedSet\.has\(a\)\)/)
  })

  it('FIX incidente Alfonso: sin temario (scoped===null) degrada a la selección del usuario, NO test vacío', () => {
    const q = read('lib/api/filtered-questions/queries.ts')
    // scopedNumbersFor distingue "sin temario" (null) de "temario vacío".
    expect(q).toMatch(/Promise<string\[\] \| null>/)
    // En degradación se sirve la selección explícita del usuario (no intersección vacía).
    expect(q).toMatch(/scoped === null/)
    expect(q).toMatch(/filtered_questions_unbuilt_oposicion_degrade/)
  })

  // ── [T-551] La degradación estaba en UN camino y no en su gemelo ──

  it('T-551: el CONTADOR degrada igual que el test (no interseca contra vacío)', () => {
    const q = read('lib/api/test-config/queries.ts')
    // el EXISTS del scope solo se aplica si la oposición TIENE temario para esa ley
    expect(q).toMatch(/positionHasScopeForLaw/)
    expect(q).toMatch(/scopeToPosition && tieneScopeDeLaLey/)
  })

  it('T-551: la decisión de degradar vive en UN solo sitio, no copiada en cada camino', () => {
    const shared = read('lib/api/_shared/topicScopeSql.ts')
    expect(shared).toMatch(/export function decidirAlcanceDeLey/)
    expect(shared).toMatch(/export function esDegradacion/)
    expect(shared).toMatch(/export async function positionHasScopeForLaw/)
    // y el contador la IMPORTA en vez de reimplementarla
    const q = read('lib/api/test-config/queries.ts')
    expect(q).toMatch(/from '@\/lib\/api\/_shared\/topicScopeSql'/)
  })

  it('T-551: el contador OBSERVA la degradación con el MISMO evento que el test', () => {
    // Dos emisores del mismo hecho no miden el doble, divergen: un solo eventType.
    const q = read('lib/api/test-config/queries.ts')
    expect(q).toMatch(/filtered_questions_unbuilt_oposicion_degrade/)
    expect(q).toMatch(/mode: 'estimate'/)
  })

  it('FIX auditoría: multi-ley espera a userProfile cuando la URL pide scoped=1', () => {
    const src = read('app/test/multi-ley/page.tsx')
    expect(src).toMatch(/!scopedRequested \|\| userProfile !== null/)
  })

  // ── Anti-dead-end "Sin leyes disponibles" (caso Alfonso, 11/07) ──

  it('FIX anti-dead-end: por-leyes cae a TODAS las leyes si el scope de su oposición da 0, con aviso + cómo cambiar', () => {
    const page = read('app/test/por-leyes/page.tsx')
    expect(page).toMatch(/scopeFallback/)                    // estado del fallback
    expect(page).toMatch(/scoped && data\.length === 0/)     // condición: acotado + vacío
    expect(page).toMatch(/fetchLaws\(false\)/)               // refetch sin scope (todas)
    // el banner explica y da la salida (cambiar oposición)
    expect(page).toMatch(/Cambiar oposición/)
    expect(page).toMatch(/href="\/perfil"/)
  })

  it('FIX detección: laws-configurator emite laws_configurator_empty_scope cuando el scope da 0', () => {
    const q = read('lib/api/laws-configurator/queries.ts')
    expect(q).toMatch(/emitFireAndForget/)
    expect(q).toMatch(/laws_configurator_empty_scope/)
    expect(q).toMatch(/positionType && out\.totalLaws === 0/)
  })

  // ── Feedback Alfonso (25/07): resiliencia de red + visibilidad ley-entera ──

  it('FIX-A (red): por-leyes carga las leyes con fetchWithChallenge (retry+backoff), NO fetch crudo', () => {
    const page = read('app/test/por-leyes/page.tsx')
    expect(page).toMatch(/import { fetchWithChallenge } from '@\/lib\/api\/fetchWithChallenge'/)
    // el fetch de laws-configurator pasa por el wrapper resiliente
    expect(page).toMatch(/await fetchWithChallenge\(url\)/)
    // y NO queda un fetch crudo a ese endpoint
    expect(page).not.toMatch(/await fetch\(url\)/)
  })

  it('FIX-B (UX): TestConfigurator usa summarizeLawInclusion y pinta badge por-ley', () => {
    const cfg = read('components/TestConfigurator.tsx')
    expect(cfg).toMatch(/import { summarizeLawInclusion, inclusionBadgeLabel } from '@\/lib\/laws\/lawInclusionSummary'/)
    expect(cfg).toMatch(/const inclusionSummary = useMemo/)
    // gateado a modo por-leyes (sin tema)
    expect(cfg).toMatch(/if \(tema \|\| selectedLaws\.size === 0\) return null/)
    // badge por-ley con inclusionBadgeLabel
    expect(cfg).toMatch(/inclusionBadgeLabel\(inc\)/)
  })

  it('FIX-B (UX): TestConfigurator avisa del caso MIXTO (acotada + entera)', () => {
    const cfg = read('components/TestConfigurator.tsx')
    expect(cfg).toMatch(/inclusionSummary\?\.mixedWholeAndNarrowed/)
    expect(cfg).toMatch(/Mezclas leyes acotadas con leyes completas/)
  })

  it('FIX-B (observabilidad): emite multiley_mixed_inclusion_start al arrancar test mixto', () => {
    const cfg = read('components/TestConfigurator.tsx')
    expect(cfg).toMatch(/emitClientEvent/)
    expect(cfg).toMatch(/multiley_mixed_inclusion_start/)
    // y el eventType está registrado en la taxonomía cliente
    const client = read('lib/observability/client.ts')
    expect(client).toMatch(/'multiley_mixed_inclusion_start'/)
  })

  // ── [T-416] El CSS ":contains(...)" que "ocultaba" oficiales/imprescindibles en
  // /leyes/[law] era código muerto desde su creación (:contains no existe en CSS, es de
  // jQuery; los data-testid a los que apuntaba no existen en ningún sitio del árbol). El
  // ocultamiento real siempre fue — y sigue siendo — el prop hideOfficialQuestions /
  // hideEssentialArticles resuelto por renderizado condicional en TestConfigurator.tsx.

  it('T-416: el bloque CSS muerto (:contains, data-testid inexistentes) no vuelve a LawTestConfigurator', () => {
    const cfg = read('app/leyes/[law]/LawTestConfigurator.tsx')
    expect(cfg).not.toMatch(/:contains\(/)
    expect(cfg).not.toMatch(/data-testid="official-questions"/)
    expect(cfg).not.toMatch(/data-testid="essential-articles"/)
    expect(cfg).not.toMatch(/<style jsx global>/)
  })

  it('T-416: el ocultamiento real sigue siendo el prop, no CSS — ambos props se pasan y se respetan', () => {
    const cfg = read('app/leyes/[law]/LawTestConfigurator.tsx')
    expect(cfg).toMatch(/hideOfficialQuestions=\{true\}/)
    expect(cfg).toMatch(/hideEssentialArticles=\{true\}/)

    const shared = read('components/TestConfigurator.tsx')
    // renderizado condicional real (no CSS): la casilla de oficiales solo se pinta si NO
    // está oculta por prop y hay al menos una oficial que contar.
    expect(shared).toMatch(/!hideOfficialQuestions && officialCount > 0/)
    expect(shared).toMatch(/!hideEssentialArticles && officialCount > 0/)
  })
})
