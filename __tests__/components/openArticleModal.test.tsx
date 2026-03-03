// __tests__/components/openArticleModal.test.js
// Tests específicos para la función openArticleModal que genera slugs de ley

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { generateLawSlug } from '../../lib/lawMappingUtils'

// Mock del contexto de autenticación
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    supabase: null
  })
}))

// Componente de prueba que simula la funcionalidad de openArticleModal
function TestOpenArticleModalComponent() {
  const [selectedArticle, setSelectedArticle] = React.useState(null)
  const [modalOpen, setModalOpen] = React.useState(false)

  function openArticleModal(articleNumber, lawName) {
    const lawSlug = lawName ? generateLawSlug(lawName) : 'ley-desconocida'
    setSelectedArticle({ number: articleNumber, lawSlug })
    setModalOpen(true)
  }

  function closeArticleModal() {
    setModalOpen(false)
    setSelectedArticle(null)
  }

  return (
    <div>
      <button
        onClick={() => openArticleModal('15', 'Ley 50/1997')}
        data-testid="test-ley-50-1997"
      >
        Ver Art. 15 Ley 50/1997
      </button>

      <button
        onClick={() => openArticleModal('24', 'LO 6/1985')}
        data-testid="test-lo-6-1985"
      >
        Ver Art. 24 LO 6/1985
      </button>

      <button
        onClick={() => openArticleModal('14', 'CE')}
        data-testid="test-ce"
      >
        Ver Art. 14 CE
      </button>

      <button
        onClick={() => openArticleModal('5', 'Hojas de cálculo. Excel')}
        data-testid="test-excel"
      >
        Ver Art. 5 Excel
      </button>

      {modalOpen && selectedArticle && (
        <div data-testid="article-modal">
          <div data-testid="article-number">{selectedArticle.number}</div>
          <div data-testid="law-slug">{selectedArticle.lawSlug}</div>
          <button onClick={closeArticleModal} data-testid="close-modal">Cerrar</button>
        </div>
      )}
    </div>
  )
}

describe('openArticleModal Function', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Casos que anteriormente fallaban con 404', () => {
    test('debe manejar "Ley 50/1997" sin barras en el slug', async () => {
      render(<TestOpenArticleModalComponent />)

      const button = screen.getByTestId('test-ley-50-1997')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('article-modal')).toBeInTheDocument()
      })

      const lawSlug = screen.getByTestId('law-slug')
      const articleNumber = screen.getByTestId('article-number')

      // CRÍTICO: El slug NO debe contener barras
      expect(lawSlug.textContent).toBe('ley-50-1997')
      expect(lawSlug.textContent).not.toContain('/')
      expect(articleNumber.textContent).toBe('15')
    })

    test('debe manejar "LO 6/1985" correctamente', async () => {
      render(<TestOpenArticleModalComponent />)

      const button = screen.getByTestId('test-lo-6-1985')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('article-modal')).toBeInTheDocument()
      })

      const lawSlug = screen.getByTestId('law-slug')

      expect(lawSlug.textContent).toBe('lo-6-1985')
      expect(lawSlug.textContent).not.toContain('/')
    })

    test('debe manejar "Hojas de cálculo. Excel" sin acentos ni puntos', async () => {
      render(<TestOpenArticleModalComponent />)

      const button = screen.getByTestId('test-excel')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('article-modal')).toBeInTheDocument()
      })

      const lawSlug = screen.getByTestId('law-slug')

      // CRÍTICO: Debe generar slug válido sin acentos ni puntos
      expect(lawSlug.textContent).toBe('hojas-de-calculo-excel')
      expect(lawSlug.textContent).not.toContain('á')
      expect(lawSlug.textContent).not.toContain('.')
    })
  })

  describe('Casos que siempre funcionaron', () => {
    test('debe manejar "CE" sin cambios problemáticos', async () => {
      render(<TestOpenArticleModalComponent />)

      const button = screen.getByTestId('test-ce')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('article-modal')).toBeInTheDocument()
      })

      const lawSlug = screen.getByTestId('law-slug')

      expect(lawSlug.textContent).toBe('constitucion-espanola')
      expect(lawSlug.textContent).not.toContain('/')
    })
  })

  describe('Validación de URLs generadas via generateLawSlug', () => {
    test('debe generar slugs válidos para todas las leyes', () => {
      const testCases = [
        { lawName: 'Ley 50/1997', expectedSlug: 'ley-50-1997' },
        { lawName: 'Ley 39/2015', expectedSlug: 'ley-39-2015' },
        { lawName: 'LO 6/1985', expectedSlug: 'lo-6-1985' },
        { lawName: 'CE', expectedSlug: 'constitucion-espanola' },
        { lawName: 'Hojas de cálculo. Excel', expectedSlug: 'hojas-de-calculo-excel' },
      ]

      testCases.forEach(({ lawName, expectedSlug }) => {
        const lawSlug = generateLawSlug(lawName)

        expect(lawSlug).toBe(expectedSlug)
        expect(lawSlug).not.toContain('/')
        expect(lawSlug).not.toContain('á')
        expect(lawSlug).not.toContain('.')
      })
    })
  })

  describe('Casos edge', () => {
    test('debe manejar nombres de ley null/undefined', () => {
      const getSlug = (lawName) => lawName ? generateLawSlug(lawName) : 'ley-desconocida'

      expect(getSlug(null)).toBe('ley-desconocida')
      expect(getSlug(undefined)).toBe('ley-desconocida')
      expect(getSlug('')).toBe('ley-desconocida')
    })
  })

  describe('Integración con reportes de error', () => {
    test('los slugs generados no deben contener caracteres problemáticos', () => {
      const problematicLaws = [
        'Ley 50/1997',
        'Ley 39/2015',
        'LO 6/1985',
        'Hojas de cálculo. Excel',
      ]

      problematicLaws.forEach(lawName => {
        const lawSlug = generateLawSlug(lawName)

        expect(lawSlug).not.toContain('/')
        expect(lawSlug).not.toContain('á')
        expect(lawSlug).not.toContain('é')
        expect(lawSlug).not.toContain('.')
        expect(lawSlug).not.toContain(' ')
      })
    })
  })
})

// Import React aquí para evitar errores
const React = require('react')
