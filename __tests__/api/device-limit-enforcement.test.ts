// __tests__/api/device-limit-enforcement.test.ts
// Tests for server-side device limit enforcement

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'

const mockRpc = jest.fn()      // contrato legacy {data,error}; lo configuran los tests
const mockExecute = jest.fn()  // getAdminDb().execute(sql`...`)

// AGNÓSTICO (Fase C1): deviceLimit.ts dejó de usar supabase.rpc/createClient.
//  - register_device / get_accounts_on_device se invocan vía Drizzle:
//    getAdminDb().execute(sql`SELECT * FROM fn(...)`)
//  - las lecturas se envuelven en cache Redis (getOrSet) + cache L1 in-memory.
// Para NO reescribir los ~40 escenarios, un adaptador (ver beforeEach) traduce cada
// execute(sql) al viejo contrato mockRpc(rpcName, params): así los setups {data,error}
// y las aserciones toHaveBeenCalledWith('register_device',{...}) siguen valiendo.

// Extrae los params interpolados del objeto SQL de Drizzle, EN ORDEN y preservando
// null (los StringChunk del texto son objetos {value:[...]}; todo lo demás es param,
// incluido un ${null} que Drizzle serializa como chunk null crudo).
function sqlParams(sqlObj: unknown): unknown[] {
  try {
    const chunks = (JSON.parse(JSON.stringify(sqlObj)).queryChunks || []) as unknown[]
    return chunks.filter((c) => !(c && typeof c === 'object' && Array.isArray((c as { value?: unknown }).value)))
  } catch {
    return []
  }
}
function sqlText(sqlObj: unknown): string {
  try { return JSON.stringify(sqlObj) } catch { return '' }
}

jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: (...a: unknown[]) => mockExecute(...a) }),
}))

// Cache Redis: en test ejecuta SIEMPRE la función (la caché efectiva de estos tests es
// la L1 in-memory del módulo, que clearDeviceCheckCache() vacía en beforeEach).
jest.mock('@/lib/cache/redis', () => ({
  getOrSet: (_k: string, _ttl: number, fn: () => unknown) => fn(),
  invalidate: jest.fn(),
}))

import { registerAndCheckDevice, getAccountsOnDevice, getDeviceIdFromRequest, clearDeviceCheckCache } from '@/lib/api/deviceLimit'

beforeEach(() => {
  mockRpc.mockReset()
  mockExecute.mockReset()
  clearDeviceCheckCache()
  // Adaptador SQL→RPC: enruta por nombre de función y reconstruye los params legacy
  // (incl. nulls de device_label/hw_fingerprint) para mockRpc('fn', {...}). Un {error}
  // del setup => execute lanza (Drizzle lanza ante error de query) => el código real
  // hace fail-open; un {data} => se moldea a {rows:[...]} como devuelve execute.
  mockExecute.mockImplementation(async (sqlObj: unknown) => {
    const s = sqlText(sqlObj)
    const params = sqlParams(sqlObj)
    let name = 'unknown'
    let args: Record<string, unknown> = {}
    if (s.includes('register_device')) {
      name = 'register_device'
      args = {
        p_user_id: params[0],
        p_device_id: params[1],
        p_device_label: params[2],
        p_hw_fingerprint: params[3],
      }
    } else if (s.includes('get_accounts_on_device')) {
      name = 'get_accounts_on_device'
      args = { p_device_id: params[0] }
    }
    const res = (await mockRpc(name, args)) as
      | { data?: unknown; error?: { message?: string; code?: string } }
      | undefined
    if (res?.error) {
      const e = new Error(res.error.message || 'db error') as Error & { code?: string }
      e.code = res.error.code
      throw e
    }
    const data = res?.data
    if (data == null) return { rows: [] }
    return { rows: Array.isArray(data) ? data : [data] }
  })
})

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

  it('sends correct RPC params including device_label and hw_fingerprint', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    await registerAndCheckDevice('uid', 'did', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', 'hw_abc123')
    expect(mockRpc).toHaveBeenCalledWith('register_device', {
      p_user_id: 'uid',
      p_device_id: 'did',
      p_device_label: 'Chrome / Windows',
      p_hw_fingerprint: 'hw_abc123',
    })
  })

  it('sends null hw_fingerprint when not provided', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    await registerAndCheckDevice('uid', 'did', 'Mozilla/5.0 Chrome/120')
    expect(mockRpc).toHaveBeenCalledWith('register_device', {
      p_user_id: 'uid',
      p_device_id: 'did',
      p_device_label: 'Chrome / Unknown',
      p_hw_fingerprint: null,
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
      p_device_label: 'Safari / iPhone',
    }))

    // Android Chrome (móvil)
    await registerAndCheckDevice('u', 'd2', 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile')
    expect(mockRpc).toHaveBeenLastCalledWith('register_device', expect.objectContaining({
      p_device_label: 'Chrome / Android (móvil)',
    }))

    // Mac Firefox
    await registerAndCheckDevice('u', 'd3', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Firefox/121.0')
    expect(mockRpc).toHaveBeenLastCalledWith('register_device', expect.objectContaining({
      p_device_label: 'Firefox / Mac',
    }))

    // iPad Chrome (CriOS) → antes salía mal como 'Safari / iOS', indistinguible
    // de un iPhone Safari. Ahora 'Chrome / iPad'. (caso Vanesa 02/06/2026)
    await registerAndCheckDevice('u', 'd4', 'Mozilla/5.0 (iPad; CPU OS 26_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/148.0.7778.166 Mobile/15E148 Safari/604.1')
    expect(mockRpc).toHaveBeenLastCalledWith('register_device', expect.objectContaining({
      p_device_label: 'Chrome / iPad',
    }))
  })
})

