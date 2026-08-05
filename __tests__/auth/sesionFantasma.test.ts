/**
 * «Cree que está dentro, y no lo está» (T-434).
 *
 * Esta decisión tiene dos formas de salir mal y las dos cuestan dinero:
 *   · soltar de MENOS → la persona sigue encerrada, navegando sin que se le guarde nada
 *     (~90 personas, la más antigua desde el 07/07/2026);
 *   · soltar de MÁS → se desloguea a usuarios SANOS, premium incluidos, por un bache de red.
 *
 * Por eso los casos vienen emparejados: cada «se limpia» tiene enfrente su «no se toca».
 */
import {
  decidirSesionFantasma,
  decidirIdentidadAjena,
  EVENTO_VEREDICTO,
} from '@/lib/auth/sesionFantasma'

const entrada = (over: Partial<Parameters<typeof decidirSesionFantasma>[0]> = {}) => ({
  evento: EVENTO_VEREDICTO,
  haySesion: false,
  hayPerfilCacheado: true,
  ...over,
})

describe('decidirSesionFantasma — soltar al fantasma sin soltar al sano', () => {
  it('EL CASO ROTO: arranque sin sesión y con perfil cacheado → se suelta', () => {
    const d = decidirSesionFantasma(entrada())
    expect(d.limpiar).toBe(true)
    expect(d.motivo).toBe('veredicto_inicial')
  })

  // El contraste del anterior. Si esto se rompe, deslogueamos a gente que está dentro.
  it('con sesión válida no se toca NADA, aunque haya perfil cacheado', () => {
    const d = decidirSesionFantasma(entrada({ haySesion: true }))
    expect(d.limpiar).toBe(false)
    expect(d.motivo).toBe('sesion_valida')
  })

  it('con sesión válida tampoco se toca en el arranque', () => {
    expect(
      decidirSesionFantasma(entrada({ haySesion: true, evento: EVENTO_VEREDICTO })).limpiar,
    ).toBe(false)
  })

  // La guarda original se conserva EXACTAMENTE para esto: un refresco que falla no es un
  // fantasma, y soltar ahí devolvería el bug que la puso (premium viendo «Regístrate»).
  it('un refresco fallido NO suelta al usuario: puede ser un bache, no un fantasma', () => {
    const d = decidirSesionFantasma(entrada({ evento: 'TOKEN_REFRESHED' }))
    expect(d.limpiar).toBe(false)
    expect(d.motivo).toBe('posible_fallo_transitorio')
  })

  it('ningún evento distinto del veredicto suelta a quien tiene perfil cacheado', () => {
    for (const evento of ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', '', null, undefined]) {
      expect(decidirSesionFantasma(entrada({ evento })).limpiar).toBe(false)
    }
  })

  it('sin sesión y sin perfil cacheado se suelta, como siempre se hizo', () => {
    const d = decidirSesionFantasma(entrada({ hayPerfilCacheado: false }))
    expect(d.limpiar).toBe(true)
    expect(d.motivo).toBe('sin_nada_que_conservar')
  })

  it('sin sesión ni perfil se suelta sea cual sea el evento', () => {
    for (const evento of ['TOKEN_REFRESHED', 'SIGNED_IN', null]) {
      expect(decidirSesionFantasma(entrada({ hayPerfilCacheado: false, evento })).limpiar).toBe(
        true,
      )
    }
  })

  // El radio de acción es la mitad del valor de este cambio: se toca UN caso de los cuatro.
  it('solo cambia el comportamiento en UNA de las cuatro combinaciones', () => {
    const comoAntes = (e: ReturnType<typeof entrada>) => e.haySesion || e.hayPerfilCacheado
    let cambiados = 0
    for (const haySesion of [true, false]) {
      for (const hayPerfilCacheado of [true, false]) {
        for (const evento of [EVENTO_VEREDICTO, 'TOKEN_REFRESHED']) {
          const e = entrada({ haySesion, hayPerfilCacheado, evento })
          const antes = !comoAntes(e) // el viejo `if (newUser || !perfilCacheado)` limpiaba aquí
          if (decidirSesionFantasma(e).limpiar !== antes) cambiados++
        }
      }
    }
    expect(cambiados).toBe(1)
  })

  it('una entrada ausente no desloguea a nadie por accidente', () => {
    expect(decidirSesionFantasma(undefined as never).limpiar).toBe(true)
    expect(decidirSesionFantasma({ haySesion: true } as never).limpiar).toBe(false)
  })
})

