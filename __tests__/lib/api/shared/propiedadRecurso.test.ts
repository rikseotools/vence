import { juzgarPropiedad, dejaPasar, statusDe } from '@/lib/api/shared/propiedadRecurso'

/**
 * [T-671] — el caso que lo estrena es real y está MEDIDO: de las 195 peticiones rechazadas
 * como «recurso ajeno» en las 32 h del incidente del 07/08/2026, **las 195 llegaron sin
 * identidad de llamante**. Ni una era de otra persona. Estos tests fijan que esas dos cosas
 * no vuelvan a salir por la misma puerta.
 */
describe('juzgarPropiedad — «no eres tú» y «no sé quién eres» son distintos', () => {
  const YO = '1565fb32-a50d-4d13-ac2b-e651ba1075de'
  const OTRO = '8bd13f67-0000-4000-8000-000000000000'

  it('el dueño pasa', () => {
    expect(juzgarPropiedad({ duenoReal: YO, callerUserId: YO })).toBe('permitido')
  })

  it('un recurso SIN dueño pasa aunque no haya sesión: el examen se puede hacer sin cuenta', () => {
    expect(juzgarPropiedad({ duenoReal: null, callerUserId: null })).toBe('permitido')
    expect(juzgarPropiedad({ duenoReal: null, callerUserId: YO })).toBe('permitido')
  })

  it('SIN IDENTIDAD sobre un recurso con dueño = sesión caída, no intrusión', () => {
    // Este es el caso de `rbsc87`: su propio examen, su propio navegador, y el token que no
    // llegó. Antes salía indistinguible del intento de acceder a lo ajeno.
    expect(juzgarPropiedad({ duenoReal: YO, callerUserId: null })).toBe('sin_identidad')
  })

  it('identificado y NO es el dueño = recurso ajeno de verdad', () => {
    expect(juzgarPropiedad({ duenoReal: YO, callerUserId: OTRO })).toBe('recurso_ajeno')
  })
})

describe('las tres salidas siguen DENEGANDO exactamente lo mismo que antes', () => {
  // Lo único que cambia es el nombre y el código. Si este test se pone en rojo es que el
  // cambio de etiquetas se llevó por delante una comprobación de seguridad.
  it('solo «permitido» deja pasar', () => {
    expect(dejaPasar('permitido')).toBe(true)
    expect(dejaPasar('sin_identidad')).toBe(false)
    expect(dejaPasar('recurso_ajeno')).toBe(false)
  })

  it('sin identidad → 401 (vuelve a entrar); ajeno → 403 (esto no es tuyo)', () => {
    // No son intercambiables: el cliente decide con esto si te ofrece volver a entrar o te
    // dice que el recurso es de otra cuenta.
    expect(statusDe('sin_identidad')).toBe(401)
    expect(statusDe('recurso_ajeno')).toBe(403)
  })
})
