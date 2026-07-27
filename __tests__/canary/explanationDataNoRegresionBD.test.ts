/**
 * @jest-environment node
 */
// CANARY de la Fase 2 (T-080) contra la BD viva: transcribir una explicación al formato
// estructurado NO puede cambiar lo que lee el opositor.
//
// Por qué existe: la transcripción reescribe la fuente de la explicación de 139.445 preguntas.
// Si el render desde `explanation_data` perdiera texto, el opositor vería una explicación
// mutilada y **nadie se enteraría**: el texto original sigue intacto en `explanation`, así que
// ningún detector de contenido lo notaría. De hecho, al construir el backfill se cazaron tres
// pérdidas reales por esta vía —el párrafo de contexto, la cita cuando no abría la explicación y
// las citas multilínea truncadas a su primer entrecomillado (1.024 → 391 caracteres)—, ninguna
// de las cuales veía la invariante ida-vuelta: lo que se pierde al parsear nunca entra en la
// estructura, así que el round-trip cerraba tan contento.
//
// Guardado por DATABASE_URL (patrón de `shuffleRoundtripBD`): se SALTA en CI sin BD; corre en
// local/post-deploy con:
//   DATABASE_URL=… NODE_TLS_REJECT_UNAUTHORIZED=0 npx jest explanationDataNoRegresionBD
//
// ⚠️ Pasa la DATABASE_URL ÍNTEGRA, con su `sslmode=require`: este canary usa `getDb()` (el
// cliente de producción), y RDS rechaza la conexión sin cifrado ("no pg_hba.conf entry … no
// encryption"). El canary hermano `shuffleRoundtripBD` sí se lo quita porque monta su propio
// cliente con `ssl` explícito — no copiar de ahí sin mirar.
import { transformQuestion } from '@/lib/api/filtered-questions/queries'
// El MISMO comparador que usa el backfill para decidir si migra. Tenerlo duplicado aquí
// garantizaría que un día divergen y este canary deja de vigilar lo que aquel decide.
import { mismoContenidoExplicacion } from '@/lib/shuffle/structuredExplanation'

const HAS_DB = !!process.env.DATABASE_URL
const d = HAS_DB ? describe : describe.skip

d('CANARY Fase 2 — la explicación estructurada no pierde ni cambia texto (BD viva)', () => {
  let filas: any[] = []

  beforeAll(async () => {
    const { getDb } = await import('@/db/client')
    const { sql } = await import('drizzle-orm')
    filas = (await getDb().execute(sql`
      SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, correct_option,
             explanation, explanation_data, shuffle_mode, shuffle_safety, primary_article_id
        FROM questions
       WHERE explanation_data IS NOT NULL
       ORDER BY id
       LIMIT 2000`)) as unknown as any[]
  }, 120000)

  const fila = (f: any) => ({
    id: f.id, questionText: f.question_text, optionA: f.option_a, optionB: f.option_b,
    optionC: f.option_c, optionD: f.option_d, optionE: f.option_e, correctOption: f.correct_option,
    explanation: f.explanation, explanationData: f.explanation_data, shuffleMode: f.shuffle_mode,
    shuffleSafety: f.shuffle_safety, primaryArticleId: f.primary_article_id, sourceTopic: null,
  }) as any

  test('en orden NATURAL, el render dice exactamente lo mismo que el texto original', () => {
    const malas: string[] = []
    for (const f of filas) {
      const servida = transformQuestion(fila(f), 0, false).explanation
      if (!mismoContenidoExplicacion(servida, f.explanation)) malas.push(f.id)
    }
    expect({ preguntas: filas.length, conDiferencias: malas.slice(0, 5) })
      .toEqual({ preguntas: filas.length, conDiferencias: [] })
  })

  test('al BARAJAR, cada razón sigue viajando con su opción y no se pierde texto', () => {
    const malas: string[] = []
    for (const f of filas) {
      const servida = transformQuestion(fila(f), 0, true).explanation
      // Las letras cambian (el comparador las neutraliza); el texto y las razones, no.
      if (!mismoContenidoExplicacion(servida, f.explanation)) malas.push(f.id)
    }
    expect({ preguntas: filas.length, conDiferencias: malas.slice(0, 5) })
      .toEqual({ preguntas: filas.length, conDiferencias: [] })
  })
})
