// __tests__/pages/TemaPage.test.js
// Tests unitarios para la página de test por tema

import { render } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock de Next.js
jest.mock('next/link', () => {
  return ({ children }) => <div>{children}</div>
})

// Mock de useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ numero: '2' })
}))

// Mock de Supabase
jest.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(), 
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        tema_number: 1,
        tema_name: 'Ley 19/2013'
      },
      error: null
    }),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test_user_123' } },
        error: null
      })
    }
  })
}))

// Mock de componentes
jest.mock('@/components/TestConfigurator', () => {
  return function MockTestConfigurator() {
    return <div data-testid="test-configurator">Test Configurator</div>
  }
})

jest.mock('@/components/ArticleModal', () => {
  return function MockArticleModal() {
    return <div data-testid="article-modal">Article Modal</div>
  }
})

// Mock de contextos
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test_user_123' },
    loading: false
  })
}))

// Importar el componente después de los mocks
import TemaPage from '../../app/auxiliar-administrativo-estado/test/tema/[numero]/page'

describe('TemaPage - Tests Básicos', () => {
  test('should render without crashing', () => {
    // Test básico para verificar que el componente se renderiza sin errores
    const { container } = render(<TemaPage params={{ numero: '2' }} />)
    expect(container).toBeInTheDocument()
  })

  test('should accept params prop', () => {
    // Test para verificar que acepta el prop params correctamente
    expect(() => {
      render(<TemaPage params={{ numero: '5' }} />)
    }).not.toThrow()
  })
})