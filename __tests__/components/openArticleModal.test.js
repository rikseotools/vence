// __tests__/components/openArticleModal.test.js
// Tests específicos para la función openArticleModal que causaba errores 404

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock del contexto de autenticación
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    supabase: null
  })
}))

// Mock del ArticleModal
jest.mock('../../components/ArticleModal', () => {
  return function MockArticleModal({ isOpen, articleNumber, lawSlug, onClose }) {
    if (!isOpen) return null
    return (
      <div data-testid="article-modal">
        <div data-testid="article-number">{articleNumber}</div>
        <div data-testid="law-slug">{lawSlug}</div>
        <button onClick={onClose} data-testid="close-modal">Cerrar</button>
      </div>
    )
  }
})

// Componente de prueba que simula la funcionalidad de openArticleModal
function TestOpenArticleModalComponent() {
  const [selectedArticle, setSelectedArticle] = React.useState(null)
  const [modalOpen, setModalOpen] = React.useState(false)

  // Esta es la función CORREGIDA (post-fix)
  function openArticleModal(articleNumber, lawName) {
    // Convertir nombre de ley a slug (espacios a guiones, barras a guiones)
    const lawSlug = lawName?.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') || 'ley-desconocida'
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
    // Limpiar cualquier estado residual
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
      
      // CRÍTICO: Debe convertir "/" a "-"
      expect(lawSlug.textContent).toBe('lo-6-1985')
      expect(lawSlug.textContent).not.toContain('/')
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
      
      expect(lawSlug.textContent).toBe('ce')
      expect(lawSlug.textContent).not.toContain('/')
    })
  })

  describe('Validación de URLs generadas', () => {
    test('debe generar URLs de API válidas para todas las leyes', () => {
      const testCases = [
        { lawName: 'Ley 50/1997', articleNumber: '15', expectedSlug: 'ley-50-1997' },
        { lawName: 'Ley 39/2015', articleNumber: '24', expectedSlug: 'ley-39-2015' },
        { lawName: 'LO 6/1985', articleNumber: '24', expectedSlug: 'lo-6-1985' },
        { lawName: 'RD 203/2021', articleNumber: '5', expectedSlug: 'rd-203-2021' },
        { lawName: 'CE', articleNumber: '14', expectedSlug: 'ce' }
      ]

      testCases.forEach(({ lawName, articleNumber, expectedSlug }) => {
        // Simular la lógica de openArticleModal
        const lawSlug = lawName?.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') || 'ley-desconocida'
        
        expect(lawSlug).toBe(expectedSlug)
        
        // Construir URL de API
        const apiUrl = `/api/teoria/${lawSlug}/${articleNumber}`
        
        // Verificar que la URL es válida
        expect(apiUrl).not.toContain('//')
        expect(apiUrl).not.toMatch(/\/api\/teoria\/[^\/]*\/[^\/]*\//)
        expect(lawSlug).not.toContain('/')
      })
    })
  })

  describe('Casos edge', () => {
    test('debe manejar nombres de ley null/undefined', () => {
      const generateSlug = (lawName) => 
        lawName?.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') || 'ley-desconocida'

      expect(generateSlug(null)).toBe('ley-desconocida')
      expect(generateSlug(undefined)).toBe('ley-desconocida')
      expect(generateSlug('')).toBe('ley-desconocida')
    })

    test('debe manejar espacios múltiples y caracteres especiales', () => {
      const generateSlug = (lawName) => 
        lawName?.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') || 'ley-desconocida'

      expect(generateSlug('Ley  50/1997   Base')).toBe('ley-50-1997-base')
      expect(generateSlug('RD 203/2021/Anexo')).toBe('rd-203-2021-anexo')
    })
  })

  describe('Integración con reportes de error', () => {
    test('los slugs generados deben ser reportados correctamente en errores', () => {
      const problematicLaws = [
        'Ley 50/1997',
        'Ley 39/2015', 
        'LO 6/1985'
      ]

      problematicLaws.forEach(lawName => {
        const lawSlug = lawName?.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') || 'ley-desconocida'
        
        // Simular el mensaje de error que se enviaría
        const errorMessage = `🚨 ERROR CARGA ARTÍCULO
📄 Artículo: 15
⚖️ Ley (original): ${lawSlug}
🔗 API que falló: /api/teoria/${lawSlug}/15`

        // Verificar que el mensaje de error es claro y útil
        expect(errorMessage).toContain(lawSlug)
        expect(errorMessage).not.toContain('undefined')
        expect(lawSlug).not.toContain('/')
      })
    })
  })
})

// Import React aquí para evitar errores
const React = require('react')