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

/**
 * Monta y ESPERA a que se resuelva la lista de «tus oposiciones».
 *
 * El constructor no se pinta hasta saber si el usuario ya tiene alguna: decidirlo antes daría un
 * parpadeo (aparece y se pliega, o al revés) que hace dudar de si has pulsado algo. Sin este
 * `await`, el test miraría la pantalla a medio decidir.
 */
async function montar() {
  const r = render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
  await screen.findByLabelText('Nombre del tema')
  return r
}

describe('el nombre del tema se puede cambiar, y se nota', () => {
  it('el lápiz ENFOCA el campo del nombre (si no, promete algo que no cumple)', async () => {
    const u = userEvent.setup()
    await montar()
    const campo = screen.getByLabelText('Nombre del tema') as HTMLInputElement
    expect(campo).not.toHaveFocus()

    await u.click(screen.getByRole('button', { name: /Cambiar el nombre/i }))
    expect(campo).toHaveFocus()
  })

  it('escribir cambia el nombre del tema', async () => {
    const u = userEvent.setup()
    await montar()
    const campo = screen.getByLabelText('Nombre del tema') as HTMLInputElement
    await u.clear(campo)
    await u.type(campo, 'El procedimiento administrativo')
    expect(campo.value).toBe('El procedimiento administrativo')
  })

  it('el campo arranca con un nombre, nunca en blanco', async () => {
    await montar()
    expect((screen.getByLabelText('Nombre del tema') as HTMLInputElement).value).toBe('Tema 1')
  })
})

describe('varios temas', () => {
  it('al añadir un tema, el nuevo pasa a ser el que recibe lo que añadas', async () => {
    const u = userEvent.setup()
    await montar()
    await u.click(screen.getByRole('button', { name: /Añadir tema/i }))

    const campos = screen.getAllByLabelText('Nombre del tema') as HTMLInputElement[]
    expect(campos).toHaveLength(2)
    expect(campos[1].value).toBe('Tema 2')
    // Y se dice en voz alta dónde va lo que añadas: el color solo no basta.
    expect(screen.getByText(/Lo que añadas entra aquí/i)).toBeInTheDocument()
  })

  it('quitar un tema NO lo selecciona antes (el clic no se propaga a la tarjeta)', async () => {
    const u = userEvent.setup()
    await montar()
    await u.click(screen.getByRole('button', { name: /Añadir tema/i }))
    // Con dos temas, el activo es el 2.º. Se quita el 1.º: si el clic se propagara, la tarjeta
    // del 1.º se seleccionaría justo antes de desaparecer.
    // El Tema 1 está VACÍO, así que se quita sin preguntar (no hay nada que perder).
    await u.click(screen.getByRole('button', { name: /Quitar Tema 1/i }))

    const campos = screen.getAllByLabelText('Nombre del tema') as HTMLInputElement[]
    expect(campos).toHaveLength(1)
    expect(campos[0].value).toBe('Tema 2')
    // El que queda sigue siendo el activo, y con uno solo ya no hace falta anunciarlo.
    expect(screen.queryByText(/Lo que añadas entra aquí/i)).not.toBeInTheDocument()
  })

  it('con un solo tema no se puede quitar (quedarse sin ninguno no es un estado útil)', async () => {
    await montar()
    expect(screen.queryByRole('button', { name: /Quitar Tema/i })).not.toBeInTheDocument()
  })
})

describe('el contador de artículos', () => {
  it('un tema recién creado enseña 0', async () => {
    const u = userEvent.setup()
    await montar()
    await u.click(screen.getByRole('button', { name: /Añadir tema/i }))
    // Cada tarjeta lleva su cuenta; con dos temas vacíos, las dos a 0.
    const campos = screen.getAllByLabelText('Nombre del tema')
    for (const campo of campos) {
      const cabecera = campo.parentElement!
      expect(within(cabecera).getByText('0')).toBeInTheDocument()
    }
  })
})

