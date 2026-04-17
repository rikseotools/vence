// __tests__/api/device-limit-enforcement.test.ts
// Tests for server-side device limit enforcement

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'

const mockRpc = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ rpc: mockRpc })),
}))

import { registerAndCheckDevice, getAccountsOnDevice, getDeviceIdFromRequest } from '@/lib/api/deviceLimit'

beforeEach(() => mockRpc.mockReset())

// ============================================
// getDeviceIdFromRequest
// ============================================

describe('getDeviceIdFromRequest', () => {
  function fakeReq(headers: Record<string, string> = {}) {
    return { headers: { get: (n: string) => headers[n.toLowerCase()] ?? null } } as any
  }

  it('returns X-Device-Id header value', () => {
    expect(getDeviceIdFromRequest(fakeReq({ 'x-device-id': 'device-abc' }))).toBe('device-abc')
  })

  it('returns null when no header', () => {
    expect(getDeviceIdFromRequest(fakeReq())).toBeNull()
  })
})

// ============================================
// registerAndCheckDevice
// ============================================

describe('registerAndCheckDevice', () => {
  it('allows when no userId (anonymous)', async () => {
    const r = await registerAndCheckDevice(null, 'device-1')
    expect(r.allowed).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('allows when no deviceId', async () => {
    const r = await registerAndCheckDevice('user-1', null)
    expect(r.allowed).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('allows known device (already registered)', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: false, is_premium: false },
      error: null,
    })
    const r = await registerAndCheckDevice('user-1', 'device-1', 'Chrome/120 Windows')
    expect(r.allowed).toBe(true)
    expect(r.isNewDevice).toBe(false)
    expect(r.deviceCount).toBe(1)
  })

  it('allows new device when under limit (free, 1 of 2)', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 2, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    const r = await registerAndCheckDevice('user-1', 'device-2')
    expect(r.allowed).toBe(true)
    expect(r.isNewDevice).toBe(true)
    expect(r.deviceCount).toBe(2)
  })

  it('BLOCKS free user on 3rd device', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: false, device_count: 2, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    const r = await registerAndCheckDevice('user-1', 'device-3')
    expect(r.allowed).toBe(false)
    expect(r.deviceCount).toBe(2)
    expect(r.maxDevices).toBe(2)
  })

  it('allows premium user on 4th device (alert only, no block)', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 3, max_devices: 3, is_new_device: true, is_premium: true },
      error: null,
    })
    const r = await registerAndCheckDevice('premium-user', 'device-4')
    expect(r.allowed).toBe(true)
    expect(r.isPremium).toBe(true)
  })

  it('fails open if table does not exist (42P01)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    const r = await registerAndCheckDevice('user-1', 'device-1')
    expect(r.allowed).toBe(true)
  })

  it('fails open if function does not exist (PGRST202)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } })
    const r = await registerAndCheckDevice('user-1', 'device-1')
    expect(r.allowed).toBe(true)
  })

  it('fails open on unexpected exception', async () => {
    mockRpc.mockRejectedValue(new Error('timeout'))
    const r = await registerAndCheckDevice('user-1', 'device-1')
    expect(r.allowed).toBe(true)
  })

  it('handles array response from RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [{ allowed: false, device_count: 2, max_devices: 2, is_new_device: true, is_premium: false }],
      error: null,
    })
    const r = await registerAndCheckDevice('user-1', 'device-3')
    expect(r.allowed).toBe(false)
  })

  it('sends correct RPC params including device_label', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    await registerAndCheckDevice('uid', 'did', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120')
    expect(mockRpc).toHaveBeenCalledWith('register_device', {
      p_user_id: 'uid',
      p_device_id: 'did',
      p_device_label: 'Chrome / Windows',
    })
  })
})

// ============================================
// getAccountsOnDevice
// ============================================

describe('getAccountsOnDevice', () => {
  it('returns empty for empty deviceId', async () => {
    expect(await getAccountsOnDevice('')).toEqual([])
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns user_ids from RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'user-a' }, { user_id: 'user-b' }],
      error: null,
    })
    expect(await getAccountsOnDevice('shared-device')).toEqual(['user-a', 'user-b'])
  })

  it('returns empty on table not found', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42P01', message: 'not found' } })
    expect(await getAccountsOnDevice('device')).toEqual([])
  })

  it('returns empty on exception', async () => {
    mockRpc.mockRejectedValue(new Error('err'))
    expect(await getAccountsOnDevice('device')).toEqual([])
  })
})

// ============================================
// ATTACK SCENARIOS
// ============================================

describe('Device limit attack scenarios', () => {
  it('ATTACK: Free user uses 3 devices to get 75 questions/day — 3rd device blocked', async () => {
    // Device 1: registered OK
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    // Device 2: registered OK
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, device_count: 2, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    // Device 3: BLOCKED
    mockRpc.mockResolvedValueOnce({
      data: { allowed: false, device_count: 2, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })

    expect((await registerAndCheckDevice('free-user', 'phone')).allowed).toBe(true)
    expect((await registerAndCheckDevice('free-user', 'laptop')).allowed).toBe(true)
    expect((await registerAndCheckDevice('free-user', 'tablet')).allowed).toBe(false)
  })

  it('ATTACK: Multi-account — same device used by 2 free accounts', async () => {
    // Both accounts register the same device
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })

    await registerAndCheckDevice('user-a', 'shared-device')
    await registerAndCheckDevice('user-b', 'shared-device')

    // getAccountsOnDevice shows both
    mockRpc.mockResolvedValueOnce({
      data: [{ user_id: 'user-a' }, { user_id: 'user-b' }],
      error: null,
    })

    const accounts = await getAccountsOnDevice('shared-device')
    expect(accounts).toContain('user-a')
    expect(accounts).toContain('user-b')
    expect(accounts.length).toBe(2)
  })

  it('DEVICE LABEL: parses user agent correctly', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })

    // iPhone Safari
    await registerAndCheckDevice('u', 'd1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1')
    expect(mockRpc).toHaveBeenLastCalledWith('register_device', expect.objectContaining({
      p_device_label: 'Safari / iOS',
    }))

    // Android Chrome
    await registerAndCheckDevice('u', 'd2', 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile')
    expect(mockRpc).toHaveBeenLastCalledWith('register_device', expect.objectContaining({
      p_device_label: 'Chrome / Android',
    }))

    // Mac Firefox
    await registerAndCheckDevice('u', 'd3', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Firefox/121.0')
    expect(mockRpc).toHaveBeenLastCalledWith('register_device', expect.objectContaining({
      p_device_label: 'Firefox / Mac',
    }))
  })
})
