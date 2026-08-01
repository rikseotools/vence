/**
 * @jest-environment jsdom
 */
/**
 * La explicación de la oposición personalizada, RENDERIZADA. (T-327)
 *
 * ── QUÉ SE PROTEGE, QUE NO ES LA REDACCIÓN ──────────────────────────────────────────────────
 *
 * No se fija la prosa (envejece y hace que cualquier mejora del texto salga en rojo). Se fija lo
 * que Manuel DECIDIÓ que este texto tiene que conseguir, que es una lista corta:
 *
 *   1. Que nombre en voz alta a **quién** va dirigido —A1/A2 y las muy minoritarias— porque el
 *      objetivo es que quien esté en ese caso se reconozca. Sin eso el texto es decoración.
 *   2. Que avise de que será **pública** y de que **solo el creador** puede modificarla. Es lo
 *      único del texto con consecuencias: quien no lo lea publica sin saberlo.
 *   3. Que se pueda **cerrar**, que es la interacción que pidió.
 *
 * Y una regla de tono que ya costó una corrección: **el texto no explica limitaciones NUESTRAS**.
 * La primera versión decía «que difícilmente vamos a tener montadas»; se cambió a «que
 * difícilmente vas a encontrar en otro sitio y que aquí vas a poder configurarte tú mismo». Es
 * la misma frase desde el otro lado, y la de antes le contaba al opositor un límite nuestro justo
 * en el momento de convencerle.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreadorTemario from '@/components/oposicionPersonalizada/CreadorTemario'

// El creador llama a la API en cuanto se teclea; aquí solo se mira la explicación.
jest.mock('@/lib/api/authHeaders', () => ({ getAuthHeaders: async () => ({}) }))
beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ leyes: [], contenido: [] }),
  }) as unknown as typeof fetch
})
beforeEach(() => window.localStorage.clear())

describe('la explicación se ve en la primera visita', () => {
  it('dice a QUIÉN va dirigido: A1 y A2, y las muy minoritarias', () => {
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    const texto = document.body.textContent ?? ''
    expect(texto).toMatch(/A1/)
    expect(texto).toMatch(/A2/)
    expect(texto).toMatch(/minoritaria/i)
    expect(texto).toMatch(/pocas plazas/i)
  })

  it('avisa de que será PÚBLICA y de que solo el creador la modifica', () => {
    // Es lo único del texto con consecuencias reales para el usuario.
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    const texto = document.body.textContent ?? ''
    expect(texto).toMatch(/p[úu]blica/i)
    expect(texto).toMatch(/solo t[úu]/i)
  })

  it('NO le cuenta al opositor una limitación nuestra', () => {
    // Regresión del cambio pedido el 01/08: «difícilmente vamos a tener montadas» hablaba de
    // nuestro límite en vez de lo que él se lleva.
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    const texto = document.body.textContent ?? ''
    expect(texto).not.toMatch(/vamos a tener montad|no la hemos montado|no tenemos montada/i)
    expect(texto).toMatch(/vas a poder configurar/i)
  })
})

describe('cerrarla y recuperarla', () => {
  it('la ✕ la cierra y no vuelve a salir al recargar', async () => {
    const u = userEvent.setup()
    const { unmount } = render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    expect(screen.getByText(/Aquí puedes crear tu propia oposición/i)).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: /cerrar la explicación/i }))
    expect(screen.queryByText(/Aquí puedes crear tu propia oposición/i)).not.toBeInTheDocument()

    // «No vuelve a salir» es la promesa del botón: se comprueba montando de nuevo, que es lo
    // que hace el navegador al recargar.
    unmount()
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    expect(screen.queryByText(/Aquí puedes crear tu propia oposición/i)).not.toBeInTheDocument()
  })

  it('otro usuario en el mismo navegador SÍ la ve', () => {
    window.localStorage.setItem('oposicion_personalizada_intro_visto:u1', '1')
    render(<CreadorTemario autor="Otra Persona" userId="u2" />)
    expect(screen.getByText(/Aquí puedes crear tu propia oposición/i)).toBeInTheDocument()
  })

  it('se puede volver a leer: cerrarla no es irreversible', async () => {
    const u = userEvent.setup()
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    await u.click(screen.getByRole('button', { name: /cerrar la explicación/i }))

    await u.click(screen.getByRole('button', { name: /Para qué sirve esto/i }))
    expect(screen.getByText(/Aquí puedes crear tu propia oposición/i)).toBeInTheDocument()
  })
})
