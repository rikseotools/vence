// __tests__/guardrails/temarioRecacheTags.guardrail.test.ts
//
// Cambiar el temario en BD y que el usuario siga viendo lo viejo es un fallo SILENCIOSO: el
// script dice "✅ COMMIT", nadie mira la web, y la corrección no existe para quien la pidió.
//
// ── LA REGRESIÓN QUE FIJA (30/07/2026) ──────────────────────────────────────
// `verify:scope apply` recortó el Tema 22 de auxiliar_administrativo_sms (8 artículos fuera de
// programa) y `recache` purgó la PÁGINA del temario y el tag `temario`… pero no `test-config`,
// que es de donde come el selector «🔧 Artículos» — la pantalla exacta en la que la usuaria vio
// el defecto. Producción siguió ofreciendo los 27 artículos viejos después del commit. El
// runbook mandaba invalidar «temario/test-counts» desde hacía meses; estaba escrito en prosa y
// no se cumplía, que es la misma lección del fallo de Cantabria que originó `temario-recache`.
//
// Este guardarraíl comprueba el CABLEADO, no el efecto: que los tags que declara el recache
// existan de verdad en el endpoint que los despacha (si no, la llamada devuelve 400 y se pierde
// en el `catch {}`), y que sigan cubriendo lo que un cambio de `topic_scope` altera.

import fs from 'fs'
import path from 'path'

const REPO = path.join(__dirname, '..', '..')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TAGS_TEMARIO, REPETICIONES } = require(path.join(REPO, 'scripts', 'lib', 'temario-recache.cjs'))

const leer = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8')

describe('guardarraíl — el recache del temario invalida lo que de verdad cambia', () => {
  test('cubre el selector de artículos y los contadores, no solo la página del temario', () => {
    // `test-config` sirve /api/v2/test-config/{articles,sections,essential-articles} — el selector.
    // `test-counts` sirve los contadores por tema. Los dos dependen de `topic_scope`.
    for (const tag of ['temario', 'teoria', 'test-config', 'test-counts']) {
      expect(`${tag} debe estar en TAGS_TEMARIO (hoy: ${TAGS_TEMARIO.join(', ')})`)
        .toBe(`${TAGS_TEMARIO.includes(tag) ? tag : 'FALTA:' + tag} debe estar en TAGS_TEMARIO (hoy: ${TAGS_TEMARIO.join(', ')})`)
    }
  })

  test('todos los tags declarados EXISTEN en /api/admin/revalidate (si no, 400 silencioso)', () => {
    const route = leer('app/api/admin/revalidate/route.ts')
    const bloque = route.slice(route.indexOf('const VALID_TAGS'), route.indexOf('] as const'))
    const desconocidos = TAGS_TEMARIO.filter((t: string) => !bloque.includes(`'${t}'`))
    expect(`tags no declarados en VALID_TAGS: ${desconocidos.join(', ') || 'ninguno'}`)
      .toBe('tags no declarados en VALID_TAGS: ninguno')
  })

  test('los endpoints del selector siguen cacheando bajo el tag que purgamos', () => {
    // Si alguien cambia el tag del selector y no toca el recache, la purga deja de alcanzarlo.
    const queries = leer('lib/api/test-config/queries.ts')
    expect(queries.includes("'test-config'")).toBe(true)
    expect(TAGS_TEMARIO).toContain('test-config')
  })

  test('la invalidación se repite: es POR INSTANCIA, una sola llamada no las alcanza todas', () => {
    expect(REPETICIONES).toBeGreaterThanOrEqual(3)
  })

  test('el recache llama al endpoint de tags (no solo a purge-cache de rutas)', () => {
    const src = leer('scripts/lib/temario-recache.cjs')
    expect(src.includes('/api/admin/revalidate')).toBe(true)
    // …y avisa cuando NO puede hacerlo, en vez de callarse: un recache que no invalida y no
    // se queja es indistinguible de uno que funcionó.
    expect(src.includes('sin CRON_SECRET')).toBe(true)
  })
})
