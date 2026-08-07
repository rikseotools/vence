/**
 * @jest-environment node
 */
// __tests__/integration/temarioComunicadoCurado.integration.test.ts
//
// GUARDARRAÍL: la cola de revisión de temario (scripts/temario/detect-temario-revision.cjs)
// separa comunicados CURADOS de comunicados SIN CURAR — T-181, 07/08/2026.
//
// `detect-notas-convocatoria` clona TODO enlace que encuentra en la página de seguimiento
// (notas-extract.ts → extractDocLinks), sin comprobar de qué CUERPO es — y esas páginas listan
// varios procesos a la vez. Medido contra el hub real (07/08): la Orden TDF/568/2025 (convocatoria
// de la Subescala de Intervención-Tesorería de la Administración Local — un cuerpo que no pinta
// nada aquí) estaba clonada como "comunicado de temario" en `tecnico-informatica`,
// `administrativo-estado`, `auxiliar-administrativo-estado` Y `mecanico-conductor-estado` (cuatro
// cuerpos distintos, tres de ellos ni comparten dominio de seguimiento). `celador-sas` tenía guías
// clínicas de salud mental (prevención del suicidio) coladas desde el mismo portal del SAS.
//
// La lección de `corpusAjeno.cjs` (T-655) YA midió que comparar contra nuestro `nombre` comercial
// da 56% de falsos positivos — por eso este arreglo NO compara nombres de cuerpo. Usa `curado`
// (solo lo pone `true` quien atribuye un documento a propósito, con criterio — clonar-documento.ts;
// el crawler automático de detect-notas SIEMPRE deja `curado=false`), que ya existe y no hace
// falta inventar.
//
// Corre en CI contra PROD read-only.
import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

describeIfDb('cola de revisión de temario — comunicados curados vs sin curar (T-181)', () => {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url)
  const sql = postgres(url, { ssl: local ? false : { rejectUnauthorized: false }, onnotice: () => {} })

  afterAll(async () => {
    await sql.end()
  })

  // Núcleo del arreglo, SIN la parte de `usuarios` (que exige user_profiles y no cambia con
  // T-181) — así este test es ejecutable con un rol de solo lectura de negocio, no solo con el
  // credential completo de la app.
  const DOCS_TEMARIO_CTE = `
    WITH docs_temario AS (
      SELECT cd.convocatoria_id,
             count(*) FILTER (WHERE cd.curado)::int comunicados_curados,
             count(*) FILTER (WHERE NOT cd.curado)::int comunicados_sin_curar
        FROM convocatoria_documentos cd
       WHERE cd.extracted_text IS NOT NULL
         AND ((SELECT count(*) FROM regexp_matches(cd.extracted_text, 'tema[[:space:]]+[0-9]+', 'gi')) >= 5
              OR (cd.extracted_text ~* 'powerpoint' AND cd.extracted_text ~* 'excel'))
       GROUP BY 1)
  `

  test('comunicados_curados + comunicados_sin_curar suman lo mismo que la cuenta sin partir (no se pierde ningún documento)', async () => {
    const partido = await sql.unsafe(`
      ${DOCS_TEMARIO_CTE}
      SELECT COALESCE(sum(comunicados_curados), 0)::int curados,
             COALESCE(sum(comunicados_sin_curar), 0)::int sin_curar
        FROM docs_temario`)
    const [sinPartir] = await sql`
      SELECT count(*)::int total
        FROM convocatoria_documentos cd
       WHERE cd.extracted_text IS NOT NULL
         AND ((SELECT count(*) FROM regexp_matches(cd.extracted_text, 'tema[[:space:]]+[0-9]+', 'gi')) >= 5
              OR (cd.extracted_text ~* 'powerpoint' AND cd.extracted_text ~* 'excel'))`
    expect(partido[0].curados + partido[0].sin_curar).toBe(sinPartir.total)
  })

  test('REGRESIÓN: la Orden TDF/568/2025 (otro cuerpo) sigue SIN CURAR — si algún día se cura hay que confirmar que es a propósito', async () => {
    const rows = await sql`
      SELECT o.slug, cd.curado
        FROM convocatoria_documentos cd
        JOIN convocatorias cv ON cv.id = cd.convocatoria_id AND cv.is_current
        JOIN oposiciones o ON o.id = cv.oposicion_id
       WHERE cd.url = 'https://sede.inap.gob.es/documents/59312/2490877/2.1-BOE-A-2025-11110.pdf/df1762c1-c97c-f429-72c5-c608a33e959f'`
    if (rows.length === 0) return // el documento pudo limpiarse ya — nada que fijar
    for (const r of rows) expect(r.curado).toBe(false)
  })

  test('el caso CARM sigue contando como CURADO tras el arreglo (no se pierde el positivo real que motivó el detector)', async () => {
    const rows = await sql.unsafe(`
      ${DOCS_TEMARIO_CTE}
      SELECT dt.comunicados_curados
        FROM docs_temario dt
        JOIN convocatorias cv ON cv.id = dt.convocatoria_id AND cv.is_current
        JOIN oposiciones o ON o.id = cv.oposicion_id
       WHERE o.slug = 'auxiliar-administrativo-carm'`)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].comunicados_curados).toBeGreaterThanOrEqual(1)
  })
})
