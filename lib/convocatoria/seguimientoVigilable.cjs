// lib/convocatoria/seguimientoVigilable.cjs — lógica PURA que decide si una `seguimiento_url`
// es REALMENTE vigilable por el cron. Sin BD, sin red.
//
// ## El fallo que motiva esto (26/07/2026, cabo de T-114)
//
// `check-seguimiento` hashea el HTML **servido**, sin ejecutar JavaScript. Una SPA (o una página
// de redirección, o un "página en desuso", o un WAF que responde 200 con cuerpo de error)
// devuelve `200 OK` con un shell que **no cambia nunca**. El cron guarda ese hash tan contento,
// `seguimiento_change_status` se queda en `'ok'`, el panel se ve verde... y no estamos vigilando
// NADA. Es el mismo falso negativo silencioso que persigue `seguimientoUrlSalud`, pero por una
// causa distinta: allí la URL apunta al sitio equivocado; aquí apunta al sitio correcto y el
// contenido no llega. Y es PEOR, porque la URL parece impecable a ojo humano.
//
// Caso raíz: al repuntar las 9 de T-114 se descartaron a mano `empleo.eprinsa.es` (Córdoba),
// `jgpa.convoca.online` (Asturias) y `sede.dipujaen.es` (Jaén) porque `curl` las devolvía sin el
// texto del proceso. Esa comprobación vivía solo en la cabeza de quien la hizo. Aquí baja a código.
//
// ## Por qué se mide el TEXTO EXTRAÍDO y no el HTML
//
// El tamaño del HTML no dice nada: `bombero-barcelona` sirve **374 KB** de HTML y **593 chars**
// de texto. Lo que importa es lo que queda tras quitar scripts/estilos/etiquetas, que es
// exactamente lo que el cron hashea (`extractRelevantText` → `normalizeForHash` → sha256) y lo
// que ya persiste en `convocatoria_seguimiento_checks.content_preview` (primeros 2000 chars).
// Por eso el detector puede ser DB-only: la evidencia ya está guardada en cada pasada.
//
// ## Umbrales (CALIBRADOS 26/07/2026 sobre las 492 fuentes con check real, no inventados)
//
// De las **428** que responden HTTP 2xx: solo **15** bajan de 600 chars de texto, y las 15 son
// defectuosas de verdad (shell de SPA, "Redireccionando...", "Request Rejected", "Página en
// desuso. Por favor, acceda a través de la siguiente URL"). La banda **600–1499** son 23 y es
// MIXTA: hay páginas reales cortas (edictos de Granada, ofertas de Soria) mezcladas con logins y
// "An error has occurred". Por eso:
//
//   · < 600 con HTTP 2xx  → `error`: ciega y SILENCIOSA. Accionable.
//   · 600–1499            → `warn` : cola de revisión, no pinga el badge en rojo.
//   · >= 1500             → `ok`   : mismo umbral que `isBlockedPage` en seguimiento-fetch.ts
//                                    ("una ficha real tiene miles de chars"). Constante alineada
//                                    a propósito: si un día se afina, se afina en los dos sitios.
//
// Marcar todo lo que huele mal reproduciría el error de `hash_change` (bandeja ruidosa = bandeja
// ignorada, ver T-047/T-050). Solo la señal limpia es accionable.
//
// ## LO QUE ESTE DETECTOR NO CAZA (medido, no supuesto)
//
// Una SPA con MUCHO armazón estático pasa el umbral y se da por vigilable aunque esté igual de
// ciega. Caso medido el 26/07: `jgpa.convoca.online` (Junta General de Asturias) sirve **6.040
// chars** de menús, ayuda y avisos legales, y **ni una** mención al proceso — el hash queda tan
// congelado como en un shell vacío, pero por longitud parece sana.
//
// Por eso `verificarUrlCandidata` existe y por eso el script de repunte pide `--anclas`: en el
// momento de ESCRIBIR sí sabemos qué proceso debería mencionar la página, y ahí la ceguera se caza
// aunque el armazón sea grande. En el detector nocturno no lo sabemos (la denominación de la
// oposición no tiene por qué aparecer literal en su portal), así que se asume el punto ciego a
// cambio de cero falsos positivos.
//
// La señal que SÍ lo cerraría es el **hash inmóvil**: una fuente cuyo `content_hash` no cambia en N
// checks mientras su convocatoria avanza. Está pendiente en T-125 — necesita definir "avanza" sin
// convertirlo en otra bandeja ruidosa.
//
// JS plano (no .ts) a propósito: `scripts/health-sweep.cjs` lo requiere con `node` pelado y el
// wrapper `seguimientoVigilable.ts` lo reexporta → una sola fuente de verdad (misma convención
// que `seguimientoUrlSalud.cjs` y `lib/backlog/pushGuard.cjs`).

