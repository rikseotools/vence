/**
 * @jest-environment node
 */
// El ORÁCULO del barrido de rutas (T-487): qué cuenta como «esta página está rota» cuando nadie
// ha escrito un escenario para ella. Sin esto, un recorredor visita 168 rutas y dice que todo va
// bien — que es exactamente el fallo que convierte una simulación en decorado.

import { juzgarVisita, severidadDe, resumen, MINIMO_TEXTO_VISIBLE, TEXTOS_PANTALLA_ERROR } from '@/lib/sim/oraculo'

const SANA = { url: '/x', status: 200, textoVisible: 'contenido de verdad '.repeat(20) }

describe('lo que un usuario llamaría ROTO', () => {
  it('5xx', () => {
    const j = juzgarVisita({ ...SANA, status: 503 })
    expect(j.veredicto).toBe('rota')
    expect(j.motivos[0]).toContain('503')
  })

  it('sin respuesta del servidor', () => {
    expect(juzgarVisita({ ...SANA, status: null }).veredicto).toBe('rota')
  })

  it('la pantalla de error de la app, por su texto REAL', () => {
    for (const t of TEXTOS_PANTALLA_ERROR) {
      expect(juzgarVisita({ ...SANA, textoVisible: `cabecera ${t} vuelve al inicio` }).veredicto).toBe('rota')
    }
  })

  // Un esqueleto de React sin datos pesa decenas de kB de marcado y CERO letras para el usuario:
  // es el fallo que un `content-length` no puede ver.
  it('responde 200 y no pinta nada', () => {
    const j = juzgarVisita({ ...SANA, textoVisible: 'x'.repeat(MINIMO_TEXTO_VISIBLE - 1) })
    expect(j.veredicto).toBe('rota')
    expect(j.motivos[0]).toContain('caracteres visibles')
  })

  it('el HTML llega bien pero una subpetición devuelve 5xx', () => {
    const j = juzgarVisita({ ...SANA, peticionesFallidas: [{ url: '/api/x', status: 500 }] })
    expect(j.veredicto).toBe('rota')
  })
})

describe('lo que hay que MIRAR, no lo que hay que declarar roto', () => {
  // Declarar roto un 404 legítimo (algo despublicado) llenaría el panel de rojos falsos, y un
  // panel que grita se deja de leer.
  it('404 en una ruta que existe en el código → sospechosa, no rota', () => {
    const j = juzgarVisita({ ...SANA, status: 404 })
    expect(j.veredicto).toBe('sospechosa')
    expect(j.motivos[0]).toContain('datos que faltan')
  })

  it('desajuste de hidratación (el contenido que baila, los botones sordos)', () => {
    const j = juzgarVisita({ ...SANA, erroresConsola: ['Warning: Text content does not match server-rendered HTML'] })
    expect(j.veredicto).toBe('sospechosa')
    expect(j.motivos[0]).toContain('hidratación')
  })

  it('errores de consola nuestros', () => {
    expect(juzgarVisita({ ...SANA, erroresConsola: ['TypeError: x is not a function'] }).veredicto).toBe('sospechosa')
  })
})

