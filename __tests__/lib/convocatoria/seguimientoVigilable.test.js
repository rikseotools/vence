// Tests del núcleo puro que decide si una `seguimiento_url` es REALMENTE vigilable.
//
// Los casos "reales" no son inventados: son muestras literales de
// `convocatoria_seguimiento_checks.content_preview` observadas en RDS el 26/07/2026 (las 15
// fuentes que responden HTTP 2xx con menos de 600 chars de texto). Si alguien afina los umbrales,
// estos tests dicen a quién le cambia la vida.

const {
  clasificarVigilancia,
  verificarUrlCandidata,
  UMBRAL_CIEGA,
  UMBRAL_DUDOSO,
} = require('../../../lib/convocatoria/seguimientoVigilable.cjs')

/** Texto de longitud n que no dispara ningún patrón de cuerpo falso. */
const relleno = (n) => 'convocatoria de plazas administrativo '.repeat(Math.ceil(n / 38)).slice(0, n)

describe('clasificarVigilancia — fallos RUIDOSOS (ya visibles, no son el objetivo)', () => {
  it('marca fetch_error como warn cuando el fetch falló', () => {
    const d = clasificarVigilancia({ httpStatus: 0, error: 'fetch failed', texto: '' })
    expect(d.vigilable).toBe(false)
    expect(d.nivel).toBe('fetch_error')
    expect(d.severidad).toBe('warn') // no `error`: ya sale como seguimiento_change_status='error'
  })

  it('marca fetch_error ante un HTTP 500 aunque no venga error_message', () => {
    const d = clasificarVigilancia({ httpStatus: 500, texto: '' })
    expect(d.nivel).toBe('fetch_error')
    expect(d.motivo).toContain('500')
  })

  it('un 403 tampoco es silencioso: es fetch_error', () => {
    // interior.gob.es (Ayudante IIPP) — WAF que responde 403 al UA del cron
    expect(clasificarVigilancia({ httpStatus: 403, texto: '' }).nivel).toBe('fetch_error')
  })
})

describe('clasificarVigilancia — ceguera SILENCIOSA (HTTP 200 que no vigila nada)', () => {
  it('shell de SPA: 200 con texto ridículo', () => {
    // auxiliar-administrativo-cabildo-tenerife: 40 chars sobre 6.905 de HTML
    const d = clasificarVigilancia({ httpStatus: 200, texto: 'Sede Electrónica del Cabildo de Tenerife' })
    expect(d.vigilable).toBe(false)
    expect(d.nivel).toBe('shell_sin_contenido')
    expect(d.severidad).toBe('error')
    expect(d.motivo).toMatch(/hash queda congelado|ciega/)
  })

  it('página de redirección que nunca llega', () => {
    // bombero-sepei-caceres: "EmpleoDip Redireccionando..."
    const d = clasificarVigilancia({ httpStatus: 200, texto: 'EmpleoDip Redireccionando...' })
    expect(d.nivel).toBe('redireccion_sin_destino')
    expect(d.severidad).toBe('error')
  })

  it('WAF que responde 200 con "Request Rejected" (lo que isBlockedPage NO reconoce)', () => {
    // auxiliar-administrativo-diputacion-bizkaia
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: 'Request Rejected The requested URL was rejected. Please consult with your administrator.',
    })
    expect(d.nivel).toBe('bloqueo_waf')
    expect(d.severidad).toBe('error')
  })

  it('página que declara estar EN DESUSO y remite a otra URL', () => {
    // enfermero-sms: el caso más flagrante — la fuente nos dice que está muerta y seguimos ahí
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto:
        'SMS - Servicio Murciano De Salud Página en desuso. Por favor, acceda a través de la siguiente URL: https://sede.carm.es',
    })
    expect(d.nivel).toBe('pagina_en_desuso')
    expect(d.severidad).toBe('error')
    expect(d.motivo).toMatch(/DESUSO/i)
  })

  it('pantalla de error de la aplicación servida con 200', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: 'open An error has occurred :-( Usual error causes You started the application from an IDE',
    })
    expect(d.nivel).toBe('error_aplicacion')
    expect(d.severidad).toBe('error')
  })
})