/** Texto por debajo del cual una respuesta HTTP 2xx no puede estar vigilando nada. */
const UMBRAL_CIEGA = 600

/** Texto por debajo del cual la respuesta es sospechosa pero puede ser una página real corta. */
const UMBRAL_DUDOSO = 1500

/**
 * Normaliza para BUSCAR PATRONES (no para medir): minúsculas, sin acentos, sin el carácter de
 * reemplazo `�`, y **sin espacios ni puntuación**.
 *
 * Por qué tan agresivo: estos portales llegan con la codificación rota y el extractor del cron
 * borra las entidades HTML (`.replace(/&[a-z]+;/gi, ' ')`), así que "Página" acaba siendo
 * "P gina" y "través" → "trav s" (casos reales: `enfermero-sms`, `administrativo-diputacion-jaen`
 * "Electr nica", `auxiliar-administrativo-universidad-politecnica-cartagena` "Polit�cnica"). Un
 * patrón que dependa de tildes o de dónde caen los espacios falla justo en las páginas defectuosas,
 * que son las que venimos a cazar. Comparando sobre el texto aplastado, "P gina en desuso",
 * "Página en desuso" y "PAGINA  EN  DESUSO" son la misma cadena.
 */
function aplastar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/�/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Cuerpos que llegan con HTTP 200 y NO son la página que creemos. Cada patrón se validó contra un
// caso real observado en `convocatoria_seguimiento_checks` (26/07/2026) y se compara sobre el texto
// APLASTADO (ver `aplastar`), por eso van sin espacios ni tildes. Dan un `motivo` concreto en vez
// del genérico "hay poco texto", que es lo que hace accionable el hallazgo.
const PATRONES_CUERPO_FALSO = [
  {
    nivel: 'bloqueo_waf',
    // `isBlockedPage` (seguimiento-fetch.ts) no reconoce "request rejected" → auxiliar-administrativo-diputacion-bizkaia
    re: /requestrejected|accessdenied|forbidden|youdonthavepermission|requestblocked|captcha|areyouarobot/,
    motivo: 'el servidor responde 200 pero el cuerpo es un bloqueo de WAF, no la página',
  },
  {
    nivel: 'pagina_en_desuso',
    // enfermero-sms: "SMS … P gina en desuso. Por favor, acceda a trav s de la siguiente URL: https://sed…"
    // (la tilde ya viene perdida en el propio content_preview — de ahí el `.?`)
    re: /p.?ginaendesuso|estap.?ginahasidotrasladada|accedaatrav.?sdelasiguienteurl/,
    motivo: 'la propia página declara estar EN DESUSO y remite a otra URL — vigilamos una página muerta',
  },
  {
    nivel: 'redireccion_sin_destino',
    // bombero-sepei-caceres: "EmpleoDip Redireccionando..."
    re: /redireccionando|redirigiendo|redirecting/,
    motivo: 'la respuesta es una página de redirección por JS que nunca llega a destino',
  },
  {
    nivel: 'error_aplicacion',
    // bombero-bilbao: "An error has occurred :-("; enfermero-ses: "Extremadura Salud - Error"
    re: /anerrorhasoccurred|sehaproducidounerror|errorinternodelservidor|internalservererror/,
    motivo: 'el cuerpo es una pantalla de error de la aplicación, no la página de convocatorias',
  },
]

