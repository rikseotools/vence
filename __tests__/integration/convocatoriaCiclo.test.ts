// __tests__/integration/convocatoriaCiclo.test.ts
// Invariantes del CICLO de convocatoria — migración 20260716_convocatoria_ciclo_inmutable.sql
//   - toda mutación queda en convocatorias_history (nada se pierde)
//   - el historial SOBREVIVE al DELETE de su convocatoria (sin FK)
//   - el `año` es INMUTABLE (cambiarlo = destruir un ciclo)
//   - rollover_convocatoria() archiva el viejo e INSERTA uno nuevo VACÍO de hechos
//   - el ciclo archivado conserva su verdad INTACTA
//   - borrar una convocatoria con hitos FALLA (RESTRICT) en vez de comerse el timeline
// Oposición aislada → no toca datos reales. Requiere INTEGRATION_DB_WRITABLE.
import { Client } from 'pg'

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = /sslmode=/.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL.replace(/sslmode=[a-z-]+/, 'sslmode=no-verify')
    : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=no-verify'
}
const DB_URL = process.env.DATABASE_URL
const WRITABLE = process.env.INTEGRATION_DB_WRITABLE === '1'
const describeIf = DB_URL && WRITABLE ? describe : describe.skip

describeIf('ciclo de convocatoria — inmutable y trazable (RDS, aislado)', () => {
  let c: Client
  let oposicionId: string
  let convId2025: string
  const SLUG = 'ciclo-test-opo'

  beforeAll(async () => {
    c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await c.connect()
    oposicionId = (await c.query(
      `INSERT INTO oposiciones (slug, nombre, tipo_acceso, administracion, is_active)
       VALUES ($1, 'Test Ciclo', 'libre', 'test', false) RETURNING id`, [SLUG]
    )).rows[0].id
    convId2025 = (await c.query(
      `INSERT INTO convocatorias (oposicion_id, año, is_current, estado_proceso, exam_date, plazas_libres, programa_url)
       VALUES ($1, 2025, true, 'examen_realizado', '2025-05-01', 161, 'http://prog') RETURNING id`, [oposicionId]
    )).rows[0].id
  })

  afterAll(async () => {
    if (oposicionId) {
      await c.query(`DELETE FROM convocatoria_hitos WHERE oposicion_id=$1`, [oposicionId])
      await c.query(`DELETE FROM convocatorias WHERE oposicion_id=$1`, [oposicionId])
      await c.query(`DELETE FROM oposiciones WHERE id=$1`, [oposicionId])
    }
    await c.end()
  })

  test('el INSERT quedó registrado en el historial', async () => {
    const h = (await c.query(
      `SELECT operation, new_data->>'año' AS anio FROM convocatorias_history WHERE convocatoria_id=$1`, [convId2025])).rows
    expect(h.length).toBeGreaterThanOrEqual(1)
    expect(h[0].operation).toBe('INSERT')
    expect(h[0].anio).toBe('2025')
  })

  test('un UPDATE guarda la fila ENTERA antes y después (nada se pierde)', async () => {
    await c.query(`UPDATE convocatorias SET plazas_libres=200 WHERE id=$1`, [convId2025])
    const h = (await c.query(
      `SELECT changed_fields, old_data->>'plazas_libres' AS antes, new_data->>'plazas_libres' AS despues
         FROM convocatorias_history WHERE convocatoria_id=$1 AND operation='UPDATE'
        ORDER BY changed_at DESC LIMIT 1`, [convId2025])).rows[0]
    expect(h.antes).toBe('161')      // el valor viejo NO se ha perdido
    expect(h.despues).toBe('200')
    expect(h.changed_fields).toContain('plazas_libres')
  })

  test('el `año` es INMUTABLE: mutarlo destruiría un ciclo → se rechaza', async () => {
    await expect(
      c.query(`UPDATE convocatorias SET año=2026 WHERE id=$1`, [convId2025])
    ).rejects.toThrow(/INMUTABLE/i)
  })

  test('rollover_convocatoria: archiva el viejo e inserta el nuevo, SIN copiar hechos del anterior', async () => {
    const nuevo = (await c.query(
      `SELECT public.rollover_convocatoria($1, 2026, 'oep_aprobada', 'test') AS id`, [oposicionId])).rows[0].id

    const viejo = (await c.query(
      `SELECT is_current, archived_at, estado_proceso, exam_date, plazas_libres FROM convocatorias WHERE id=$1`, [convId2025])).rows[0]
    expect(viejo.is_current).toBe(false)
    expect(viejo.archived_at).not.toBeNull()
    // el ciclo archivado conserva su verdad INTACTA — esto es lo que hoy se machaca
    expect(viejo.estado_proceso).toBe('examen_realizado')
    expect(viejo.plazas_libres).toBe(200)
    expect(viejo.exam_date).not.toBeNull()

    const n = (await c.query(
      `SELECT año, is_current, estado_proceso, exam_date, plazas_libres, programa_url FROM convocatorias WHERE id=$1`, [nuevo])).rows[0]
    expect(n.año).toBe(2026)
    expect(n.is_current).toBe(true)
    // hechos del proceso: VACÍOS (no se heredan del ciclo viejo — sería el bug de Marta)
    expect(n.exam_date).toBeNull()
    expect(n.plazas_libres).toBeNull()
    // configuración estable: sí se hereda
    expect(n.programa_url).toBe('http://prog')
  })

  test('los DOS ciclos coexisten (la historia ya no se pierde)', async () => {
    const r = (await c.query(
      `SELECT año, is_current FROM convocatorias WHERE oposicion_id=$1 ORDER BY año`, [oposicionId])).rows
    expect(r.map((x: any) => x.año)).toEqual([2025, 2026])
    expect(r.filter((x: any) => x.is_current)).toHaveLength(1)
  })

  test('borrar una convocatoria CON hitos falla (RESTRICT) en vez de comerse el timeline', async () => {
    const conv = (await c.query(
      `SELECT id FROM convocatorias WHERE oposicion_id=$1 AND año=2026`, [oposicionId])).rows[0].id
    await c.query(
      `INSERT INTO convocatoria_hitos (oposicion_id, convocatoria_id, fecha, titulo, status, order_index)
       VALUES ($1, $2, '2026-01-01', 'Hito de prueba', 'completed', 1)`, [oposicionId, conv])
    await expect(
      c.query(`DELETE FROM convocatorias WHERE id=$1`, [conv])
    ).rejects.toThrow()
    // y el hito sigue vivo
    const n = (await c.query(`SELECT count(*)::int n FROM convocatoria_hitos WHERE convocatoria_id=$1`, [conv])).rows[0].n
    expect(n).toBe(1)
  })

  test('el historial SOBREVIVE al borrado de su convocatoria (sin FK)', async () => {
    const tmp = (await c.query(
      `INSERT INTO convocatorias (oposicion_id, año, is_current, estado_proceso)
       VALUES ($1, 2099, false, 'sin_oep') RETURNING id`, [oposicionId])).rows[0].id
    await c.query(`DELETE FROM convocatorias WHERE id=$1`, [tmp])
    const h = (await c.query(
      `SELECT operation FROM convocatorias_history WHERE convocatoria_id=$1 ORDER BY changed_at`, [tmp])).rows
    expect(h.map((x: any) => x.operation)).toEqual(['INSERT', 'DELETE'])   // la evidencia sobrevive al sujeto
  })
})
