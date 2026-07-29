/**
 * @jest-environment node
 */
// Reglas del banner de instalación de la PWA. Puras: sin DOM, sin red, sin reloj real.
//
// Se testea aquí y no en el componente porque las reglas son lo que puede estar mal
// ("¿a quién se le enseña?"), y el componente es solo pintarlo. La fecha se inyecta, así que
// los casos de "cuánto dura el descarte" son deterministas en vez de depender del día.

import {
  esIosSafari,
  decidirBanner,
  silenciarHasta,
  esMovil,
  leerSilencio,
  SILENCIO_MS,
  CLAVE_SILENCIO,
} from '@/lib/pwa/installBanner'

const AHORA = new Date('2026-07-28T12:00:00Z').getTime()
const DIA = 24 * 60 * 60 * 1000

/** Caso base: móvil, sin instalar, con prompt disponible y sin descartes → se muestra. */
const base = {
  yaInstalada: false,
  esMovil: true,
  promptDisponible: true,
  silenciadoHasta: null as number | null,
  ahora: AHORA,
}

describe('decidirBanner — a quién se le ofrece instalar', () => {
  it('al caso base: móvil, sin instalar y con prompt', () => {
    expect(decidirBanner(base)).toEqual({ mostrar: true, motivo: 'mostrar', variante: 'prompt' })
  })

  it('NO a quien ya la tiene instalada', () => {
    // Decirle "instálala" a quien la abrió DESDE el icono le hace dudar de que lo esté.
    expect(decidirBanner({ ...base, yaInstalada: true })).toEqual({
      mostrar: false,
      motivo: 'ya_instalada',
      variante: 'prompt',
    })
  })

  it('NO en escritorio', () => {
    expect(decidirBanner({ ...base, esMovil: false })).toEqual({
      mostrar: false,
      motivo: 'no_movil',
      variante: 'prompt',
    })
  })

  it('NO si el navegador no ofrece instalar (iOS Safari, criterios sin cumplir)', () => {
    // Un botón "Instalar" que no instala nada es peor que no tener botón.
    expect(decidirBanner({ ...base, promptDisponible: false })).toEqual({
      mostrar: false,
      motivo: 'sin_prompt',
      variante: 'prompt',
    })
  })

  it('respeta el descarte mientras esté vigente', () => {
    expect(decidirBanner({ ...base, silenciadoHasta: AHORA + DIA })).toEqual({
      mostrar: false,
      motivo: 'descartado',
      variante: 'prompt',
    })
  })

  it('vuelve a ofrecerlo cuando el descarte caduca', () => {
    expect(decidirBanner({ ...base, silenciadoHasta: AHORA - 1 })).toEqual({
      mostrar: true,
      motivo: 'mostrar',
      variante: 'prompt',
    })
  })

  it('el instante EXACTO de caducidad ya no silencia (off-by-one)', () => {
    expect(decidirBanner({ ...base, silenciadoHasta: AHORA }).mostrar).toBe(true)
  })

  it('el motivo que devuelve es el más informativo, no el primero que se cumpla', () => {
    // Alguien que la tiene instalada Y la descartó hace semanas: lo que importa es que la
    // tiene, no el descarte viejo. Si el orden se invirtiera, la telemetría diría
    // "descartado" de gente que en realidad es usuaria de la app.
    const r = decidirBanner({ ...base, yaInstalada: true, silenciadoHasta: AHORA + DIA })
    expect(r.motivo).toBe('ya_instalada')
  })

  it('en escritorio manda "no_movil" aunque tampoco haya prompt', () => {
    const r = decidirBanner({ ...base, esMovil: false, promptDisponible: false })
    expect(r.motivo).toBe('no_movil')
  })
})