describe('clasificarVigilancia — banda de revisión y páginas sanas', () => {
  it(`entre ${UMBRAL_CIEGA} y ${UMBRAL_DUDOSO} es warn, no error (hay páginas reales cortas)`, () => {
    const d = clasificarVigilancia({ httpStatus: 200, texto: relleno(900) })
    expect(d.nivel).toBe('contenido_dudoso')
    expect(d.severidad).toBe('warn')
    expect(d.vigilable).toBe(false)
  })

  it(`a partir de ${UMBRAL_DUDOSO} es vigilable`, () => {
    const d = clasificarVigilancia({ httpStatus: 200, texto: relleno(UMBRAL_DUDOSO) })
    expect(d.vigilable).toBe(true)
    expect(d.severidad).toBe('ok')
  })

  it('el preview al tope (2000 chars) siempre es vigilable — es el caso normal', () => {
    expect(clasificarVigilancia({ httpStatus: 200, texto: relleno(2000) }).vigilable).toBe(true)
  })

  it('una ficha larga que MENCIONA "error" no se confunde con una pantalla de error', () => {
    const texto = relleno(1800) + ' subsanacion de errores materiales en la solicitud'
    expect(clasificarVigilancia({ httpStatus: 200, texto }).vigilable).toBe(true)
  })

  it('los límites son exactos (no off-by-one)', () => {
    expect(clasificarVigilancia({ httpStatus: 200, texto: relleno(UMBRAL_CIEGA - 1) }).nivel).toBe(
      'shell_sin_contenido',
    )
    expect(clasificarVigilancia({ httpStatus: 200, texto: relleno(UMBRAL_CIEGA) }).nivel).toBe(
      'contenido_dudoso',
    )
    expect(clasificarVigilancia({ httpStatus: 200, texto: relleno(UMBRAL_DUDOSO - 1) }).nivel).toBe(
      'contenido_dudoso',
    )
    expect(clasificarVigilancia({ httpStatus: 200, texto: relleno(UMBRAL_DUDOSO) }).nivel).toBe('ok')
  })

  it('no revienta con entradas nulas o basura', () => {
    expect(clasificarVigilancia(null).vigilable).toBe(false)
    expect(clasificarVigilancia({}).vigilable).toBe(false)
    expect(clasificarVigilancia({ httpStatus: 200, texto: null }).nivel).toBe('shell_sin_contenido')
  })
})

describe('verificarUrlCandidata — guardarraíl al ESCRIBIR una seguimiento_url nueva', () => {
  it('acepta una página con contenido que menciona el proceso', () => {
    const d = verificarUrlCandidata({
      httpStatus: 200,
      texto: relleno(1600) + ' Auxiliar Administrativo 55 plazas Ayuntamiento de Córdoba',
      anclas: ['Auxiliar Administrativo', '55 plazas'],
    })
    expect(d.vigilable).toBe(true)
    expect(d.anclasEncontradas).toContain('Auxiliar Administrativo')
  })

  it('compara sin acentos ni mayúsculas (los portales escriben como quieren)', () => {
    const d = verificarUrlCandidata({
      httpStatus: 200,
      texto: relleno(1600) + ' OPOSICION DE ADMINISTRATIVO EN LA DIPUTACION',
      anclas: ['oposición de administrativo'],
    })
    expect(d.vigilable).toBe(true)
  })

  it('RECHAZA una página con contenido que no habla de este proceso', () => {
    const d = verificarUrlCandidata({
      httpStatus: 200,
      texto: relleno(1800),
      anclas: ['Ayudante de Instituciones Penitenciarias'],
    })
    expect(d.vigilable).toBe(false)
    expect(d.nivel).toBe('sin_anclas')
    expect(d.severidad).toBe('error')
  })

  it('sin anclas se comporta igual que clasificarVigilancia (no inventa exigencias)', () => {
    const texto = relleno(1700)
    expect(verificarUrlCandidata({ httpStatus: 200, texto }).vigilable).toBe(
      clasificarVigilancia({ httpStatus: 200, texto }).vigilable,
    )
  })

  it('una URL ciega se rechaza aunque le pasen anclas', () => {
    const d = verificarUrlCandidata({
      httpStatus: 200,
      texto: 'Sede Electrónica',
      anclas: ['Administrativo'],
    })
    expect(d.vigilable).toBe(false)
    expect(d.nivel).toBe('shell_sin_contenido')
  })
})

