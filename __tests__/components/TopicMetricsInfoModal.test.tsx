// __tests__/components/TopicMetricsInfoModal.test.tsx
//
// Tests del modal informativo del temario (presentacional). Simula apertura,
// cierre (✕, click-fuera, Escape), y los dos estados de contenido (con datos
// reales del usuario vs sin progreso). Mobile/a11y: role=dialog + aria-modal.

import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import TopicMetricsInfoModal from '@/components/temario/TopicMetricsInfoModal'
import type { TrendSummary } from '@/lib/utils/topicTrend'

const summaryConDatos: TrendSummary = {
  temasPracticados: 3,
  totalRespondidas: 120,
  mediaAciertos: 58,
  mejorTema: { titulo: 'La Constitución Española', accuracy: 82 },
  temaReforzar: { titulo: 'El acto administrativo', accuracy: 41 },
  tendencia: { mejorando: 2, empeorando: 1, estable: 0 },
}

const summaryVacio: TrendSummary = {
  temasPracticados: 0,
  totalRespondidas: 0,
  mediaAciertos: 0,
  mejorTema: null,
  temaReforzar: null,
  tendencia: { mejorando: 0, empeorando: 0, estable: 0 },
}

describe('TopicMetricsInfoModal', () => {
  it('no renderiza nada cuando open=false', () => {
    const { container } = render(<TopicMetricsInfoModal open={false} onClose={() => {}} summary={summaryConDatos} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza la explicación del % y de las flechitas con role=dialog accesible', () => {
    render(<TopicMetricsInfoModal open onClose={() => {}} summary={summaryConDatos} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText(/qué significan estos números/i)).toBeInTheDocument()
    expect(screen.getByText(/porcentaje de acierto en ese tema/i)).toBeInTheDocument()
    expect(screen.getByText(/tendencia de los últimos 30 días/i)).toBeInTheDocument()
  })

  it('muestra los datos reales del usuario cuando hay progreso', () => {
    render(<TopicMetricsInfoModal open onClose={() => {}} summary={summaryConDatos} />)
    expect(screen.getByText(/Tus datos en esta oposición/i)).toBeInTheDocument()
    expect(screen.getByText('La Constitución Española')).toBeInTheDocument()
    expect(screen.getByText('El acto administrativo')).toBeInTheDocument()
    expect(screen.getByText(/2 mejorando/)).toBeInTheDocument()
    expect(screen.getByText(/1 a repasar/)).toBeInTheDocument()
  })

  it('muestra estado vacío (sin tabla de datos) cuando no hay progreso', () => {
    render(<TopicMetricsInfoModal open onClose={() => {}} summary={summaryVacio} />)
    expect(screen.getByText(/Aún no has practicado temas/i)).toBeInTheDocument()
    expect(screen.queryByText(/Tus datos en esta oposición/i)).not.toBeInTheDocument()
  })

  it('cierra al pulsar la ✕', () => {
    const onClose = jest.fn()
    render(<TopicMetricsInfoModal open onClose={onClose} summary={summaryConDatos} />)
    fireEvent.click(screen.getByLabelText('Cerrar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cierra al pulsar Escape', () => {
    const onClose = jest.fn()
    render(<TopicMetricsInfoModal open onClose={onClose} summary={summaryConDatos} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('NO cierra al hacer click dentro del contenido (stopPropagation)', () => {
    const onClose = jest.fn()
    render(<TopicMetricsInfoModal open onClose={onClose} summary={summaryConDatos} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
