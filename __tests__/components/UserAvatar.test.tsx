// __tests__/components/UserAvatar.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// ============================================
// MOCKS
// ============================================

const mockSignOut = jest.fn()

const mockSupabase = {
  rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
}

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  created_at: '2025-01-01T00:00:00Z',
  user_metadata: { full_name: 'Maria Garcia' },
}

let mockAuthReturn: Record<string, unknown> = {
  user: mockUser,
  loading: false,
  signOut: mockSignOut,
  supabase: mockSupabase,
  isPremium: false,
}

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}))

jest.mock('@/hooks/useAdminNotifications', () => ({
  useAdminNotifications: () => ({ feedback: 0, impugnaciones: 0, ventas: 0, loading: false }),
}))

jest.mock('@/hooks/useSentryIssues', () => ({
  useSentryIssues: () => ({ issuesCount: 0, issues: [], loading: false, error: null, refetch: jest.fn() }),
}))

jest.mock('next/link', () => {
  return ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  )
})

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Import after mocks
import UserAvatar from '../../components/UserAvatar'

// ============================================
// HELPERS
// ============================================

function mockStatsResponse(stats: { currentStreak?: number; globalAccuracy?: number; questionsThisWeek?: number; totalQuestions?: number }) {
  return {
    ok: true,
    json: () => Promise.resolve({ success: true, ...stats }),
  }
}

function mockPendingExamsResponse(exams: unknown[] = []) {
  return {
    ok: true,
    json: () => Promise.resolve({ success: true, exams }),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthReturn = {
    user: mockUser,
    loading: false,
    signOut: mockSignOut,
    supabase: mockSupabase,
    isPremium: false,
  }
  // Default fetch: route based
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/v2/user-stats')) {
      return Promise.resolve(mockStatsResponse({ currentStreak: 5, globalAccuracy: 80, questionsThisWeek: 42, totalQuestions: 300 }))
    }
    if (url.includes('/api/exam/pending')) {
      return Promise.resolve(mockPendingExamsResponse())
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
})

// ============================================
// TESTS
// ============================================

describe('UserAvatar', () => {
  test('shows skeleton when authLoading=true', () => {
    mockAuthReturn = { ...mockAuthReturn, loading: true }
    const { container } = render(<UserAvatar />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  test('shows login button when no user', () => {
    mockAuthReturn = { ...mockAuthReturn, user: null }
    render(<UserAvatar />)
    const link = screen.getByText('Iniciar Sesion')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/login')
  })

  test('shows emoji avatar when avatar_type is predefined', async () => {
    mockAuthReturn = {
      ...mockAuthReturn,
      user: {
        ...mockUser,
        user_metadata: {
          full_name: 'Maria Garcia',
          avatar_type: 'predefined',
          avatar_emoji: '🦊',
          avatar_color: 'from-purple-500 to-pink-500',
        },
      },
    }
    render(<UserAvatar />)
    await waitFor(() => {
      expect(screen.getAllByText('🦊').length).toBeGreaterThan(0)
    })
  })

  test('shows img element when avatar_url is set', async () => {
    mockAuthReturn = {
      ...mockAuthReturn,
      user: {
        ...mockUser,
        user_metadata: {
          full_name: 'Maria Garcia',
          avatar_url: 'https://example.com/photo.jpg',
        },
      },
    }
    render(<UserAvatar />)
    await waitFor(() => {
      const imgs = screen.getAllByAltText('Avatar')
      expect(imgs.length).toBeGreaterThan(0)
      expect(imgs[0]).toHaveAttribute('src', 'https://example.com/photo.jpg')
    })
  })

  test('shows initial when no emoji or photo', async () => {
    render(<UserAvatar />)
    await waitFor(() => {
      // "M" from "Maria Garcia"
      expect(screen.getAllByText('M').length).toBeGreaterThan(0)
    })
  })

  test('shows premium crown when isPremium=true', async () => {
    mockAuthReturn = { ...mockAuthReturn, isPremium: true }
    render(<UserAvatar />)
    await waitFor(() => {
      expect(screen.getByTitle('Premium')).toBeInTheDocument()
    })
  })

  test('toggles dropdown on avatar click', async () => {
    render(<UserAvatar />)

    // Dropdown should not be visible initially
    expect(screen.queryByText('Tu Progreso', { exact: false })).not.toBeInTheDocument()

    // Click avatar button
    const button = screen.getByRole('button')
    await act(async () => { fireEvent.click(button) })

    // Dropdown should be visible
    await waitFor(() => {
      expect(screen.getByText('Tu Progreso', { exact: false })).toBeInTheDocument()
    })
  })

  test('displays stats in dropdown', async () => {
    render(<UserAvatar />)

    // Open dropdown
    const button = screen.getByRole('button')
    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByTestId('stat-streak')).toHaveTextContent('5')
      expect(screen.getByTestId('stat-accuracy')).toHaveTextContent('80%')
      expect(screen.getByTestId('stat-weekly')).toHaveTextContent('42')
      expect(screen.getByTestId('stat-total')).toHaveTextContent('300')
    })
  })

  test('calls signOut on "Cerrar Sesion" click', async () => {
    render(<UserAvatar />)

    // Open dropdown
    const avatarBtn = screen.getByRole('button')
    await act(async () => { fireEvent.click(avatarBtn) })

    await waitFor(() => {
      expect(screen.getByText('Cerrar Sesion')).toBeInTheDocument()
    })

    await act(async () => { fireEvent.click(screen.getByText('Cerrar Sesion')) })
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  test('API error does NOT reset stats', async () => {
    // First render loads stats successfully
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/v2/user-stats')) {
        return Promise.resolve(mockStatsResponse({ currentStreak: 10, globalAccuracy: 90, questionsThisWeek: 50, totalQuestions: 500 }))
      }
      if (url.includes('/api/exam/pending')) {
        return Promise.resolve(mockPendingExamsResponse())
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const { rerender } = render(<UserAvatar />)

    // Open dropdown to verify initial stats
    const button = screen.getByRole('button')
    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByTestId('stat-streak')).toHaveTextContent('10')
      expect(screen.getByTestId('stat-accuracy')).toHaveTextContent('90%')
    })

    // Now simulate API returning error
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/v2/user-stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: false, error: 'Error interno' }),
        })
      }
      if (url.includes('/api/exam/pending')) {
        return Promise.resolve(mockPendingExamsResponse())
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    // Trigger re-render
    const updatedUser = { ...mockUser, id: 'user-123' }
    mockAuthReturn = { ...mockAuthReturn, user: updatedUser }

    await act(async () => { rerender(<UserAvatar />) })

    // Stats should still be the previous values, NOT reset to 0
    await waitFor(() => {
      expect(screen.getByTestId('stat-streak')).toHaveTextContent('10')
      expect(screen.getByTestId('stat-accuracy')).toHaveTextContent('90%')
    })
  })
})