// ============================================
// CACHE: 60s TTL para evitar RPC spam (bug Paloma 30/04/2026)
// ============================================

describe('Device check cache (60s TTL)', () => {
  const ALLOWED_RESULT = {
    allowed: true, device_count: 1, max_devices: 2, is_new_device: false, is_premium: false, existing_devices: '',
  }
  const BLOCKED_RESULT = {
    allowed: false, device_count: 2, max_devices: 2, is_new_device: true, is_premium: false, existing_devices: 'Chrome / Mac, Safari / iOS',
  }

  it('returns cached result on second call (no RPC)', async () => {
    mockRpc.mockResolvedValue({ data: ALLOWED_RESULT, error: null })

    const r1 = await registerAndCheckDevice('user-1', 'device-1')
    const r2 = await registerAndCheckDevice('user-1', 'device-1')

    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
    expect(mockRpc).toHaveBeenCalledTimes(1) // Solo 1 RPC, la 2a viene de cache
  })

  it('100 calls = 1 RPC (examen de 100 preguntas)', async () => {
    mockRpc.mockResolvedValue({ data: ALLOWED_RESULT, error: null })

    for (let i = 0; i < 100; i++) {
      await registerAndCheckDevice('user-paloma', 'device-safari')
    }

    expect(mockRpc).toHaveBeenCalledTimes(1) // El bug de Paloma: antes eran 100
  })

  it('cache expires after TTL — makes new RPC', async () => {
    // Primera llamada: allowed
    mockRpc.mockResolvedValueOnce({ data: ALLOWED_RESULT, error: null })

    await registerAndCheckDevice('user-1', 'device-1')
    expect(mockRpc).toHaveBeenCalledTimes(1)

    // Simular que pasaron 61 segundos manipulando Date.now
    const realNow = Date.now
    Date.now = () => realNow() + 61_000

    // Segunda llamada: ahora está blocked (el estado cambió en BD)
    mockRpc.mockResolvedValueOnce({ data: BLOCKED_RESULT, error: null })

    const r2 = await registerAndCheckDevice('user-1', 'device-1')
    expect(r2.allowed).toBe(false)
    expect(mockRpc).toHaveBeenCalledTimes(2) // Cache expiró, nueva RPC

    Date.now = realNow // Restaurar
  })

  it('different user:device combos are cached independently', async () => {
    mockRpc.mockResolvedValue({ data: ALLOWED_RESULT, error: null })

    await registerAndCheckDevice('user-a', 'device-1')
    await registerAndCheckDevice('user-b', 'device-1')
    await registerAndCheckDevice('user-a', 'device-2')

    expect(mockRpc).toHaveBeenCalledTimes(3) // 3 claves distintas
  })

  it('cache returns blocked result correctly (no false positive)', async () => {
    mockRpc.mockResolvedValue({ data: BLOCKED_RESULT, error: null })

    const r1 = await registerAndCheckDevice('user-1', 'device-3')
    const r2 = await registerAndCheckDevice('user-1', 'device-3')

    expect(r1.allowed).toBe(false)
    expect(r2.allowed).toBe(false)
    expect(r2.existingDevices).toBe('Chrome / Mac, Safari / iOS')
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('clearDeviceCheckCache forces fresh RPC', async () => {
    mockRpc.mockResolvedValue({ data: ALLOWED_RESULT, error: null })

    await registerAndCheckDevice('user-1', 'device-1')
    expect(mockRpc).toHaveBeenCalledTimes(1)

    clearDeviceCheckCache()

    await registerAndCheckDevice('user-1', 'device-1')
    expect(mockRpc).toHaveBeenCalledTimes(2) // Cache cleared, nueva RPC
  })

  it('RPC error does NOT cache the failure (next call retries)', async () => {
    // Primera llamada: error
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'internal' } })
    const r1 = await registerAndCheckDevice('user-1', 'device-1')
    expect(r1.allowed).toBe(true) // fail open

    // Segunda llamada: debería reintentar RPC (no usar cache del error)
    mockRpc.mockResolvedValueOnce({ data: BLOCKED_RESULT, error: null })
    const r2 = await registerAndCheckDevice('user-1', 'device-1')
    expect(r2.allowed).toBe(false) // Ahora sí funciona
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })
})

