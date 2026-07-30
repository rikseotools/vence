/**
 * @jest-environment node
 */
// __tests__/integration/auditNoteSweepBudget.integration.test.ts
//
// Dos invariantes del detector `audit_note_explanation` que SOLO se pueden comprobar contra un
// Postgres de verdad, y que nacen del incidente T-307 (30/07/2026): la query de este detector
// tardaba 40,6 s contra el `statement_timeout: 30000` del cliente del backend y **tumbaba el
// barrido nocturno COMPLETO** dos días seguidos — `content_health_findings` sin escribir desde el
// 28/07 con el panel enseñando lo de ese día como si fuera de hoy.
//
//   1. **PRESUPUESTO** — el predicado, sobre el banco entero y en el caso MALO (sin `LIMIT`, que
//      es el que se da cuando no hay coincidencias), cabe con margen en el `statement_timeout`
//      del sweep. Un test unitario no puede ver esto: el coste está en el motor, no en la lógica.
//   2. **EQUIVALENCIA JS ↔ POSTGRES** — el `~*` de Postgres marca EXACTAMENTE lo que marca el
//      núcleo en JS. Las dos implementaciones del criterio conviven (el sweep consulta en SQL, el
//      triaje y los scripts usan el núcleo), y una divergencia de dialecto de regex las separaría
//      en silencio. Se prueba con un corpus fijo por `VALUES`, así que no depende de que el banco
//      tenga hoy notas de auditoría (hoy tiene 0: justo lo que destapó el incidente).
import dotenv from 'dotenv'
import postgres from 'postgres'

const core = require('@/lib/health/auditNoteExplanation.cjs')

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

/** El mismo que fija `backend/src/db/database.module.ts` para el cliente de escritura. */
const SWEEP_STATEMENT_TIMEOUT_MS = 30_000
/**
 * Margen exigido: la mitad del presupuesto. No es un número redondo por gusto — el barrido corre
 * de madrugada con la caché fría (los 40,6 s medidos en caliente eran 21,6 s), así que un
 * predicado que apurase el timeout en un banco de pruebas volvería a romper en producción.
 */
const PRESUPUESTO_MS = SWEEP_STATEMENT_TIMEOUT_MS / 2

describeIfDb('audit_note_explanation — presupuesto y equivalencia contra Postgres', () => {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url)
  const sql = postgres(url, { ssl: local ? false : { rejectUnauthorized: false }, onnotice: () => {} })

  afterAll(async () => {
    await sql.end()
  })

  test(`el predicado cabe en el presupuesto del sweep (< ${PRESUPUESTO_MS} ms sobre el banco entero)`, async () => {
    // `SET` no admite parámetros; el valor es una constante nuestra, no entrada externa.
    await sql.unsafe(`SET statement_timeout = ${SWEEP_STATEMENT_TIMEOUT_MS * 4}`)
    const t0 = Date.now()
    await sql.unsafe(
      `SELECT count(*)::int AS n FROM questions
        WHERE is_active = true
          AND (explanation ~* $1 OR explanation ~* $2 OR explanation ~* $3)`,
      [core.AUDIT_NOTE_LITERAL_RE_SRC, core.AUDIT_NOTE_META_RE_SRC, core.AUDIT_NOTE_ACTO_RE_SRC],
    )
    const ms = Date.now() - t0
    // eslint-disable-next-line no-console
    console.log(`  audit_note_explanation: ${ms} ms (presupuesto ${PRESUPUESTO_MS} ms)`)
    expect(ms).toBeLessThan(PRESUPUESTO_MS)
  }, 180_000)

  test('el `~*` de Postgres marca exactamente lo mismo que el núcleo en JS', async () => {
    // Corpus: texto REAL del banco (los casos que cada recaída del detector no veía) + prosa
    // legítima que NO debe marcarse.
    const corpus = [
      'La explicación confunde el art. 150.2 con el art. 150.3.',
      'La explanation cita "art. 89" como fundamento, pero la regla figura en el art. 88.7.',
      'Nota técnica: la respuesta oficial del examen es discutible.',
      'La explicación no advierte que el plazo cambió con la reforma.',
      'Añadir sección «Por qué las demás son correctas:» con el análisis de cada opción.',
      'Debe reescribirse para justificar la opción B.',
      // negativos: prosa didáctica y formato canónico §5.1
      'El plazo de alegaciones es de 10 días hábiles según el art. 82.2.',
      'La respuesta correcta es la B porque el art. 14 lo dice literalmente.',
      'En esa vista se pueden añadir secciones y modificar propiedades del informe.',
      'La explicación anterior encadena con este apartado.',
      '',
    ]
    const rows = (await sql.unsafe(
      `SELECT t.i, (t.txt ~* $1 OR t.txt ~* $2 OR t.txt ~* $3) AS marcado
         FROM unnest($4::text[]) WITH ORDINALITY AS t(txt, i) ORDER BY t.i`,
      [
        core.AUDIT_NOTE_LITERAL_RE_SRC,
        core.AUDIT_NOTE_META_RE_SRC,
        core.AUDIT_NOTE_ACTO_RE_SRC,
        corpus as unknown as string,
      ],
    )) as unknown as Array<{ i: number; marcado: boolean }>

    expect(rows).toHaveLength(corpus.length)
    const enSql = rows.map((r) => Boolean(r.marcado))
    const enJs = corpus.map((t) => core.isAuditNoteExplanation(t))
    expect(enSql).toEqual(enJs)
    // Y que el corpus no sea trivial (si un día alguien lo vacía, el test no debe pasar por vacío).
    expect(enJs.filter(Boolean).length).toBeGreaterThanOrEqual(6)
    expect(enJs.filter((x) => !x).length).toBeGreaterThanOrEqual(4)
  }, 60_000)
})
