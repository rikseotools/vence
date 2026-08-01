/**
 * La explicación de la oposición personalizada: cuándo se enseña y cuándo no. (T-327)
 *
 * Lo que se protege aquí es la asimetría: enseñarla de más molesta un segundo; esconderla de más
 * deja al usuario delante de un buscador de leyes sin saber qué hace ahí. Todos los casos raros
 * (almacén bloqueado, valor corrupto) tienen que caer del lado de ENSEÑARLA.
 */
import {
  claveIntro,
  debeMostrarIntro,
  leerMarca,
  marcarVisto,
  MARCA_VISTO,
} from '@/components/oposicionPersonalizada/introVisto'

/** Almacén de mentira, con la opción de romperse como lo hace uno real. */
function almacenFalso(inicial: Record<string, string> = {}, roto = false) {
  const datos = { ...inicial }
  return {
    datos,
    getItem: (k: string) => {
      if (roto) throw new Error('SecurityError: acceso denegado')
      return k in datos ? datos[k] : null
    },
    setItem: (k: string, v: string) => {
      if (roto) throw new Error('QuotaExceededError')
      datos[k] = v
    },
  }
}

describe('la clave separa a los usuarios', () => {
  it('dos cuentas en el mismo navegador no comparten el «ya visto»', () => {
    expect(claveIntro('u1')).not.toBe(claveIntro('u2'))
  })

  it('sin usuario usa una clave genérica, no «undefined»', () => {
    expect(claveIntro(null)).not.toMatch(/undefined|null/)
    expect(claveIntro('   ')).toBe(claveIntro(null))
  })
})

describe('cuándo se enseña', () => {
  it('primera visita (no hay nada guardado) → se enseña', () => {
    expect(debeMostrarIntro(null)).toBe(true)
    expect(debeMostrarIntro(undefined)).toBe(true)
  })

  it('ya la cerró → no se enseña', () => {
    expect(debeMostrarIntro(MARCA_VISTO)).toBe(false)
  })

  it('un valor cualquiera NO cuenta como vista (fallar hacia enseñarla)', () => {
    for (const basura of ['0', 'true', 'sí', '', 'null', '{}']) {
      expect(debeMostrarIntro(basura)).toBe(true)
    }
  })
})

describe('leer y guardar sin que un almacén roto tumbe la pantalla', () => {
  it('lee la marca del usuario correcto', () => {
    const a = almacenFalso({ [claveIntro('u1')]: MARCA_VISTO })
    expect(debeMostrarIntro(leerMarca(a, 'u1'))).toBe(false)
    // El de al lado no la ha visto.
    expect(debeMostrarIntro(leerMarca(a, 'u2'))).toBe(true)
  })

  it('si el almacén LANZA al leer, se enseña (no se rompe)', () => {
    const roto = almacenFalso({}, true)
    expect(() => leerMarca(roto, 'u1')).not.toThrow()
    expect(debeMostrarIntro(leerMarca(roto, 'u1'))).toBe(true)
  })

  it('sin almacén (servidor) se enseña', () => {
    expect(debeMostrarIntro(leerMarca(null, 'u1'))).toBe(true)
  })

  it('guardar deja la marca y la siguiente visita ya no la enseña', () => {
    const a = almacenFalso()
    expect(marcarVisto(a, 'u1')).toBe(true)
    expect(debeMostrarIntro(leerMarca(a, 'u1'))).toBe(false)
  })

  it('si el almacén LANZA al guardar, no revienta: dice que no pudo', () => {
    // El botón de cerrar tiene que cerrar SIEMPRE. Que no se recuerde es molesto; que no
    // responda es un botón roto.
    const roto = almacenFalso({}, true)
    expect(() => marcarVisto(roto, 'u1')).not.toThrow()
    expect(marcarVisto(roto, 'u1')).toBe(false)
  })

  it('sin almacén, guardar no revienta', () => {
    expect(marcarVisto(null, 'u1')).toBe(false)
  })
})
