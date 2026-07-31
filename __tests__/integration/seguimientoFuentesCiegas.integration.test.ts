// __tests__/integration/seguimientoFuentesCiegas.integration.test.ts
//
// Integración del detector de FUENTES CIEGAS de seguimiento contra la BD viva (RDS).
// Se salta solo si no hay DATABASE_URL (CI-safe), igual que el resto de integración.
//
// Los tests unitarios (`__tests__/lib/convocatoria/seguimientoVigilable.test.js`) fijan la LÓGICA.
// Aquí se comprueba lo que la lógica pura no puede ver: que la consulta del detector case con el
// esquema real, que la capa de atribución exista de verdad, y —lo más importante— que se cumplan
// los INVARIANTES que evitan un falso positivo en producción. El caso que motiva esto es real:
// el 26/07 la simulación marcó `administrativo-diputacion-jaen` como ciega usando el
// `content_preview` de su URL ANTERIOR, minutos después de repuntarla.

import { testDbConfig } from '../helpers/db'
import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

/* eslint-disable @typescript-eslint/no-var-requires */
const {
  clasificarVigilancia,
  UMBRAL_CIEGA,
} = require('../../lib/convocatoria/seguimientoVigilable.cjs')

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

// GOTCHA de `pg` + RDS: si la connection string trae `sslmode=require`, ESE parámetro gana sobre
// la opción `ssl` del cliente y la conexión revienta con "self-signed certificate in certificate
// chain" (RDS presenta su propia CA). Pasar `ssl: { rejectUnauthorized: false }` NO basta: hay que
// quitar el `sslmode` de la URL. El cliente `postgres` (el que usan los scripts) no sufre esto,
// por eso los scripts conectan y los tests de integración no.
function urlSinSslMode(url: string): string {
  return url.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, pre, post) => (post === '&' ? pre : ''))
}

interface FilaDetector {
  slug: string
  seguimiento_url: string
  http_status: number | null
  error_message: string | null
  content_preview: string | null
  checked_url: string | null
}

// La MISMA consulta que corren el gemelo CLI y el @Cron del backend. Si el esquema cambia, este
// test se entera antes que el cron nocturno.
const SQL_DETECTOR = `
  SELECT o.slug, o.seguimiento_url, ch.http_status, ch.error_message,
         ch.content_preview, ch.checked_url
  FROM oposiciones o
  JOIN LATERAL (
    SELECT k.http_status, k.error_message, k.content_preview, k.checked_url
    FROM convocatoria_seguimiento_checks k
    WHERE k.oposicion_id = o.id AND k.checked_url = o.seguimiento_url
    ORDER BY k.checked_at DESC LIMIT 1
  ) ch ON true
  WHERE o.is_active AND o.seguimiento_url IS NOT NULL
`

describeIfDb('Detector de fuentes ciegas de seguimiento (integración)', () => {
  let client: Client
  let filas: FilaDetector[]

  beforeAll(async () => {
    client = new Client(testDbConfig())
    await client.connect()
    filas = (await client.query(SQL_DETECTOR)).rows
  }, 60000)

  afterAll(async () => {
    if (client) await client.end()
  })

  it('la columna de atribución existe (si falta, el detector daría falsos positivos en masa)', async () => {
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'convocatoria_seguimiento_checks' AND column_name = 'checked_url'`,
    )
    expect(rows).toHaveLength(1)
  })

  it('la consulta del detector corre contra el esquema real y devuelve filas', () => {
    expect(Array.isArray(filas)).toBe(true)
    // Si esto baja a 0, o se rompió el JOIN o el cron dejó de escribir `checked_url`.
    expect(filas.length).toBeGreaterThan(0)
  })

  it('INVARIANTE: toda fila juzgada tiene evidencia atribuible a la URL VIGENTE', () => {
    // Es la capa que impide juzgar una oposición con el contenido de su URL anterior.
    const huerfanas = filas.filter((f) => f.checked_url !== f.seguimiento_url)
    expect(huerfanas).toEqual([])
  })

  it('INVARIANTE: nada marcado como ciego tiene contenido de sobra', () => {
    // Un `error` con miles de chars significaría que un patrón de cuerpo falso está disparando
    // sobre una página sana (falso positivo). Los patrones solo se evalúan por debajo del umbral.
    const ciegasGordas = filas
      .map((f) => ({
        slug: f.slug,
        len: (f.content_preview || '').length,
        d: clasificarVigilancia({
          httpStatus: f.http_status,
          error: f.error_message,
          texto: f.content_preview,
        }),
      }))
      .filter((x) => x.d.severidad === 'error' && x.len >= 1500)
    expect(ciegasGordas).toEqual([])
  })

  it('INVARIANTE: los fallos de fetch NO pingan el badge (ya son visibles como error)', () => {
    const fallosComoError = filas
      .map((f) =>
        clasificarVigilancia({
          httpStatus: f.http_status,
          error: f.error_message,
          texto: f.content_preview,
        }),
      )
      .filter((d) => d.nivel === 'fetch_error' && d.severidad === 'error')
    expect(fallosComoError).toEqual([])
  })

  it('cordura de volumen: el detector no marca a media plataforma', () => {
    // Calibrado 26/07: 15 ciegas sobre 406 juzgables (3,7%). Si un día esto se dispara por encima
    // del 25% es que se rompió la extracción de texto o el fetch del cron, no que medio catálogo
    // se haya vuelto SPA de golpe. Guardarraíl de cordura, no de precisión.
    const ciegas = filas.filter(
      (f) =>
        clasificarVigilancia({
          httpStatus: f.http_status,
          error: f.error_message,
          texto: f.content_preview,
        }).severidad === 'error',
    )
    expect(ciegas.length / filas.length).toBeLessThan(0.25)
  })

  it('el umbral sigue separando: ninguna fuente sana baja del mínimo', () => {
    const sanasCortas = filas.filter((f) => {
      const d = clasificarVigilancia({
        httpStatus: f.http_status,
        error: f.error_message,
        texto: f.content_preview,
      })
      return d.vigilable && (f.content_preview || '').length < UMBRAL_CIEGA
    })
    expect(sanasCortas).toEqual([])
  })
})