/**
 * Ventana de CABECERA: cuántos caracteres del texto extraído se consideran "el titular" de la
 * página (`<title>` + h1 + primer encabezado). Medido sobre los `content_preview` reales: el
 * extractor del cron emite el título el primero, así que 220 chars cubren título + h1 con margen
 * y **no** llegan al cuerpo (donde una palabra suelta como "error" no significa nada).
 */
const UMBRAL_CABECERA = 220

/**
 * Patrones que solo son concluyentes **en la cabecera**, y que por eso se evalúan sin importar lo
 * larga que sea la página.
 *
 * ## Por qué existen (T-165, 27/07/2026)
 *
 * `PATRONES_CUERPO_FALSO` solo se miran cuando el texto es corto (`< UMBRAL_DUDOSO`), y con una
 * razón buena escrita arriba: en una ficha real de miles de caracteres la palabra "error" puede
 * salir en cualquier parte. La consecuencia no buscada es que **la página de error RICA pasa por
 * sana**: sirve el menú entero del portal, supera los umbrales y el detector la da por vigilable.
 * Casos medidos ese día sobre las 123 oposiciones ACTIVAS, todos con HTTP 200 y el panel en verde:
 *
 *   · `tcae-extremadura`            → "Extremadura Salud - Error No se encontr la p gina
 *                                      [oposiciones] solicitada" + 81 KB de menús de salud
 *   · `subalterno-parlamento-andalucia` → "Parlamento de Andaluc a P gina de error" + 47 KB
 *   · `tcae-galicia` / `celador-galicia` → "Sergas - Servizo de autenticaci n ou identificaci n
 *                                      de usuarios" — 991 KB de MURO DE LOGIN
 *   · `auxiliar-administrativo-extremadura` → "Portal Empleado … Área personal" (login, 168 KB)
 *
 * Ninguno listará jamás una convocatoria, y ninguno lo decía el detector: 0 hallazgos.
 *
 * La ventana de cabecera es lo que mantiene la precisión. Un tablón de verdad no se TITULA
 * "Página de error" ni "Servizo de autenticación": si el marcador está en el titular, la página
 * ES eso. En el cuerpo no se evalúan (un tablón legítimo puede enlazar "acceso con certificado
 * electrónico" en su pie sin dejar de ser un tablón).
 */
const PATRONES_CABECERA_FALSA = [
  {
    nivel: 'pagina_no_encontrada',
    // tcae-extremadura: "Extremadura Salud - Error No se encontr la p gina [oposiciones] solicitada"
    // aux-admin-ayuntamiento-salamanca: "404 - Ayto Salamanca" (además con HTTP 404, ya visible)
    // juntaex: "Contenido no encontrado - Juntaex.es"
    // correos-personal-operativo (27/07/2026): "¡Vaya! Parece que no hemos podido encontrar
    // la página que buscas". El sitio de Correos responde 200 con esa página para CUALQUIER
    // ruta desconocida (catch-all), así que su `programa_url` —el enlace más oficial de la
    // landing— llevaba a un error sin que nada lo dijera. Misma familia, otra redacción.
    re: /noseencontr.?lap.?gina|p.?ginanoencontrada|nohemospodidoencontrarlap.?gina|contenidonoencontrado|pagenotfound|error404|404error/,
    motivo:
      'el TITULAR de la página dice que el contenido no existe: es un 404 servido con 200, ' +
      'nunca listará una convocatoria (y el hash queda congelado para siempre)',
  },
  {
    nivel: 'pagina_error',
    // subalterno-parlamento-andalucia: "Parlamento de Andaluc a P gina de error"
    re: /p.?ginadeerror|paginadeerror|errorpage/,
    motivo:
      'el TITULAR de la página es una pantalla de error del portal, no el tablón de convocatorias',
  },
  {
    nivel: 'muro_login',
    // tcae-galicia / celador-galicia: "Sergas - Servizo de autenticaci n ou identificaci n de usuarios"
    // SES Extremadura: "Portal de Selecci n de Personal … Acceso Iniciar sesi n DNIe / Certificado"
    re: /servizodeautenticaci|serviciodeautenticaci|identificaci.?ndeusuarios|iniciarsesi.?ncondnie|accesoalportalpuedeacceder/,
    motivo:
      'el TITULAR es un muro de autenticación: el contenido vive detrás del login y el cron ' +
      'solo ve la pantalla de acceso — nunca verá una convocatoria nueva',
  },
  {
    nivel: 'ficha_de_catalogo',
    // Caso RAÍZ de T-165 (agrupacion-profesional-servicios-publicos-carm): la ficha del CUERPO
    // en vez del tablón de convocatorias. 14.872 chars de "TITULACIÓN REQUERIDA: Sin exigencia".
    // Reincidente: `auxiliar-administrativo-carm` seguía en "Ficha de Oposición" el 27/07.
    re: /fichadelcuerpo|fichadeoposici|fichadelaconvocatoria|titulaci.?nrequerida/,
    motivo:
      'el TITULAR es la FICHA de un cuerpo/convocatoria concreta del catálogo, no el listado: ' +
      'describe lo que ya existe y no cambia cuando se convoca un proceso nuevo',
  },
]