describe('clasificarVigilancia — robustez ante codificación rota (mojibake)', () => {
  // Estos portales llegan con las tildes perdidas: el propio `content_preview` de RDS guarda
  // "P gina en desuso" y "Electr nica". Un patrón con tildes falla justo en las páginas malas.
  it('reconoce "P gina en desuso" con la tilde perdida (caso literal de enfermero-sms)', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: 'SMS - Servicio Murciano De Salud P gina en desuso. Por favor, acceda a trav s de la siguiente URL: https://sede.carm.es',
    })
    expect(d.nivel).toBe('pagina_en_desuso')
  })

  it('reconoce la variante con tildes correctas', () => {
    const d = clasificarVigilancia({ httpStatus: 200, texto: 'Página en desuso. Acceda a la nueva sede.' })
    expect(d.nivel).toBe('pagina_en_desuso')
  })

  it('tolera el carácter de reemplazo y los espacios de más', () => {
    const d = clasificarVigilancia({ httpStatus: 200, texto: 'P\uFFFDGINA   EN\tDESUSO' })
    expect(d.nivel).toBe('pagina_en_desuso')
  })

  it('sigue distinguiendo una ficha real que habla de "errores" sin ser pantalla de error', () => {
    const texto = relleno(1700) + ' plazo de subsanacion de errores'
    expect(clasificarVigilancia({ httpStatus: 200, texto }).vigilable).toBe(true)
  })
})

// ── Capa anti-DRIFT: el backend @Cron lleva una COPIA INLINE de esta lógica ─────────────────
// El backend NestJS (proyecto ./backend separado) no puede importar del `lib/` del frontend, así
// que `content-health-sweep.service.ts` reimplementa el clasificador. `content-sweep-parity`
// vigila que los KINDS no diverjan, pero no los NÚMEROS: si alguien afina un umbral aquí y no
// allí, el CLI y el @Cron nocturno marcarían cosas distintas EN SILENCIO. Es exactamente el
// fallo que dejó main en rojo en T-122, una capa más abajo. Esto lo hace imposible.
describe('paridad con el espejo inline del backend @Cron', () => {
  const fs = require('fs')
  const path = require('path')
  const BACKEND = fs.readFileSync(
    path.join(__dirname, '../../../backend/src/content-health-sweep/content-health-sweep.service.ts'),
    'utf8',
  )

  it('los umbrales son idénticos en las dos implementaciones', () => {
    expect(BACKEND).toContain(`const VIG_UMBRAL_CIEGA = ${UMBRAL_CIEGA};`)
    expect(BACKEND).toContain(`const VIG_UMBRAL_DUDOSO = ${UMBRAL_DUDOSO};`)
  })

  it('los patrones de cuerpo falso son idénticos (mismo nivel y misma regex)', () => {
    const { PATRONES_CUERPO_FALSO } = require('../../../lib/convocatoria/seguimientoVigilable.cjs')
    for (const p of PATRONES_CUERPO_FALSO) {
      expect(BACKEND).toContain(`nivel: '${p.nivel}'`)
      expect(BACKEND).toContain(p.re.source)
    }
  })

  it('el backend emite el kind y filtra por evidencia atribuible', () => {
    expect(BACKEND).toContain("'seguimiento_fuente_ciega'")
    // Sin este JOIN, una oposición recién repuntada se juzga con la evidencia de su URL anterior.
    expect(BACKEND).toMatch(/checked_url\s*=\s*o\.seguimiento_url/)
  })

  it('el gemelo CLI también filtra por evidencia atribuible', () => {
    const SCRIPT = fs.readFileSync(path.join(__dirname, '../../../scripts/health-sweep.cjs'), 'utf8')
    expect(SCRIPT).toContain('seguimiento_fuente_ciega')
    expect(SCRIPT).toMatch(/checked_url\s*=\s*o\.seguimiento_url/)
  })
})
