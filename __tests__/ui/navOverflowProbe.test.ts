/**
 * El VEREDICTO de la cabecera (T-504): qué cuenta como defecto y qué no.
 *
 * Este criterio lo comparten los dos ejecutores —la simulación a mano (`npm run sim:cabecera`,
 * con sesiones premium/free) y el smoke de CI (`e2e/smoke-cabecera-alcanzable.spec.ts`,
 * anónimo, cada PR + cada 6 h contra producción)—, así que se prueba una vez y aquí.
 *
 * Las cifras vienen de la medición real del 03/08/2026 contra producción con el código roto:
 * la fila ocupaba 1.879 px dentro de un contenedor de 1.504 px (desborde 375) y el avatar y la
 * campana quedaban fuera del viewport.
 */

import { problemasDeCabecera, ANCHURAS_ESCRITORIO } from '@/lib/ui/navOverflowProbe'

/** Una cabecera sana: nada desbordado, nada fuera, ningún enlace perdido. */
const SANA = {
  hayCabecera: true,
  desborde: 0,
  fuera: [],
  enBarra: 5,
  totalEnlaces: 9,
  hayBotonMas: true,
  haySesion: false,
  enMenu: 4,
  inalcanzablesEnMenu: [],
}

describe('cuando todo está en su sitio', () => {
  it('no reprocha nada', () => {
    expect(problemasDeCabecera(SANA, 1280)).toEqual([])
  })

  it('sin botón «Más» porque caben todos tampoco reprocha nada', () => {
    const r = problemasDeCabecera(
      { ...SANA, enBarra: 9, hayBotonMas: false, enMenu: 0 },
      1920,
    )
    expect(r).toEqual([])
  })

  it('un subpíxel de desborde NO es un desborde', () => {
    // El layout redondea; exigir 0 exacto convertiría el criterio en un generador de ruido.
    expect(problemasDeCabecera({ ...SANA, desborde: 1 }, 1280)).toEqual([])
  })
})

describe('el fallo que motivó la ficha', () => {
  it('canta el desborde de la fila con su tamaño', () => {
    const r = problemasDeCabecera({ ...SANA, desborde: 375 }, 1920)
    expect(r).toHaveLength(1)
    expect(r[0]).toBe('la fila desborda su contenedor 375px')
  })

  it('NOMBRA el control que el usuario no podía pulsar, que es lo que vale del hallazgo', () => {
    const r = problemasDeCabecera(
      {
        ...SANA,
        fuera: [
          { que: 'Notificaciones (2)', px: 120, lado: 'derecha', l: 1990, r: 2050 },
          { que: 'Mi perfil', px: 40, lado: 'derecha', l: 1920, r: 1980 },
        ],
      },
      1920,
    )
    expect(r).toHaveLength(2)
    expect(r[0]).toContain('«Notificaciones (2)» no se puede pulsar')
    expect(r[0]).toContain('120px fuera por la derecha')
    expect(r[1]).toContain('«Mi perfil»')
  })

  it('un desborde y un control fuera son DOS problemas, no uno', () => {
    // Son síntomas distintos y se comprueban aparte a propósito: la fila puede caber y aun así
    // haber algo posicionado por su cuenta fuera de la pantalla.
    const r = problemasDeCabecera(
      { ...SANA, desborde: 375, fuera: [{ que: 'Mi perfil', px: 40, lado: 'derecha', l: 1920, r: 1980 }] },
      1920,
    )
    expect(r).toHaveLength(2)
  })
})

describe('la trampa fácil: pasar escondiendo media navegación', () => {
  it('acusa los enlaces perdidos entre la barra y el menú', () => {
    const r = problemasDeCabecera({ ...SANA, enBarra: 3, enMenu: 2, totalEnlaces: 9 }, 1280)
    expect(r).toHaveLength(1)
    expect(r[0]).toBe('se han perdido 4 enlaces (barra 3 + menú 2 de 9)')
  })

  it('sin medidor NO acusa de enlaces perdidos: no se sabe cuántos había', () => {
    // `totalEnlaces: 0` = el medidor no está. Eso se marca aparte como no concluyente (la
    // simulación lo saca en amarillo, el smoke lo hace fallar con su propio mensaje); acusar
    // AQUÍ de enlaces perdidos sería inventarse un defecto a partir de no haber podido mirar.
    const r = problemasDeCabecera({ ...SANA, totalEnlaces: 0, enBarra: 3, enMenu: 0, hayBotonMas: false }, 1280)
    expect(r).toEqual([])
  })

  it('…pero el resto de comprobaciones siguen valiendo sin medidor', () => {
    // Sin poder contar enlaces todavía se puede ver que la fila desborda: perder una
    // comprobación no puede apagar las otras dos.
    const r = problemasDeCabecera(
      { ...SANA, totalEnlaces: 0, enBarra: 3, enMenu: 0, hayBotonMas: false, desborde: 375 },
      1280,
    )
    expect(r).toEqual(['la fila desborda su contenedor 375px'])
  })

  it('un botón «Más» cuyo menú no se abre es un defecto', () => {
    const r = problemasDeCabecera({ ...SANA, hayBotonMas: true, enMenu: 0, totalEnlaces: 5, enBarra: 5 }, 1280)
    expect(r).toContain('el botón «Más» existe pero su menú no se abre o está vacío')
  })

  it('un enlace del menú recortado o tapado se canta con su motivo', () => {
    // El caso real: el menú quedaba dentro de un `overflow-x: auto` y estaba en el DOM pero no
    // se veía. Contarlos daba verde; comprobar que se pueden pulsar, no.
    const r = problemasDeCabecera(
      { ...SANA, inalcanzablesEnMenu: ['Recompensas (sin caja: recortado u oculto)'] },
      1280,
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toBe('en el menú «Más», «Recompensas (sin caja: recortado u oculto)» no se puede pulsar')
  })
})

describe('las anchuras que se prueban', () => {
  it('incluyen 1280 (donde arranca el menú completo y más aprieta) y 1920 (la del usuario)', () => {
    expect(ANCHURAS_ESCRITORIO).toContain(1280)
    expect(ANCHURAS_ESCRITORIO).toContain(1920)
  })
})
