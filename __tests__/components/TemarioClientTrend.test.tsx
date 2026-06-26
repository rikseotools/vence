// __tests__/components/TemarioClientTrend.test.tsx
//
// Simula el comportamiento real del temario respecto a la métrica de tendencia:
//   - el % de acierto se muestra SIEMPRE
//   - las flechitas ▲/▼ se ocultan si show_topic_trend === false (y el % sigue)
//   - el botón "¿Qué significan estos números?" abre el modal informativo
// Monta el componente real con useAuth/useTopicUnlock mockeados (sin red).

import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// --- Mock de progreso por tema (tema 1 con tendencia a la baja) ---
const getTopicProgress = (id: number) =>
  id === 1
    ? { accuracy: 60, accuracy30d: 45, questionsAnswered: 20 } // 60% con ▼15%
    : { accuracy: 0, accuracy30d: null, questionsAnswered: 0 }

jest.mock('@/hooks/useTopicUnlock', () => ({
  useTopicUnlock: () => ({ getTopicProgress, topicProgress: {} }),
}))

// useAuth se re-mockea por test para variar show_topic_trend
let mockAuth: any = { user: { id: 'u1' }, userProfile: { show_topic_trend: true } }
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

import TemarioClient from '@/components/temario/TemarioClient'

const bloques = [
  {
    id: 'b1',
    titulo: 'Bloque I',
    icon: '📘',
    count: 1,
    temas: [{ id: 1, titulo: 'La Constitución Española', descripcion: 'Tema 1' }],
  },
]

function renderTemario() {
  return render(<TemarioClient bloques={bloques} oposicion="auxiliar-administrativo-estado" fechaActualizacion="2026-06-24" />)
}

describe('TemarioClient — métrica de tendencia', () => {
  it('con show_topic_trend=true: muestra % y la flechita ▼', () => {
    mockAuth = { user: { id: 'u1' }, userProfile: { show_topic_trend: true } }
    renderTemario()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText(/▼15%/)).toBeInTheDocument()
  })

  it('con show_topic_trend=false: oculta la flechita pero el % SIGUE visible', () => {
    mockAuth = { user: { id: 'u1' }, userProfile: { show_topic_trend: false } }
    renderTemario()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.queryByText(/▼15%/)).not.toBeInTheDocument()
  })

  it('default (preferencia null): la flechita se muestra', () => {
    mockAuth = { user: { id: 'u1' }, userProfile: { show_topic_trend: null } }
    renderTemario()
    expect(screen.getByText(/▼15%/)).toBeInTheDocument()
  })

  it('el botón de info abre el modal explicativo', () => {
    mockAuth = { user: { id: 'u1' }, userProfile: { show_topic_trend: true } }
    renderTemario()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/¿Qué significan estos números\?/i))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // El heading es dinámico: "Tus datos en {oposicionName}" si hay oposición, o
    // "Tus datos en esta oposición" si no. Matcheamos el prefijo común.
    expect(screen.getByText(/Tus datos en/i)).toBeInTheDocument()
  })

  it('usuario no logueado: ni botón de info ni flechitas', () => {
    mockAuth = { user: null, userProfile: null }
    renderTemario()
    expect(screen.queryByText(/¿Qué significan estos números\?/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/▼15%/)).not.toBeInTheDocument()
  })
})