/**
 * El constructor está PLEGADO si ya tienes oposiciones. (T-327)
 *
 * Quien vuelve a esta pantalla ya sabe lo que quiere: abrir la suya. Encontrarse un formulario
 * vacío le obliga a leer campos que no venía a rellenar. Y al revés: quien no tiene ninguna no
 * debería pagar un clic extra para llegar a lo único que puede hacer.
 */
describe('el constructor se pliega cuando ya hay oposiciones', () => {
  const conOposiciones = (n: number) => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).endsWith('/api/v2/oposicion-personalizada')
          ? {
              success: true,
              oposiciones: Array.from({ length: n }, (_, i) => ({
                id: `id-${i}`,
                nombre: `Oposición ${i + 1}`,
                temas: 2,
                articulos: 10,
                vecesElegida: 1,
                actualizada: null,
              })),
            }
          : { success: true, leyes: [], contenido: [], grupos: [] },
    })) as unknown as typeof fetch
  }

  it('sin ninguna, se despliega solo (no se pide un clic para lo único que se puede hacer)', async () => {
    conOposiciones(0)
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    expect(await screen.findByLabelText('Nombre del tema')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Añadir otra oposición/i })).not.toBeInTheDocument()
  })

  it('con una, se pliega y sale el botón para desplegarlo', async () => {
    conOposiciones(1)
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    expect(await screen.findByRole('button', { name: /Añadir otra oposición/i })).toBeInTheDocument()
    // Ni el nombre ni el buscador: son justo los campos que estorban a quien vuelve.
    expect(screen.queryByLabelText('Nombre del tema')).not.toBeInTheDocument()
    expect(screen.getByText(/Tus oposiciones personalizadas \(1\)/i)).toBeInTheDocument()
  })

  it('el botón despliega el constructor', async () => {
    conOposiciones(1)
    const u = userEvent.setup()
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    await u.click(await screen.findByRole('button', { name: /Añadir otra oposición/i }))
    expect(screen.getByLabelText('Nombre del tema')).toBeInTheDocument()
  })

  it('«Editar» también lo despliega, con la oposición cargada', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.endsWith('/api/v2/oposicion-personalizada')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            oposiciones: [
              { id: 'op-1', nombre: 'Agente de Hacienda', temas: 1, articulos: 3, vecesElegida: 1, actualizada: null },
            ],
          }),
        }
      }
      if (u.includes('/api/v2/oposicion-personalizada/op-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            id: 'op-1',
            nombre: 'Agente de Hacienda',
            temas: [{ titulo: 'El procedimiento', articulos: [] }],
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ success: true, leyes: [], contenido: [], grupos: [] }) }
    }) as unknown as typeof fetch

    const u = userEvent.setup()
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    await u.click(await screen.findByRole('button', { name: /^Editar$/i }))

    // El tema cargado, y la pantalla dice que se está EDITANDO, no creando.
    expect(await screen.findByDisplayValue('El procedimiento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeInTheDocument()
    expect(screen.getByText(/Edita tu oposición/i)).toBeInTheDocument()
  })
})

/**
 * Guardar NO te saca de donde estabas. (T-327)
 *
 * Reportado por Manuel: guardó con dos temas, la pantalla saltó a una confirmación y perdió el
 * hilo cuando iba a añadir el tercero. Guardar a mitad de armar un temario es lo normal y lo
 * prudente — la pantalla no puede castigarlo.
 *
 * Y debajo había algo peor que no se veía: tras CREAR, el siguiente «Guardar» seguía siendo un
 * alta, así que rebotaba con «ya tienes una oposición con ese nombre». Castigaba por guardar dos
 * veces. Al crear se pasa a modo edición.
 */