/**
 * El caso HERMANO (medido el 05/08/2026): no es que no haya sesión — la hay y es buena. Lo que
 * falla es que el cliente arrastra OTRA identidad del `localStorage` legacy y la manda como
 * `?userId=`. De los 182 que rebotaban en 14 días, 180 tenían sesión verificada y NINGUNO tenía
 * fila en `user_profiles` con el id que rebotaba.
 *
 * Mismo emparejamiento que arriba: cada «se suelta» con su «no se toca».
 */
describe('decidirIdentidadAjena — soltar el rastro de OTRO sin tocar al dueño', () => {
  const SESION = '0479a6bc-0000-4000-8000-000000000001'
  const FANTASMA = 'c1aee21c-0000-4000-8000-000000000002' // caso real: rebotaba con perfil:0

  it('EL CASO ROTO: el rastro pre-hidratado es de otra identidad → se descarta', () => {
    const d = decidirIdentidadAjena({ idPrehidratado: FANTASMA, idSesion: SESION })
    expect(d.descartar).toBe(true)
    expect(d.motivo).toBe('ajena')
  })

  // El contraste que protege al 99% del tráfico: mismo usuario que vuelve, con su cache.
  it('si el rastro es del MISMO usuario no se toca nada (o le borramos su propio cache)', () => {
    const d = decidirIdentidadAjena({ idPrehidratado: SESION, idSesion: SESION })
    expect(d.descartar).toBe(false)
    expect(d.motivo).toBe('coincide')
  })

  it('sin sesión NO opina: ese caso es de decidirSesionFantasma, y un hecho con dos jueces se contradice', () => {
    for (const idSesion of [null, undefined, '']) {
      const d = decidirIdentidadAjena({ idPrehidratado: FANTASMA, idSesion })
      expect(d.descartar).toBe(false)
      expect(d.motivo).toBe('sin_sesion')
    }
  })

  it('sin rastro pre-hidratado no hay nada que descartar', () => {
    for (const idPrehidratado of [null, undefined, '']) {
      const d = decidirIdentidadAjena({ idPrehidratado, idSesion: SESION })
      expect(d.descartar).toBe(false)
      expect(d.motivo).toBe('sin_prehidratado')
    }
  })

  it('la comparación es EXACTA: un id que solo se parece sigue siendo ajeno', () => {
    expect(
      decidirIdentidadAjena({ idPrehidratado: SESION.toUpperCase(), idSesion: SESION }).descartar,
    ).toBe(true)
    expect(decidirIdentidadAjena({ idPrehidratado: SESION + ' ', idSesion: SESION }).descartar).toBe(
      true,
    )
  })

  it('una entrada ausente no borra el cache de nadie por accidente', () => {
    expect(decidirIdentidadAjena(undefined as never).descartar).toBe(false)
    expect(decidirIdentidadAjena({} as never).descartar).toBe(false)
  })

  // Las dos decisiones se reparten el espacio sin solaparse: exactamente una opina en cada caso.
  it('las dos funciones NUNCA opinan a la vez sobre el mismo estado', () => {
    for (const haySesion of [true, false]) {
      const fantasma = decidirSesionFantasma({
        evento: EVENTO_VEREDICTO,
        haySesion,
        hayPerfilCacheado: true,
      })
      const ajena = decidirIdentidadAjena({
        idPrehidratado: FANTASMA,
        idSesion: haySesion ? SESION : null,
      })
      expect(fantasma.limpiar && ajena.descartar).toBe(false)
    }
  })
})