/**
 * ¿Puede el cron vigilar de verdad lo que hay en esta URL?
 *
 * @param {object} entrada
 * @param {number|null|undefined} entrada.httpStatus  código HTTP del último check (0 si falló el fetch)
 * @param {string|null|undefined} entrada.error       `error_message` del último check, si lo hubo
 * @param {string|null|undefined} entrada.texto       TEXTO EXTRAÍDO (no el HTML). En el detector
 *   se le pasa `content_preview`, que son los primeros 2000 chars ya limpios.
 * @param {boolean} [entrada.textoTruncado]  true si `texto` viene recortado (preview de 2000). Si
 *   está al tope, sabemos que la página tiene AL MENOS eso → nunca es ciega.
 * @returns {{vigilable:boolean, nivel:string, severidad:'error'|'warn'|'ok', motivo:string}}
 */
function clasificarVigilancia(entrada) {
  const { httpStatus, error, texto } = entrada || {}
  const t = typeof texto === 'string' ? texto.trim() : ''
  const status = typeof httpStatus === 'number' ? httpStatus : 0
  const httpOk = status >= 200 && status < 300

  // 1) Fallos RUIDOSOS: ya los ve el sistema (`seguimiento_change_status='error'`, panel de
  //    seguimiento). No son el problema que ataca este módulo — se informan, pero como `warn`
  //    para no duplicar en el badge algo que ya está a la vista en otro sitio.
  if (!httpOk || error) {
    return {
      vigilable: false,
      nivel: 'fetch_error',
      severidad: 'warn',
      motivo: error
        ? `el último check falló (${String(error).slice(0, 60)}) — visible, no silencioso`
        : `el último check devolvió HTTP ${status} — visible, no silencioso`,
    }
  }

  // 2) HTTP 200 y el TITULAR de la página dice que no es una página de convocatorias (404 servido
  //    con 200, pantalla de error, muro de login, ficha de catálogo). Se evalúa SIEMPRE, sin
  //    importar la longitud, porque el fallo que ataca es justo el contrario: páginas RICAS que
  //    superan todos los umbrales. La precisión la da la ventana (ver PATRONES_CABECERA_FALSA).
  const cabecera = aplastar(t.slice(0, UMBRAL_CABECERA))
  for (const p of PATRONES_CABECERA_FALSA) {
    if (p.re.test(cabecera)) {
      return { vigilable: false, nivel: p.nivel, severidad: 'error', motivo: p.motivo }
    }
  }

  // 3) HTTP 200 con un cuerpo que NO es la página. Esto sí es silencioso.
  //    Solo se evalúa sobre respuestas cortas: una ficha real de miles de chars puede contener
  //    la palabra "error" en cualquier parte sin ser una pantalla de error.
  if (t.length < UMBRAL_DUDOSO) {
    const aplastado = aplastar(t)
    for (const p of PATRONES_CUERPO_FALSO) {
      if (p.re.test(aplastado)) {
        return { vigilable: false, nivel: p.nivel, severidad: 'error', motivo: p.motivo }
      }
    }
  }

  // 4) HTTP 200 y casi nada de texto: shell de SPA / contenido cargado por JS.
  if (t.length < UMBRAL_CIEGA) {
    return {
      vigilable: false,
      nivel: 'shell_sin_contenido',
      severidad: 'error',
      motivo:
        `responde 200 pero solo ${t.length} caracteres de texto (umbral ${UMBRAL_CIEGA}): el contenido ` +
        'se carga por JavaScript y el cron no lo ejecuta → el hash queda congelado y la fuente está ciega',
    }
  }

  // 5) Banda mixta: sospechosa, pero hay páginas reales cortas aquí. Cola de revisión.
  if (t.length < UMBRAL_DUDOSO) {
    return {
      vigilable: false,
      nivel: 'contenido_dudoso',
      severidad: 'warn',
      motivo:
        `responde 200 con ${t.length} caracteres de texto (por debajo de ${UMBRAL_DUDOSO}): puede ser una ` +
        'página real corta o un contenedor sin contenido — revisar a mano',
    }
  }

  return { vigilable: true, nivel: 'ok', severidad: 'ok', motivo: 'contenido suficiente para vigilar' }
}

