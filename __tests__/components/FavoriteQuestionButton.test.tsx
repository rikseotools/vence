// __tests__/components/FavoriteQuestionButton.test.tsx
//
// El corazón para guardar preguntas (T-261, petición de Laura Zurdo).
// Lo que se fija aquí es el comportamiento que el usuario NOTA: que responde al
// instante, que no miente si el servidor falla, y que no aparece donde no sirve.
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

let mockUser: { id: string } | null = { id: 'u1' }
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('../../lib/api/authHeaders', () => ({
  getAuthHeaders: async () => ({ Authorization: 'Bearer x' }),
}))

import FavoriteQuestionButton from '../../components/FavoriteQuestionButton'

const QID = '3bdd3565-1111-4222-8333-444444444444'

describe('FavoriteQuestionButton', () => {
  beforeEach(() => {
    mockUser = { id: 'u1' }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, isFavorite: true, total: 1 }),
    }) as unknown as typeof fetch
  })

  it('no se pinta sin sesión (marcar exige cuenta)', () => {
    mockUser = null
    const { container } = render(<FavoriteQuestionButton questionId={QID} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('no se pinta si no hay pregunta', () => {
    const { container } = render(<FavoriteQuestionButton questionId={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('empieza vacío y ofrece guardar', () => {
    render(<FavoriteQuestionButton questionId={QID} />)
    const boton = screen.getByRole('button', { name: /guardar esta pregunta/i })
    expect(boton).toHaveAttribute('aria-pressed', 'false')
  })

  it('al pulsar guarda: llama al endpoint con POST y queda marcado', async () => {
    render(<FavoriteQuestionButton questionId={QID} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/question-favorites',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ questionId: QID }) }),
      )
    })
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('si empieza marcado, al pulsar DESMARCA (DELETE)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, isFavorite: false, total: 0 }),
    })
    render(<FavoriteQuestionButton questionId={QID} initialIsFavorite />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/question-favorites',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('si el servidor falla, REVIERTE — el corazón no miente', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    render(<FavoriteQuestionButton questionId={QID} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('manda el estado FINAL que decide el servidor, no el que supone el cliente', async () => {
    // Dos pestañas abiertas: el cliente cree que va a marcar, pero el servidor
    // responde que quedó desmarcada. Gana el servidor.
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, isFavorite: false, total: 0 }),
    })
    render(<FavoriteQuestionButton questionId={QID} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    })
  })
})

describe('el corazón sigue a la pregunta (bug de Laura, 29/07)', () => {
  // En un test, React reutiliza esta misma instancia al pasar de pregunta (se monta sin
  // `key`). Con `useState(initialIsFavorite)` a secas, el estado se quedaba con el de la
  // pregunta ANTERIOR: la siguiente salía en rojo sin marcarla y había que pulsar dos
  // veces. Lo reportó la misma usuaria que pidió la función, el día del estreno.
  it('al cambiar de pregunta, el corazón refleja la NUEVA, no la anterior', () => {
    const { rerender } = render(
      <FavoriteQuestionButton questionId="preg-1" initialIsFavorite={true} />,
    )
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')

    // Misma posición en el árbol, otra pregunta y NO marcada.
    rerender(<FavoriteQuestionButton questionId="preg-2" initialIsFavorite={false} />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
  })

  it('vuelve a marcado si la siguiente pregunta SÍ era favorita', () => {
    const { rerender } = render(
      <FavoriteQuestionButton questionId="preg-1" initialIsFavorite={false} />,
    )
    rerender(<FavoriteQuestionButton questionId="preg-2" initialIsFavorite={true} />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })
})