describe('lo que NO es señal (o el detector se ignora en una semana)', () => {
  it.each([
    ['ResizeObserver loop completed with undelivered notifications'],
    ['Failed to load resource: favicon.ico 404'],
    ['chrome-extension://abc/inject.js error'],
    ['Download the React DevTools for a better experience'],
  ])('%s → ok', (msg) => {
    expect(juzgarVisita({ ...SANA, erroresConsola: [msg] }).veredicto).toBe('ok')
  })

  // CALIBRACIÓN medida en la primera pasada real (02/08): 12 de 12 rutas salieron «sospechosas»
  // por el mismo 401 de /api/auth/token — la app preguntando «¿quién eres?» sin sesión. Un
  // detector que marca todo lo que mira se ignora en una semana.
  describe('el 401 de autenticación depende de CON QUÉ identidad se visita', () => {
    const MSG = 'Failed to load resource: the server responded with a status of 401 () [https://www.vence.es/api/auth/token]'

    it('anónimo → es por diseño, no es señal', () => {
      expect(juzgarVisita({ ...SANA, anonimo: true, erroresConsola: [MSG] }).veredicto).toBe('ok')
    })

    // No se silencia en bloque a propósito: con sesión, ese mismo 401 significa que la sesión no
    // se está enviando o no vale, y ese caso hay que conservarlo.
    it('CON sesión → sí es un defecto', () => {
      expect(juzgarVisita({ ...SANA, anonimo: false, erroresConsola: [MSG] }).veredicto).toBe('sospechosa')
    })

    it('el «Not signed in with the identity provider» de Google, ídem', () => {
      // Salía en 13 de 20 rutas de la segunda pasada real: sin esto el barrido marca el sitio
      // entero y deja de significar nada.
      const g = 'Not signed in with the identity provider.'
      expect(juzgarVisita({ ...SANA, anonimo: true, erroresConsola: [g] }).veredicto).toBe('ok')
      expect(juzgarVisita({ ...SANA, anonimo: false, erroresConsola: [g] }).veredicto).toBe('sospechosa')
    })

    it('el aviso de FedCM del widget de Google, ídem', () => {
      const g = '[GSI_LOGGER]: FedCM get() rejects with NetworkError: Error retrieving a token.'
      expect(juzgarVisita({ ...SANA, anonimo: true, erroresConsola: [g] }).veredicto).toBe('ok')
      expect(juzgarVisita({ ...SANA, anonimo: false, erroresConsola: [g] }).veredicto).toBe('sospechosa')
    })

    it('un 401 de otro endpoint NO se descarta ni yendo anónimo', () => {
      const otro = 'Failed to load resource: the server responded with a status of 401 () [https://www.vence.es/api/v2/tests]'
      expect(juzgarVisita({ ...SANA, anonimo: true, erroresConsola: [otro] }).veredicto).toBe('sospechosa')
    })
  })

  it('una página sana no genera motivos', () => {
    expect(juzgarVisita(SANA)).toMatchObject({ veredicto: 'ok', motivos: [], puntoCiego: false })
  })
})

describe('la meta-pregunta: ¿lo habría visto la observabilidad?', () => {
  // Si el barrido ve un fallo y no hay ni una señal, hoy nos habríamos enterado por un usuario.
  it('fallo visible SIN evento → punto ciego', () => {
    const j = juzgarVisita({ ...SANA, status: 500, eventos: [] })
    expect(j.puntoCiego).toBe(true)
    expect(j.motivos.some((m) => m.includes('PUNTO CIEGO'))).toBe(true)
  })

  it('fallo visible CON evento → está roto, pero lo vemos', () => {
    const j = juzgarVisita({ ...SANA, status: 500, eventos: [{ event_type: 'server_render_error', severity: 'error' }] })
    expect(j.veredicto).toBe('rota')
    expect(j.puntoCiego).toBe(false)
  })

  // Preguntarla siempre convertiría cada página sana en un «no se observó nada», que es cierto y
  // no significa nada.
  it('página sana sin eventos NO es punto ciego', () => {
    expect(juzgarVisita({ ...SANA, eventos: [] }).puntoCiego).toBe(false)
  })

  it('un evento en `info` no cuenta como haberlo observado', () => {
    expect(juzgarVisita({ ...SANA, status: 500, eventos: [{ event_type: 'x', severity: 'info' }] }).puntoCiego).toBe(true)
  })

  it('reutiliza la invariante que ya existía, no un criterio paralelo', () => {
    expect(juzgarVisita({ ...SANA, status: 500 }).invariantes[0].name).toBe('failure_was_observed')
  })
})

describe('severidad y resumen', () => {
  it('rota→error · sospechosa→warn · ok→info (un warn en error se deja de leer)', () => {
    expect(severidadDe(juzgarVisita({ ...SANA, status: 500 }))).toBe('error')
    expect(severidadDe(juzgarVisita({ ...SANA, status: 404 }))).toBe('warn')
    expect(severidadDe(juzgarVisita(SANA))).toBe('info')
  })

  it('el resumen separa rotas, sospechosas y puntos ciegos', () => {
    const r = resumen([
      juzgarVisita(SANA),
      juzgarVisita({ ...SANA, url: '/a', status: 500, eventos: [] }),
      juzgarVisita({ ...SANA, url: '/b', status: 404 }),
    ])
    expect(r).toMatchObject({ total: 3, ok: 1, rotas: 1, sospechosas: 1, puntosCiegos: 1 })
    expect(r.detalle.map((d) => d.url)).toEqual(['/a', '/b'])
  })
})