/**
 * Variante para el momento de ESCRIBIR una `seguimiento_url` nueva (script de repunte): además
 * del contenido, exige que aparezcan los anclajes del proceso (denominación, nº de plazas,
 * referencia de boletín…). Que la página tenga texto no significa que sea LA página.
 *
 * @param {object} entrada  lo mismo que `clasificarVigilancia`, más:
 * @param {string[]} [entrada.anclas]  cadenas que deben aparecer (se compara sin acentos ni caja).
 *   Basta con que aparezca UNA: los portales rara vez repiten todos los datos.
 * @returns {{vigilable:boolean, nivel:string, severidad:'error'|'warn'|'ok', motivo:string,
 *            anclasEncontradas:string[]}}
 */
function verificarUrlCandidata(entrada) {
  const base = clasificarVigilancia(entrada)
  const anclas = Array.isArray(entrada && entrada.anclas) ? entrada.anclas.filter(Boolean) : []
  if (!base.vigilable || anclas.length === 0) {
    return { ...base, anclasEncontradas: [] }
  }

  const norm = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  const heno = norm(entrada.texto)
  const encontradas = anclas.filter((a) => heno.includes(norm(a)))

  if (encontradas.length === 0) {
    return {
      vigilable: false,
      nivel: 'sin_anclas',
      severidad: 'error',
      motivo:
        'la página tiene contenido pero NO menciona ninguno de los anclajes del proceso ' +
        `(${anclas.join(' · ')}) — probablemente no es la ficha de esta convocatoria`,
      anclasEncontradas: [],
    }
  }
  return { ...base, anclasEncontradas: encontradas }
}

/**
 * ¿Se puede ESCRIBIR esta URL como `seguimiento_url`? Separa la política del diagnóstico para
 * poder testearla: el script de repunte no decide nada por su cuenta.
 *
 * La banda `contenido_dudoso` (200 con poco texto) se puede aceptar **pidiéndolo a mano**, porque
 * para algunas entidades el mejor destino posible cae ahí — el índice de empleo de la Diputación
 * de Zamora sirve ~1.300 chars y no hay página por proceso para su convocatoria; cambiar el
 * dominio raíz (que es CIEGO) por ese índice es una mejora real. La banda `error` (shell de SPA,
 * WAF, "página en desuso", `sin_anclas`) **no se puede forzar por ningún medio**: si se pudiera,
 * el guardarraíl no serviría de nada.
 *
 * @param {{vigilable:boolean, nivel:string}} diag  salida de `verificarUrlCandidata`
 * @param {{aceptarDudoso?:boolean}} [opts]
 * @returns {{escribir:boolean, forzado:boolean, motivo:string}}
 */
