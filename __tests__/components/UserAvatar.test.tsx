// __tests__/components/UserAvatar.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// ============================================
// MOCKS
// ============================================

const mockSignOut = jest.fn()
const mockRpc = jest.fn()

const mockSupabase = {
  rpc: mockRpc,
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

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthReturn = {
    user: mockUser,
    loading: false,
    signOut: mockSignOut,
    supabase: mockSupabase,
    isPremium: false,
  }
  // Default: RPC returns empty stats
  mockRpc.mockResolvedValue({ data: [{ current_streak: 5, global_accuracy: 80, questions_this_week: 42, total_questions: 300 }], error: null })
  // Default: no pending exams
  mockFetch.mockResolvedValue({ json: () => Promise.resolve({ success: true, exams: [] }) })
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

  test('RPC error {} (empty object) does NOT reset stats', async () => {
    // First render loads stats successfully
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: 10, global_accuracy: 90, questions_this_week: 50, total_questions: 500 }],
      error: null,
    })

    const { rerender } = render(<UserAvatar />)

    // Wait for initial stats to load
    await waitFor(() => {
      // Open dropdown to see stats
    })

    // Open dropdown to verify initial stats
    const button = screen.getByRole('button')
    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByTestId('stat-streak')).toHaveTextContent('10')
      expect(screen.getByTestId('stat-accuracy')).toHaveTextContent('90%')
    })

    // Now simulate RPC returning error: {} (empty object, truthy but meaningless)
    mockRpc.mockResolvedValue({
      data: null,
      error: {}, // Empty error object — the bug we're fixing
    })

    // Trigger re-render by changing user reference
    const updatedUser = { ...mockUser, id: 'user-123' }
    mockAuthReturn = { ...mockAuthReturn, user: updatedUser }

    // Force a re-render (simulating what happens when authContext refreshes)
    await act(async () => { rerender(<UserAvatar />) })

    // Stats should still be the previous values, NOT reset to 0
    await waitFor(() => {
      expect(screen.getByTestId('stat-streak')).toHaveTextContent('10')
      expect(screen.getByTestId('stat-accuracy')).toHaveTextContent('90%')
    })
  })
})
