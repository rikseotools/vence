/**
 * @jest-environment jsdom
 */
/**
 * La tarjeta de un tema: lo que hace, no cómo se ve. (T-327)
 *
 * El rediseño es visual, pero trae comportamiento que se puede romper sin que nadie lo note al
 * mirar la pantalla:
 *
 *  · el **lápiz** tiene que ENFOCAR el campo. Si fuera un icono decorativo, estaría prometiendo
 *    algo que no cumple — y es la única señal de que ese nombre se puede cambiar.
 *  · quitar un tema NO debe seleccionarlo antes. La tarjeta entera selecciona al pulsarla, así
 *    que sin `stopPropagation` el botón de quitar dispara las dos cosas.
 *  · el contador de artículos tiene que seguir a la realidad, no a un número aparte.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreadorTemario from '@/components/oposicionPersonalizada/CreadorTemario'

jest.mock('@/lib/api/authHeaders', () => ({ getAuthHeaders: async () => ({}) }))
beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, leyes: [], contenido: [], grupos: [] }),
  }) as unknown as typeof fetch
})
beforeEach(() => {
  window.localStorage.clear()
  // La explicación se da por leída: aquí se mira la tarjeta, no la intro.
  window.localStorage.setItem('oposicion_personalizada_intro_visto:u1', '1')
})

const montar = () => render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)

describe('el nombre del tema se puede cambiar, y se nota', () => {
  it('el lápiz ENFOCA el campo del nombre (si no, promete algo que no cumple)', async () => {
    const u = userEvent.setup()
    montar()
    const campo = screen.getByLabelText('Nombre del tema') as HTMLInputElement
    expect(campo).not.toHaveFocus()

    await u.click(screen.getByRole('button', { name: /Cambiar el nombre/i }))
    expect(campo).toHaveFocus()
  })

  it('escribir cambia el nombre del tema', async () => {
    const u = userEvent.setup()
    montar()
    const campo = screen.getByLabelText('Nombre del tema') as HTMLInputElement
    await u.clear(campo)
    await u.type(campo, 'El procedimiento administrativo')
    expect(campo.value).toBe('El procedimiento administrativo')
  })

  it('el campo arranca con un nombre, nunca en blanco', () => {
    montar()
    expect((screen.getByLabelText('Nombre del tema') as HTMLInputElement).value).toBe('Tema 1')
  })
})

describe('varios temas', () => {
  it('al añadir un tema, el nuevo pasa a ser el que recibe lo que añadas', async () => {
    const u = userEvent.setup()
    montar()
    await u.click(screen.getByRole('button', { name: /Añadir tema/i }))

    const campos = screen.getAllByLabelText('Nombre del tema') as HTMLInputElement[]
    expect(campos).toHaveLength(2)
    expect(campos[1].value).toBe('Tema 2')
    // Y se dice en voz alta dónde va lo que añadas: el color solo no basta.
    expect(screen.getByText(/Lo que añadas entra aquí/i)).toBeInTheDocument()
  })

  it('quitar un tema NO lo selecciona antes (el clic no se propaga a la tarjeta)', async () => {
    const u = userEvent.setup()
    montar()
    await u.click(screen.getByRole('button', { name: /Añadir tema/i }))
    // Con dos temas, el activo es el 2.º. Se quita el 1.º: si el clic se propagara, la tarjeta
    // del 1.º se seleccionaría justo antes de desaparecer.
    await u.click(screen.getByRole('button', { name: /Quitar Tema 1/i }))

    const campos = screen.getAllByLabelText('Nombre del tema') as HTMLInputElement[]
    expect(campos).toHaveLength(1)
    expect(campos[0].value).toBe('Tema 2')
    // El que queda sigue siendo el activo, y con uno solo ya no hace falta anunciarlo.
    expect(screen.queryByText(/Lo que añadas entra aquí/i)).not.toBeInTheDocument()
  })

  it('con un solo tema no se puede quitar (quedarse sin ninguno no es un estado útil)', () => {
    montar()
    expect(screen.queryByRole('button', { name: /Quitar Tema/i })).not.toBeInTheDocument()
  })
})

describe('el contador de artículos', () => {
  it('un tema recién creado enseña 0', async () => {
    const u = userEvent.setup()
    montar()
    await u.click(screen.getByRole('button', { name: /Añadir tema/i }))
    // Cada tarjeta lleva su cuenta; con dos temas vacíos, las dos a 0.
    const campos = screen.getAllByLabelText('Nombre del tema')
    for (const campo of campos) {
      const cabecera = campo.parentElement!
      expect(within(cabecera).getByText('0')).toBeInTheDocument()
    }
  })
})
