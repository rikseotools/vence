// __tests__/components/QuestionReviewCard.test.tsx
//
// Tarjeta de revisión de una pregunta (T-261): lo que el usuario necesita para repasar
// —todas las opciones, cuál es la correcta, la explicación y el artículo— sin depender
// del contexto de un examen.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('../../components/MarkdownExplanation', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="explicacion">{content}</div>,
}))

// El modal real hace fetch del artículo; aquí solo interesa que se ABRA con los datos
// correctos (el modal en sí ya vive probado en los flujos de test/examen).
jest.mock('../../components/ArticleModal', () => ({
  __esModule: true,
  default: ({ isOpen, articleNumber, lawSlug }: { isOpen: boolean; articleNumber?: string | null; lawSlug?: string | null }) =>
    isOpen ? <div data-testid="modal-articulo">{`${lawSlug ?? 'sin-slug'}#${articleNumber ?? ''}`}</div> : null,
}))

import QuestionReviewCard from '../../components/QuestionReviewCard'

const PREGUNTA = {
  id: 'q1',
  question: '¿Qué mayoría exige la moción de censura?',
  options: ['Simple', 'Absoluta', 'Dos tercios', 'Tres quintos'],
  correct_option: 1,
  explanation: 'El artículo 113 CE exige mayoría absoluta.',
  article_number: '113',
  article_title: 'Moción de censura',
  law_name: 'Constitución Española',
}

describe('QuestionReviewCard', () => {
  it('plegada muestra la referencia legal y el enunciado, sin destripar la respuesta', () => {
    render(<QuestionReviewCard question={PREGUNTA} />)

    expect(screen.getByText(/Art\. 113 · Constitución Española/)).toBeInTheDocument()
    expect(screen.getByText(/moción de censura/i)).toBeInTheDocument()
    // Las opciones NO están visibles hasta desplegar.
    expect(screen.queryByText('Dos tercios')).not.toBeInTheDocument()
  })

  it('al desplegar muestra TODAS las opciones y señala la correcta', async () => {
    render(<QuestionReviewCard question={PREGUNTA} />)
    await userEvent.click(screen.getByRole('button', { expanded: false }))

    for (const opcion of PREGUNTA.options) {
      expect(screen.getByText(opcion)).toBeInTheDocument()
    }
    expect(screen.getByText('Respuesta correcta')).toBeInTheDocument()
  })

  it('muestra la explicación y el artículo vinculado', async () => {
    render(<QuestionReviewCard question={PREGUNTA} />)
    await userEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByTestId('explicacion')).toHaveTextContent('artículo 113 CE')
    // El acceso al artículo lleva su título, para saber qué se va a abrir.
    expect(screen.getByRole('button', { name: /Artículo 113: Moción de censura/ })).toBeInTheDocument()
  })

  it('si se conoce la respuesta del usuario, distingue acierto y fallo', async () => {
    const { rerender } = render(<QuestionReviewCard question={PREGUNTA} userAnswerIndex={1} defaultOpen />)
    expect(screen.getByText('Tu respuesta (correcta)')).toBeInTheDocument()

    rerender(<QuestionReviewCard question={PREGUNTA} userAnswerIndex={0} defaultOpen />)
    expect(screen.getByText('Tu respuesta')).toBeInTheDocument()
    expect(screen.getByText('Respuesta correcta')).toBeInTheDocument()
  })

  it('aguanta una pregunta sin explicación ni artículo (no todo el banco los tiene)', async () => {
    render(
      <QuestionReviewCard
        question={{ id: 'q2', question: 'Enunciado suelto', options: ['A', 'B', 'C'], correct_option: 2 }}
        defaultOpen
      />,
    )
    expect(screen.getByText('Enunciado suelto')).toBeInTheDocument()
    expect(screen.queryByTestId('explicacion')).not.toBeInTheDocument()
  })

  it('renderiza las acciones que le pasen (el corazón para desmarcar)', () => {
    render(
      <QuestionReviewCard
        question={PREGUNTA}
        acciones={<button type="button">quitar</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'quitar' })).toBeInTheDocument()
  })

  it('ofrece abrir el ARTÍCULO con el mismo modal de los tests', async () => {
    render(
      <QuestionReviewCard
        question={{ ...PREGUNTA, law_actual_slug: 'constitucion-espanola' }}
        defaultOpen
      />,
    )

    expect(screen.queryByTestId('modal-articulo')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Ver .*Artículo 113/ }))

    expect(screen.getByTestId('modal-articulo')).toHaveTextContent('constitucion-espanola#113')
  })

  it('sin artículo vinculado no ofrece el enlace (no lleva a una página vacía)', () => {
    render(
      <QuestionReviewCard
        question={{ id: 'q3', question: 'Sin artículo', options: ['A', 'B', 'C'], correct_option: 0 }}
        defaultOpen
      />,
    )
    expect(screen.queryByRole('button', { name: /Ver .*Artículo/ })).not.toBeInTheDocument()
  })

  it('obedece el control externo de "desplegar todas"', () => {
    const { rerender } = render(<QuestionReviewCard question={PREGUNTA} open={false} />)
    expect(screen.queryByText('Dos tercios')).not.toBeInTheDocument()

    rerender(<QuestionReviewCard question={PREGUNTA} open />)
    expect(screen.getByText('Dos tercios')).toBeInTheDocument()
  })
})