function decidirEscritura(diag, opts) {
  const aceptarDudoso = !!(opts && opts.aceptarDudoso)
  if (!diag || typeof diag !== 'object') {
    return { escribir: false, forzado: false, motivo: 'sin diagnóstico' }
  }
  if (diag.vigilable) return { escribir: true, forzado: false, motivo: 'vigilable' }
  if (aceptarDudoso && diag.nivel === 'contenido_dudoso') {
    return { escribir: true, forzado: true, motivo: 'banda dudosa aceptada explícitamente' }
  }
  return { escribir: false, forzado: false, motivo: `rechazada por ${diag.nivel}` }
}

/** Cuerpos que dicen EXPLÍCITAMENTE que no soportan este navegador (sniffing del sitio). */
const RECHAZA_NAVEGADOR =
  /navegador no (es )?soportado|navegador no compatible|browser is not supported|unsupported browser|habilita javascript|enable javascript/i

/**
 * ¿Aporta algo descargar esta fuente con navegador (headless) en vez de con HTTP plano?
 *
 * Núcleo COMPARTIDO por la sonda (`sim-headless-aporta.cjs`) y por la herramienta que ajusta
 * `fetcher_type` (`ajustar-fetcher-type.cjs`): si cada una tuviera su criterio, una podría medir
 * "no aporta" y la otra revertir por otra regla. El runbook `salud-radar.md` lleva avisando desde
 * el 16/07 de que **marcar `headless` no es un arreglo: hay que COMPROBAR que devuelve contenido**.
 *
 * Umbral (`1.5x` Y `+500` chars): medido el 26/07 sobre las 67 fuentes marcadas — 12 aportan, 47 no
 * y 7 son ciegas por ambas vías. Exigir las dos condiciones evita contar como "aporta" una
 * diferencia porcentual grande sobre textos minúsculos (444 vs 40 chars sigue siendo un armazón).
 *
 * @param {{statusCurl?:number, textoCurl?:string, statusHeadless?:number, textoHeadless?:string,
 *          errorCurl?:string, errorHeadless?:string}} m  medidas de ambas vías
 * @returns {{veredicto:'aporta'|'no_aporta'|'rechaza_bot'|'ambos_ciegos', ganancia:number, motivo:string}}
 */
function veredictoHeadless(m) {
  const tc = String((m && m.textoCurl) || '')
  const th = String((m && m.textoHeadless) || '')
  const ganancia = th.length - tc.length

  if (RECHAZA_NAVEGADOR.test(th)) {
    return {
      veredicto: 'rechaza_bot',
      ganancia,
      motivo: 'la web declara que no soporta el navegador y no monta los datos',
    }
  }

  const dc = clasificarVigilancia({ httpStatus: m.statusCurl, error: m.errorCurl, texto: tc })
  const dh = clasificarVigilancia({ httpStatus: m.statusHeadless, error: m.errorHeadless, texto: th })
  if (!dc.vigilable && !dh.vigilable) {
    return {
      veredicto: 'ambos_ciegos',
      ganancia,
      motivo: `ninguna vía sirve contenido (curl: ${dc.nivel} · headless: ${dh.nivel}) — es un hueco con nombre, y cambiar el fetcher NO lo arregla`,
    }
  }

  if (th.length > tc.length * 1.5 && ganancia > 500) {
    return { veredicto: 'aporta', ganancia, motivo: `el headless entrega ${ganancia} caracteres más de texto útil` }
  }
  return {
    veredicto: 'no_aporta',
    ganancia,
    motivo: `el headless entrega ${ganancia >= 0 ? '+' : ''}${ganancia} caracteres frente al fetch plano: no compra nada`,
  }
}