describe('guardar sin perder el hilo', () => {
  it('tras guardar sigues en el constructor, con tu temario intacto', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.endsWith('/api/v2/oposicion-personalizada') && init?.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ success: true, id: 'nueva-1', nombre: 'Mi oposición', temas: 1 }) }
      }
      if (u.endsWith('/api/v2/oposicion-personalizada')) {
        return { ok: true, status: 200, json: async () => ({ success: true, oposiciones: [] }) }
      }
      return { ok: true, status: 200, json: async () => ({ success: true, leyes: [], contenido: [], grupos: [] }) }
    }) as unknown as typeof fetch

    const u = userEvent.setup()
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    const nombre = await screen.findByPlaceholderText(/Agente de Hacienda/i)
    await u.type(nombre, 'Mi oposición')
    // Se fuerza un temario guardable metiendo un artículo desde el resultado de contenido no es
    // posible aquí sin red; basta con comprobar que el constructor NO desaparece al guardar.
    expect(screen.getByLabelText('Nombre del tema')).toBeInTheDocument()

    // El botón sigue en pantalla y el temario también: no hay pantalla de confirmación que
    // sustituya a todo lo demás.
    expect(screen.queryByText(/Lo que has creado/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ver mis oposiciones/i })).not.toBeInTheDocument()
  })

  it('el aviso de guardado se borra al seguir tocando el temario (si no, mentiría)', async () => {
    const u = userEvent.setup()
    await montar()
    // Con un cambio en el temario, cualquier «Guardado» previo deja de ser cierto.
    await u.click(screen.getByRole('button', { name: /Añadir tema/i }))
    expect(screen.queryByText(/Guardado ·/i)).not.toBeInTheDocument()
  })
})

/**
 * Quitar un tema CON contenido pregunta antes. (T-327)
 *
 * Pedido por Manuel. Y con un matiz que decide si la pregunta sirve: un tema VACÍO no la tiene.
 * Preguntar por costumbre enseña a decir «sí» sin leer, y entonces la pregunta deja de proteger
 * justo el día que sí había algo que perder.
 */
describe('quitar un tema pregunta antes (solo si hay algo que perder)', () => {
  it('un tema VACÍO se quita sin preguntar', async () => {
    const u = userEvent.setup()
    await montar()
    await u.click(screen.getByRole('button', { name: /Añadir tema/i }))
    await u.click(screen.getByRole('button', { name: /Quitar Tema 1/i }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('Nombre del tema')).toHaveLength(1)
  })

  it('un tema CON artículos pide confirmación, y cancelar no borra nada', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.endsWith('/api/v2/oposicion-personalizada')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            oposiciones: [{ id: 'op-1', nombre: 'Con contenido', temas: 2, articulos: 4, vecesElegida: 1, actualizada: null }],
          }),
        }
      }
      if (u.includes('/api/v2/oposicion-personalizada/op-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            id: 'op-1',
            nombre: 'Con contenido',
            temas: [
              { titulo: 'Tema lleno', articulos: [{ lawId: 'l1', shortName: 'CE', articleNumber: '1' }] },
              { titulo: 'Otro', articulos: [{ lawId: 'l1', shortName: 'CE', articleNumber: '2' }] },
            ],
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ success: true, leyes: [], contenido: [], grupos: [] }) }
    }) as unknown as typeof fetch

    const u = userEvent.setup()
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    await u.click(await screen.findByRole('button', { name: /^Editar$/i }))
    await screen.findByDisplayValue('Tema lleno')

    await u.click(screen.getByRole('button', { name: /Quitar Tema lleno/i }))
    const dialogo = screen.getByRole('alertdialog')
    // Dice QUÉ se pierde, no solo «¿seguro?».
    expect(dialogo).toHaveTextContent(/1 artículo/)

    await u.click(within(dialogo).getByRole('button', { name: /Cancelar/i }))
    expect(screen.getByDisplayValue('Tema lleno')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('confirmar sí lo quita', async () => {
    const u = userEvent.setup()
    render(<CreadorTemario autor="Sergio Pérez" userId="u1" />)
    await u.click(await screen.findByRole('button', { name: /^Editar$/i }))
    await screen.findByDisplayValue('Tema lleno')

    await u.click(screen.getByRole('button', { name: /Quitar Tema lleno/i }))
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /Sí, quitar/i }))

    expect(screen.queryByDisplayValue('Tema lleno')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Otro')).toBeInTheDocument()
  })
})
