/**
 * @jest-environment node
 *
 * INVARIANTE: si una oposición tiene preguntas psicotécnicas reales en BD
 * (`psychometric_questions`, identificadas por su `exam_source`), su entrada
 * en el config `lib/config/oposiciones.ts` DEBE tener `hasPsychometricTest: true`.
 *
 * Por qué existe: el icono de Psicotécnicos del Header (y la sección del Test Hub)
 * se muestran SOLO si `hasPsychometricTest` es true. Si una oposición tiene psico
 * en su examen pero el flag no está puesto, el usuario NO ve el icono aunque le
 * corresponde (bug de "oculta de más"). Este test caza esa desincronización
 * automáticamente — de hecho destapó que `auxiliar_administrativo_cyl` (10 psico
 * en BD) no estaba marcada.
 *
 * Si FALLA: una oposición del mapa tiene psico en BD pero su config no lo marca.
 *   → Pon `hasPsychometricTest: true` en esa oposición (verificado). NO borres
 *     preguntas para "arreglar" el test.
 *
 * Mapa `exam_source` sincronizado con __tests__/config/officialExamsCoherence.test.ts
 * y lib/api/psychometric-test-data/queries.ts. Al añadir una oposición con psico,
 * añade su patrón aquí (y márcala en el config).
 */

import dotenv from 'dotenv'
import postgres from 'postgres'
import { getOposicionByPositionType } from '@/lib/config/oposiciones'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIf = DB_URL ? describe : describe.skip

// positionType → patrón de exam_source en psychometric_questions.
const PSYCHO_EXAM_SOURCE_PATTERNS: Record<string, string> = {
  auxiliar_administrativo_estado: '%Auxiliar Administrativo Estado%',
  auxiliar_administrativo_madrid: '%Auxiliar Administrativo Comunidad de Madrid%',
  auxiliar_administrativo_carm: '%Auxiliar Administrativo CARM Murcia%',
  auxiliar_administrativo_cyl: '%Auxiliar Administrativo CyL%',
  tramitacion_procesal: '%Tramitación Procesal%',
  auxilio_judicial: '%Auxilio Judicial%',
  administrativo_estado: 'Examen Administrativo Estado%',
  policia_nacional: '%Policía Nacional%',
  guardia_civil: '%Guardia Civil%',
}

describeIf('Coherencia hasPsychometricTest ↔ contenido psicotécnico en BD', () => {
  let sql: ReturnType<typeof postgres>

  beforeAll(() => {
    sql = postgres(DB_URL as string, { ssl: { rejectUnauthorized: false }, max: 1 })
  })

  afterAll(async () => {
    await sql?.end()
  })

  it.each(Object.entries(PSYCHO_EXAM_SOURCE_PATTERNS))(
    'si %s tiene psico en BD → su config debe marcar hasPsychometricTest: true',
    async (positionType, pattern) => {
      const rows = await sql`
        SELECT count(*)::int AS n FROM psychometric_questions
        WHERE is_active AND exam_source ILIKE ${pattern}`
      const n: number = rows[0].n
      if (n > 0) {
        const opo = getOposicionByPositionType(positionType)
        expect(opo).toBeDefined()
        // Si esto falla: la oposición tiene psico real pero el config no lo marca.
        expect(opo?.hasPsychometricTest).toBe(true)
      }
    },
  )
})
