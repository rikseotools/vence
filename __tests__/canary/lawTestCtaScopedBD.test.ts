/**
 * @jest-environment node
 */
// __tests__/canary/lawTestCtaScopedBD.test.ts
//
// CANARY POST-DEPLOY del fix T-073 contra INFRA VIVA (www.vence.es) + BD.
// No comprueba "responde 200": verifica el INVARIANTE — el CTA "Hacer test de {ley}"
// que la página de temario DESPLEGADA emite lleva `?selected_articles=<arts del tema>`
// (NO la ley entera), y ese scope COINCIDE con el topic_scope real en RDS.
// Caza: (a) fix no desplegado (enlace pelado), (b) scope equivocado (drift vs RDS).
//
// Guardado por DATABASE_URL (patrón oposicionIdentityBD): se SALTA en CI sin BD.
// Correr POST-DEPLOY:  DATABASE_URL=... npx jest lawTestCtaScopedBD
const HAS_DB = !!process.env.DATABASE_URL
const d = HAS_DB ? describe : describe.skip

const BASE = process.env.CANARY_BASE_URL || 'https://www.vence.es'
const CE_SLUG = 'constitucion-espanola'

// GET real vía módulo nativo (el `fetch` global está stubbeado en el entorno jest).
function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const https = require('https')
    https
      .get(url, { headers: { 'user-agent': 'vence-canary' } }, (res: NodeJS.ReadableStream) => {
        let data = ''
        res.on('data', (c: Buffer) => (data += c))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
  })
}

d('CANARY T-073: el CTA de test de ley del temario desplegado va ACOTADO al tema', () => {
  let fixture: { oposSlug: string; tema: number; scope: Set<string> } | null = null
  let html = ''
  let leyCtaHrefs: string[] = []

  beforeAll(async () => {
    const { Client } = await import('pg')
    const url = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '')
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await c.connect()
    // Fixture: oposición ACTIVA + tema que escopa CE a un SUBCONJUNTO (5-40 arts).
    const r = await c.query(`
      SELECT t.position_type, t.topic_number, ts.article_numbers AS scope
      FROM topics t
      JOIN topic_scope ts ON ts.topic_id = t.id
      JOIN laws l ON l.id = ts.law_id
      JOIN oposiciones o ON o.slug = replace(t.position_type,'_','-')
      WHERE l.short_name = 'CE' AND t.is_active AND o.is_active AND ts.article_numbers IS NOT NULL
        AND array_length(ts.article_numbers,1) BETWEEN 5 AND 40
      ORDER BY t.position_type LIMIT 1`)
    await c.end()
    if (r.rows.length) {
      const row = r.rows[0]
      fixture = {
        oposSlug: String(row.position_type).replace(/_/g, '-'),
        tema: row.topic_number,
        scope: new Set((row.scope as string[]).map(String)),
      }
      html = await httpGet(`${BASE}/${fixture.oposSlug}/temario/tema-${fixture.tema}?nc=${Date.now()}`)
      // CTA nivel-ley = href a /leyes/{CE} seguido INMEDIATAMENTE del texto "Hacer test de"
      // (los CTA por-artículo llevan "Hacer test Art. N" → no casan).
      const re = new RegExp(`href="(/leyes/${CE_SLUG}[^"]*)"[^>]*>\\s*Hacer test de `, 'g')
      let m: RegExpExecArray | null
      const hrefs: string[] = []
      while ((m = re.exec(html)) !== null) hrefs.push(m[1].replace(/&amp;/g, '&'))
      leyCtaHrefs = hrefs
    }
  }, 60000)

  test('fixture + página viva encontrados', () => {
    expect(fixture).not.toBeNull()
    expect(html.length).toBeGreaterThan(1000)
    expect(leyCtaHrefs.length).toBeGreaterThan(0)
  })

  test('INVARIANTE: NINGÚN CTA de ley va pelado (todos con selected_articles + source=temario)', () => {
    if (!fixture) return
    const pelados = leyCtaHrefs.filter((h) => !/[?&]selected_articles=/.test(h))
    expect(pelados).toEqual([]) // fix no desplegado ⇒ aquí caería el enlace pelado
    leyCtaHrefs.forEach((h) => expect(h).toContain('source=temario'))
  })

  test('INVARIANTE en BD: el scope del href COINCIDE con el topic_scope real (sin drift)', () => {
    if (!fixture) return
    for (const href of leyCtaHrefs) {
      const sel = new URL('https://x' + href).searchParams.get('selected_articles') || ''
      const hrefScope = new Set(sel.split(',').filter(Boolean))
      // todo artículo del href está en el topic_scope real (no sobre-sirve)…
      for (const a of hrefScope) expect(fixture.scope.has(a)).toBe(true)
      // …y cubre el scope entero (no infra-sirve)
      expect(hrefScope.size).toBe(fixture.scope.size)
    }
  })
})
