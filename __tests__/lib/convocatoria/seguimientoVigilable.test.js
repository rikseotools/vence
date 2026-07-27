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

describe('decidirEscritura — política de escritura (el guardarraíl del repunte)', () => {
  const { decidirEscritura } = require('../../../lib/convocatoria/seguimientoVigilable.cjs')

  it('escribe sin más lo que es vigilable', () => {
    const d = decidirEscritura({ vigilable: true, nivel: 'ok' })
    expect(d).toMatchObject({ escribir: true, forzado: false })
  })

  it('la banda dudosa NO se escribe por defecto', () => {
    expect(decidirEscritura({ vigilable: false, nivel: 'contenido_dudoso' }).escribir).toBe(false)
  })

  it('la banda dudosa SÍ se escribe si se pide a mano, y queda marcada como forzada', () => {
    const d = decidirEscritura({ vigilable: false, nivel: 'contenido_dudoso' }, { aceptarDudoso: true })
    expect(d).toMatchObject({ escribir: true, forzado: true })
  })

  it('la banda CIEGA no se puede forzar por ningún medio (si se pudiera, esto no serviría)', () => {
    for (const nivel of [
      'shell_sin_contenido',
      'bloqueo_waf',
      'pagina_en_desuso',
      'redireccion_sin_destino',
      'error_aplicacion',
      'sin_anclas',
      'fetch_error',
    ]) {
      expect(decidirEscritura({ vigilable: false, nivel }, { aceptarDudoso: true }).escribir).toBe(false)
    }
  })

  it('no revienta sin diagnóstico', () => {
    expect(decidirEscritura(null).escribir).toBe(false)
    expect(decidirEscritura(undefined, { aceptarDudoso: true }).escribir).toBe(false)
  })
})

// ── ¿Aporta algo el headless? Núcleo compartido por la sonda y por la herramienta ────────────
// Si cada una tuviera su criterio, una podría medir "no aporta" y la otra revertir por otra regla.
// Umbral calibrado el 26/07 sobre las 67 fuentes marcadas: 12 aportan, 47 no, 7 ciegas por ambas.
describe('veredictoHeadless — medir en vez de suponer', () => {
  const { veredictoHeadless, decidirFetcherType } = require('../../../lib/convocatoria/seguimientoVigilable.cjs')
  const texto = (n) => 'convocatoria de plazas administrativo '.repeat(Math.ceil(n / 38)).slice(0, n)

  it('aporta cuando el headless entrega bastante más texto (caso Jaén: 2.685 → 5.643)', () => {
    const v = veredictoHeadless({ statusCurl: 200, textoCurl: texto(2685), statusHeadless: 200, textoHeadless: texto(5643) })
    expect(v.veredicto).toBe('aporta')
    expect(v.ganancia).toBeGreaterThan(500)
  })

  it('NO aporta cuando entrega lo mismo (caso Asturias: 6.040 → 1.527)', () => {
    const v = veredictoHeadless({ statusCurl: 200, textoCurl: texto(6040), statusHeadless: 200, textoHeadless: texto(1527) })
    expect(v.veredicto).toBe('no_aporta')
  })

  it('un salto porcentual grande sobre textos minúsculos NO es aportar (Tenerife: 40 → 444)', () => {
    // 11x de ganancia relativa, pero 444 chars siguen siendo un armazón: por eso se exige +500 tb.
    const v = veredictoHeadless({ statusCurl: 200, textoCurl: texto(40), statusHeadless: 200, textoHeadless: texto(444) })
    expect(v.veredicto).toBe('ambos_ciegos')
  })

  it('ambos ciegos cuando ninguna vía sirve (IIPP, Zaragoza: fetch falla por las dos)', () => {
    const v = veredictoHeadless({ statusCurl: 0, errorCurl: 'fetch failed', textoCurl: '', statusHeadless: 0, errorHeadless: 'fetch failed', textoHeadless: '' })
    expect(v.veredicto).toBe('ambos_ciegos')
    expect(v.motivo).toMatch(/hueco con nombre/)
  })

  it('detecta que la web rechaza el navegador (caso Convoca, Asturias)', () => {
    const v = veredictoHeadless({ statusCurl: 200, textoCurl: texto(6040), statusHeadless: 200,
      textoHeadless: 'Este navegador no es soportado por Convoca. No hay datos a la vista' })
    expect(v.veredicto).toBe('rechaza_bot')
  })
})

describe('decidirFetcherType — qué se automatiza y qué NO', () => {
  const { decidirFetcherType } = require('../../../lib/convocatoria/seguimientoVigilable.cjs')

  it('revierte a http SOLO el caso inequívoco: no_aporta estando en headless', () => {
    expect(decidirFetcherType('no_aporta', 'headless')).toMatchObject({ cambiar: true, destino: 'http' })
  })

  it('no toca nada si ya está en http', () => {
    expect(decidirFetcherType('no_aporta', 'http').cambiar).toBe(false)
  })

  it('NO toca un hueco con nombre: el problema es la URL, y cambiar el fetcher lo enmascara', () => {
    const d = decidirFetcherType('ambos_ciegos', 'headless')
    expect(d.cambiar).toBe(false)
    expect(d.motivo).toMatch(/URL/)
  })

  it('NO decide sola cuando la web rechaza el navegador (exige criterio humano)', () => {
    expect(decidirFetcherType('rechaza_bot', 'headless').cambiar).toBe(false)
  })

  it('deja en paz lo que sí aporta', () => {
    expect(decidirFetcherType('aporta', 'headless').cambiar).toBe(false)
  })
})