describe('silenciarHasta — la ✕ y «Ahora no» NO duran lo mismo', () => {
  it('la ✕ calla el banner unos días', () => {
    expect(silenciarHasta('cerrar', AHORA)).toBe(AHORA + 3 * DIA)
  })

  it('«Ahora no» lo calla un mes', () => {
    expect(silenciarHasta('ahora_no', AHORA)).toBe(AHORA + 30 * DIA)
  })

  it('«Ahora no» dura MÁS que la ✕ (son intenciones distintas)', () => {
    // La ✕ es "quítamelo de delante"; «Ahora no» es "no me interesa". Tratarlos igual sería
    // ignorar lo que el usuario acaba de decir.
    expect(SILENCIO_MS.ahora_no).toBeGreaterThan(SILENCIO_MS.cerrar)
  })

  it('ninguno es para siempre: la PWA se entiende mejor tras usar la web unos días', () => {
    expect(SILENCIO_MS.cerrar).toBeGreaterThan(0)
    expect(SILENCIO_MS.ahora_no).toBeLessThan(365 * DIA)
  })
})

describe('esMovil', () => {
  it('reconoce Android e iOS', () => {
    expect(esMovil('Mozilla/5.0 (Linux; Android 14; SM-S911B) Chrome/126')).toBe(true)
    expect(esMovil('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Safari/605')).toBe(true)
    expect(esMovil('Mozilla/5.0 (iPad; CPU OS 17_5) Safari/605')).toBe(true)
  })

  it('no confunde un escritorio con un móvil', () => {
    expect(esMovil('Mozilla/5.0 (X11; Linux x86_64) Chrome/126')).toBe(false)
    expect(esMovil('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605')).toBe(false)
    expect(esMovil('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126')).toBe(false)
  })

  it('no revienta con un user-agent vacío', () => {
    expect(esMovil('')).toBe(false)
  })
})