/**
 * Dado el veredicto, ¿qué `fetcher_type` debería tener la fuente y se puede escribir sin criterio
 * humano? Separado de la medición para poder testearlo sin red.
 *
 * Solo se automatiza el caso INEQUÍVOCO (`no_aporta` estando en `headless`): revertir a `http`
 * ahorra una invocación de Lambda por pasada sin perder nada, porque se ha MEDIDO que el texto es
 * el mismo. Los demás casos NO se tocan:
 *   · `ambos_ciegos` — el problema es la URL, no el fetcher; cambiarlo enmascara.
 *   · `rechaza_bot`  — necesita criterio (otra URL, u otro navegador), no un flag.
 *   · `aporta`       — está bien como está.
 *
 * @returns {{cambiar:boolean, destino:string|null, motivo:string}}
 */
function decidirFetcherType(veredicto, actual) {
  if (veredicto === 'no_aporta' && actual === 'headless') {
    return {
      cambiar: true,
      destino: 'http',
      motivo: 'medido: el headless no aporta texto — revertir ahorra una invocación por pasada',
    }
  }
  // PROMOCIÓN (T-453, 01/08/2026). El caso simétrico del anterior y también inequívoco: se ha
  // MEDIDO que el navegador entrega texto que el fetch plano no ve, y la fuente está en `http`,
  // así que hoy el cron la hashea ciega.
  //
  // Faltaba, y el hueco tenía consecuencias: el sistema sabía DEGRADAR a `http` pero no SUBIR a
  // `headless`, y `repuntar-url.cjs` medía siempre por HTTP, de modo que rechazaba por
  // «invigilable» justo la URL buena de un portal SPA. Una fuente que solo se ve con navegador
  // quedaba invigilable para siempre. Medido ese día: **13 oposiciones ACTIVAS** con `http` y el
  // seguimiento en `error`, y solo 20 de 2.658 en `headless` — no porque no hiciera falta, sino
  // porque no había camino para llegar.
  if (veredicto === 'aporta' && actual !== 'headless') {
    return {
      cambiar: true,
      destino: 'headless',
      motivo: 'medido: el navegador ve contenido que el fetch plano no — en `http` el cron la hashea ciega',
    }
  }
  if (veredicto === 'ambos_ciegos') {
    return { cambiar: false, destino: null, motivo: 'hueco con nombre: hay que arreglar la URL, no el fetcher' }
  }
  if (veredicto === 'rechaza_bot') {
    return { cambiar: false, destino: null, motivo: 'la web rechaza el navegador: exige criterio humano' }
  }
  return { cambiar: false, destino: null, motivo: 'el headless aporta: dejar como está' }
}

/**
 * Cabeceras EXACTAS del cron (`backend/src/check-seguimiento/seguimiento-fetch.ts`). Quien vaya a
 * escribir una `seguimiento_url` tiene que comprobarla **con estas**, no con las de curl por
 * defecto: hay portales que responden 200 a un navegador y 403 al UA de un bot, y al revés.
 * Si un día cambian allí, cambian aquí.
 */
const CABECERAS_CRON = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'es-ES,es;q=0.9',
}

/**
 * Extrae el texto relevante de un HTML **igual que el cron** (`extractRelevantText`): lo que se
 * mide y se hashea es esto, no el HTML. Copia deliberada y comentada: el script vive en el repo
 * raíz y el cron en el proyecto `backend/`, que no comparten build.
 */
function extraerTextoRelevante(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

module.exports = {
  clasificarVigilancia,
  verificarUrlCandidata,
  decidirEscritura,
  veredictoHeadless,
  decidirFetcherType,
  extraerTextoRelevante,
  aplastar,
  CABECERAS_CRON,
  UMBRAL_CIEGA,
  UMBRAL_DUDOSO,
  UMBRAL_CABECERA,
  PATRONES_CABECERA_FALSA,
  PATRONES_CUERPO_FALSO,
}