// ── T-165: la página RICA que no es una página de convocatorias ────────────────
//
// El punto ciego que cierran estos tests: `PATRONES_CUERPO_FALSO` solo se evalúa por debajo de
// UMBRAL_DUDOSO, así que una pantalla de error / muro de login que además sirve el menú entero del
// portal (decenas de KB) pasaba por VIGILABLE y el panel se veía verde. Los textos de abajo son
// literales de `content_preview` en RDS el 27/07/2026 — con la codificación rota tal cual llega.
describe('clasificarVigilancia — cabecera que delata una página que no vigila nada (T-165)', () => {
  // Cola larga de menús del portal: lo que hace que estas páginas superen todos los umbrales.
  const menus =
    ' Inicio Centro de Salud Solicitar cita previa Recursos Problemas de Salud Temas de Interés ' +
    'Accesibilidad Mapa web Contacto Sugerencias Buscador Ciudadanía Profesionales Servicios Ayuda '
  const rico = (cabecera) => cabecera + menus.repeat(30)

  it('caza el 404 servido con 200 (tcae-extremadura, 81 KB de menús detrás)', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: rico('Extremadura Salud - Error No se encontr la p gina [oposiciones] solicitada X'),
    })
    expect(d.vigilable).toBe(false)
    expect(d.nivel).toBe('pagina_no_encontrada')
    expect(d.severidad).toBe('error')
  })

  it('caza la pantalla de error del portal (subalterno-parlamento-andalucia)', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: rico('Parlamento de Andaluc�a P�gina de error Facebook Twitter Youtube'),
    })
    expect(d.nivel).toBe('pagina_error')
    expect(d.severidad).toBe('error')
  })

  it('caza el muro de login aunque sirva 991 KB (tcae-galicia / celador-galicia, fides.sergas.es)', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: rico('Sergas - Servizo de autenticaci n ou identificaci n de usuarios ACCEDE Galego'),
    })
    expect(d.nivel).toBe('muro_login')
    expect(d.severidad).toBe('error')
  })

  it('caza la FICHA del catálogo en vez del tablón (caso raíz APSP CARM y aux-admin-carm)', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: rico('Ficha de Oposici n OFERTA PARTICIPAR GU A PARA OPOSITAR FICHA DE LA CONVOCATORIA'),
    })
    expect(d.nivel).toBe('ficha_de_catalogo')
    expect(d.severidad).toBe('error')
  })

  it('caza la ficha del CUERPO (el preview que dejó a APSP CARM sin vigilancia)', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: rico('FICHA DEL CUERPO/OPCI N TITULACI N REQUERIDA: Sin exigencia de titulaci n'),
    })
    expect(d.nivel).toBe('ficha_de_catalogo')
  })

  // ── Lo que NO debe marcar (la precisión vive aquí) ──────────────────────────
  it('NO marca el tablón bueno de CARM, que comparte menús con la ficha', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: rico(
        'Convocatorias de Procesos Selectivos OFERTA PARTICIPAR GU A PARA OPOSITAR LISTAS DE ' +
          'ESPERA NORMATIVA aqu : Convocatorias de Procesos Selectivos Buscar por Cuerpo y Oferta',
      ),
    })
    expect(d.vigilable).toBe(true)
  })

  it('NO marca un tablón real porque en su CUERPO aparezca "error" o el acceso con certificado', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto:
        'Convocatorias de empleo p blico Ayuntamiento de C rdoba ' +
        relleno(3000) +
        ' Si se produce un error en la solicitud, acceda con certificado electr nico o Cl@ve ' +
        'para iniciar sesi n en la sede',
    })
    expect(d.vigilable).toBe(true)
  })

  it('NO marca la sede que ofrece "Autenticación / Identificarse" en su cabecera (Valladolid)', () => {
    const d = clasificarVigilancia({
      httpStatus: 200,
      texto: rico('Empleo P blico | Sede Electr nica Autenticaci n Identificarse Tr mites'),
    })
    expect(d.vigilable).toBe(true)
  })

  it('no cambia el veredicto de las bandas por longitud que ya existían', () => {
    expect(clasificarVigilancia({ httpStatus: 200, texto: relleno(100) }).nivel).toBe('shell_sin_contenido')
    expect(clasificarVigilancia({ httpStatus: 200, texto: relleno(900) }).nivel).toBe('contenido_dudoso')
    expect(clasificarVigilancia({ httpStatus: 200, texto: relleno(5000) }).vigilable).toBe(true)
  })

  it('el fetch fallido sigue mandando sobre la cabecera (no duplica lo ya visible)', () => {
    const d = clasificarVigilancia({ httpStatus: 404, texto: rico('404 - Ayto Salamanca Inicio') })
    expect(d.nivel).toBe('fetch_error')
    expect(d.severidad).toBe('warn')
  })
})