describe('leerSilencio — tolera basura en localStorage', () => {
  it('lee un valor válido', () => {
    expect(leerSilencio(String(AHORA))).toBe(AHORA)
  })

  it('trata como "nunca descartado" lo que no sea un número usable', () => {
    // Un valor manipulado a mano, o de una versión anterior, no puede tumbar el layout: un
    // banner de más es un incordio, una excepción se lleva la página por delante.
    for (const basura of [null, '', 'null', 'undefined', 'ayer', '-1', '0', 'NaN']) {
      expect(leerSilencio(basura)).toBeNull()
    }
  })

  it('la clave lleva prefijo del proyecto (no choca con otras)', () => {
    expect(CLAVE_SILENCIO.startsWith('vence_')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────
// SIMULACIÓN: el ciclo de vida completo de un usuario, día a día.
// Los tests de arriba fijan cada regla por separado; esto comprueba que ENCAJAN — que el
// banner no reaparece al recargar, que vuelve cuando toca y que se calla para siempre en
// cuanto instala.
// ─────────────────────────────────────────────────────────────────────────────────────────
describe('simulación: un usuario de móvil a lo largo de un mes', () => {
  it('recorre visto → descartado → silencio → vuelve → instala → nunca más', () => {
    let silenciadoHasta: number | null = null
    let yaInstalada = false
    const visto: string[] = []

    const dia = (n: number) => AHORA + n * DIA
    const ver = (n: number) =>
      decidirBanner({
        yaInstalada,
        esMovil: true,
        promptDisponible: true,
        silenciadoHasta,
        ahora: dia(n),
      })

    // Día 0: primera visita → lo ve.
    expect(ver(0).mostrar).toBe(true)
    visto.push('d0')

    // Lo cierra con la ✕.
    silenciadoHasta = silenciarHasta('cerrar', dia(0))

    // Días 1 y 2: recarga varias veces y NO reaparece (esto es lo que quema al usuario).
    expect(ver(1).mostrar).toBe(false)
    expect(ver(2).mostrar).toBe(false)

    // Día 4: pasado el silencio de la ✕, vuelve a ofrecerse.
    expect(ver(4).mostrar).toBe(true)
    visto.push('d4')

    // Ahora pulsa «Ahora no» → un mes de tregua.
    silenciadoHasta = silenciarHasta('ahora_no', dia(4))
    expect(ver(10).mostrar).toBe(false)
    expect(ver(30).mostrar).toBe(false)

    // Día 40: caducó, se le vuelve a ofrecer y esta vez instala.
    expect(ver(40).mostrar).toBe(true)
    visto.push('d40')
    yaInstalada = true

    // Ya instalada: no se le vuelve a enseñar JAMÁS, ni con el silencio caducado.
    silenciadoHasta = null
    for (const d of [41, 60, 200]) {
      const r = ver(d)
      expect(r.mostrar).toBe(false)
      expect(r.motivo).toBe('ya_instalada')
    }

    // En un mes y pico lo ha visto 3 veces. Ni una por sesión, ni una sola vez y se acabó.
    expect(visto).toEqual(['d0', 'd4', 'd40'])
  })

  it('a un usuario de escritorio no se le enseña NUNCA, haga lo que haga', () => {
    for (const d of [0, 1, 5, 40, 400]) {
      expect(
        decidirBanner({
          yaInstalada: false,
          esMovil: false,
          promptDisponible: true,
          silenciadoHasta: null,
          ahora: AHORA + d * DIA,
        }).mostrar,
      ).toBe(false)
    }
  })
})

// ── Variante iOS ─────────────────────────────────────────────────────────────────────────────
//
// De dónde sale: en las primeras 17 h del banner, 114 móviles no recibieron ninguna oferta.
// 48 eran iPhone/iPad y NINGUNO instaló la app; los 66 de Android ya la tenían, ya la habían
// visto o ya la habían descartado. En iOS no existe `beforeinstallprompt`, así que el hueco no
// se arregla con un botón: se arregla enseñando los dos pasos de Safari.
describe('decidirBanner — iOS (sin prompt, pero instalable a mano)', () => {
  const base = { yaInstalada: false, esMovil: true, promptDisponible: false, silenciadoHasta: null, ahora: 1_000 }

  it('en iOS Safari SÍ se enseña, con motivo propio y variante `ios`', () => {
    expect(decidirBanner({ ...base, esIosSafari: true })).toEqual({
      mostrar: true, motivo: 'mostrar_ios', variante: 'ios',
    })
  })

  it('sin prompt y sin ser iOS Safari sigue sin enseñarse nada (un botón que no instala es peor)', () => {
    expect(decidirBanner({ ...base, esIosSafari: false })).toEqual({
      mostrar: false, motivo: 'sin_prompt', variante: 'prompt',
    })
  })

  it('el descarte se respeta igual en iOS', () => {
    expect(decidirBanner({ ...base, esIosSafari: true, silenciadoHasta: 5_000 })).toEqual({
      mostrar: false, motivo: 'descartado', variante: 'ios',
    })
  })

  it('si ya la tiene instalada, en iOS tampoco se enseña', () => {
    expect(decidirBanner({ ...base, esIosSafari: true, yaInstalada: true }).mostrar).toBe(false)
  })

  it('en escritorio no se enseña aunque el UA parezca Safari', () => {
    expect(decidirBanner({ ...base, esMovil: false, esIosSafari: true }).motivo).toBe('no_movil')
  })

  it('cuando SÍ hay prompt, manda el prompt (Android no ve instrucciones de Safari)', () => {
    expect(decidirBanner({ ...base, promptDisponible: true, esIosSafari: true })).toEqual({
      mostrar: true, motivo: 'mostrar', variante: 'prompt',
    })
  })
})

describe('esIosSafari — solo Safari puede "Añadir a pantalla de inicio"', () => {
  const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1'

  it('reconoce Safari en iPhone (el caso de los 48 usuarios sin oferta)', () => {
    expect(esIosSafari(SAFARI_IPHONE)).toBe(true)
  })

  it('reconoce iPad', () => {
    expect(esIosSafari('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1')).toBe(true)
  })

  it('descarta Chrome de iPhone: ahí NO existe "Añadir a pantalla de inicio"', () => {
    expect(esIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0 Mobile/15E148 Safari/604.1')).toBe(false)
  })

  it('descarta Firefox y Edge de iPhone por el mismo motivo', () => {
    expect(esIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) FxiOS/120.0 Mobile/15E148 Safari/605.1.15')).toBe(false)
    expect(esIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) EdgiOS/120.0 Mobile/15E148 Safari/605.1.15')).toBe(false)
  })

  it('descarta los navegadores dentro de apps (Instagram/Facebook), que tampoco instalan', () => {
    expect(esIosSafari(`${SAFARI_IPHONE} Instagram 300.0`)).toBe(false)
    expect(esIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/440]')).toBe(false)
  })

  it('Android y escritorio no son iOS Safari', () => {
    expect(esIosSafari('Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36')).toBe(false)
    expect(esIosSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15')).toBe(false)
  })
})