// ============================================
// HW FINGERPRINT: deduplicación de dispositivos
// ============================================

describe('Hardware fingerprint deduplication', () => {
  it('passes hw_fingerprint to RPC when provided', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: false, is_premium: false },
      error: null,
    })
    await registerAndCheckDevice('user-1', 'device-1', 'Chrome/120 Windows', 'hw_abc123')
    expect(mockRpc).toHaveBeenCalledWith('register_device', expect.objectContaining({
      p_hw_fingerprint: 'hw_abc123',
    }))
  })

  it('passes null hw_fingerprint when undefined', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: false, is_premium: false },
      error: null,
    })
    await registerAndCheckDevice('user-1', 'device-1', 'Chrome/120')
    expect(mockRpc).toHaveBeenCalledWith('register_device', expect.objectContaining({
      p_hw_fingerprint: null,
    }))
  })

  it('passes null hw_fingerprint when empty string', async () => {
    mockRpc.mockResolvedValue({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: false, is_premium: false },
      error: null,
    })
    await registerAndCheckDevice('user-1', 'device-1', 'Chrome/120', '')
    expect(mockRpc).toHaveBeenCalledWith('register_device', expect.objectContaining({
      p_hw_fingerprint: null,
    }))
  })

  it('dedup scenario: same user, new device_id, same fingerprint → RPC decides (allowed)', async () => {
    // First call: device-old registered
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    const r1 = await registerAndCheckDevice('user-1', 'device-old', 'Firefox/150 Windows', 'hw_xyz')
    expect(r1.allowed).toBe(true)

    // Second call: device-new with SAME fingerprint (localStorage cleared)
    // RPC should deduplicate (replace old device_id) → allowed
    clearDeviceCheckCache()
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: false, is_premium: false },
      error: null,
    })
    const r2 = await registerAndCheckDevice('user-1', 'device-new', 'Firefox/150 Windows', 'hw_xyz')
    expect(r2.allowed).toBe(true)
    expect(r2.isNewDevice).toBe(false) // dedup, not new
  })

  it('different fingerprint = genuinely different device → RPC enforces limit', async () => {
    // Phone: Chrome/Android with fingerprint A
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, device_count: 1, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    await registerAndCheckDevice('user-1', 'phone', 'Chrome/120 Android', 'hw_phone')

    // PC: Chrome/Windows with fingerprint B
    clearDeviceCheckCache()
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, device_count: 2, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    await registerAndCheckDevice('user-1', 'pc', 'Chrome/120 Windows', 'hw_pc')

    // Tablet: Safari/iOS with fingerprint C → BLOCKED (3rd device)
    clearDeviceCheckCache()
    mockRpc.mockResolvedValueOnce({
      data: { allowed: false, device_count: 2, max_devices: 2, is_new_device: true, is_premium: false },
      error: null,
    })
    const r3 = await registerAndCheckDevice('user-1', 'tablet', 'Safari/604 iOS', 'hw_tablet')
    expect(r3.allowed).toBe(false)
    expect(r3.deviceCount).toBe(2)
  })
})

// ============================================
// FAIL OPEN: RPC ambiguity error (overloaded function)
// ============================================

describe('RPC ambiguity error (overloaded function)', () => {
  it('fails open when PostgREST cannot choose between function overloads', async () => {
    // This was the actual error: two register_device functions with 3 and 4 params
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST203',
        message: 'Could not choose the best candidate function between: public.register_device(p_user_id => uuid, p_device_id => text, p_device_label => text), public.register_device(p_user_id => uuid, p_device_id => text, p_device_label => text, p_hw_fingerprint => text)',
      },
    })
    const r = await registerAndCheckDevice('user-1', 'device-1', 'Chrome/120', 'hw_test')
    expect(r.allowed).toBe(true) // fail open — don't block users
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('fails open on any unexpected RPC error code', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'internal error' },
    })
    const r = await registerAndCheckDevice('user-1', 'device-1')
    expect(r.allowed).toBe(true)
  })
})
