// __tests__/api/v2/devices.test.ts
// Tests de la API de gestión de dispositivos y lógica del modal

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')

// ============================================
// 1. SCHEMAS (Zod)
// ============================================
describe('devices schemas', () => {
  const { removeDeviceRequestSchema, deviceSchema } = require('@/lib/api/v2/devices/schemas')

  describe('removeDeviceRequestSchema', () => {
    it('acepta UUID válido', () => {
      const result = removeDeviceRequestSchema.safeParse({ deviceId: '4bb57cf2-9512-4881-b2d0-4f7238eedba2' })
      expect(result.success).toBe(true)
    })

    it('rechaza string vacío', () => {
      const result = removeDeviceRequestSchema.safeParse({ deviceId: '' })
      expect(result.success).toBe(false)
    })

    it('rechaza sin deviceId', () => {
      const result = removeDeviceRequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rechaza UUID inválido', () => {
      const result = removeDeviceRequestSchema.safeParse({ deviceId: 'not-a-uuid' })
      expect(result.success).toBe(false)
    })

    it('rechaza null', () => {
      const result = removeDeviceRequestSchema.safeParse({ deviceId: null })
      expect(result.success).toBe(false)
    })
  })

  describe('deviceSchema', () => {
    it('acepta device completo', () => {
      const result = deviceSchema.safeParse({
        id: '4bb57cf2-9512-4881-b2d0-4f7238eedba2',
        deviceLabel: 'Chrome / Android',
        lastSeenAt: '2026-04-24T14:21:36.710Z',
      })
      expect(result.success).toBe(true)
    })

    it('acepta deviceLabel null', () => {
      const result = deviceSchema.safeParse({
        id: '4bb57cf2-9512-4881-b2d0-4f7238eedba2',
        deviceLabel: null,
        lastSeenAt: '2026-04-24T14:21:36.710Z',
      })
      expect(result.success).toBe(true)
    })

    it('rechaza id inválido', () => {
      const result = deviceSchema.safeParse({
        id: 'bad',
        deviceLabel: 'Chrome',
        lastSeenAt: '2026-04-24',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// 2. ROUTE SOURCE CODE
// ============================================
describe('devices route — source code', () => {
  const routeSrc = fs.readFileSync(path.join(ROOT, 'app/api/v2/devices/route.ts'), 'utf-8')

  it('exporta GET y DELETE', () => {
    expect(routeSrc).toMatch(/export const GET/)
    expect(routeSrc).toMatch(/export const DELETE/)
  })

  it('usa withErrorLogging', () => {
    expect(routeSrc).toMatch(/withErrorLogging\('\/api\/v2\/devices'/)
  })

  it('verifica autenticación via Bearer token', () => {
    expect(routeSrc).toMatch(/authorization/)
    expect(routeSrc).toMatch(/Bearer/)
    expect(routeSrc).toMatch(/getUser/)
  })

  it('usa Zod para validar DELETE', () => {
    expect(routeSrc).toMatch(/removeDeviceRequestSchema\.safeParse/)
  })

  it('devuelve 401 si no autenticado', () => {
    expect(routeSrc).toMatch(/No autorizado/)
    expect(routeSrc).toMatch(/status: 401/)
  })

  it('devuelve 400 si body inválido', () => {
    expect(routeSrc).toMatch(/status: 400/)
  })

  it('llama a listUserDevices para GET', () => {
    expect(routeSrc).toMatch(/listUserDevices\(userId\)/)
  })

  it('llama a removeUserDevice para DELETE', () => {
    expect(routeSrc).toMatch(/removeUserDevice\(userId/)
  })
})

// ============================================
// 3. QUERIES SOURCE CODE
// ============================================
describe('devices queries — source code', () => {
  const queriesSrc = fs.readFileSync(path.join(ROOT, 'lib/api/v2/devices/queries.ts'), 'utf-8')

  it('usa Drizzle ORM (no SQL directo)', () => {
    expect(queriesSrc).toMatch(/from\(userDevices\)/)
    expect(queriesSrc).toMatch(/eq\(userDevices\.userId/)
    expect(queriesSrc).not.toMatch(/db\.execute\(sql/)
  })

  it('exporta listUserDevices', () => {
    expect(queriesSrc).toMatch(/export async function listUserDevices/)
  })

  it('exporta removeUserDevice', () => {
    expect(queriesSrc).toMatch(/export async function removeUserDevice/)
  })

  it('ordena por lastSeenAt DESC', () => {
    expect(queriesSrc).toMatch(/desc\(userDevices\.lastSeenAt\)/)
  })

  it('DELETE filtra por userId AND deviceId (seguridad)', () => {
    expect(queriesSrc).toMatch(/and\(eq\(userDevices\.id, deviceId\), eq\(userDevices\.userId, userId\)\)/)
  })

  it('usa returning para confirmar borrado', () => {
    expect(queriesSrc).toMatch(/\.returning\(/)
  })
})

// ============================================
// 4. DRIZZLE SCHEMA
// ============================================
describe('userDevices — Drizzle schema', () => {
  const schemaSrc = fs.readFileSync(path.join(ROOT, 'db/schema.ts'), 'utf-8')

  it('define userDevices table', () => {
    expect(schemaSrc).toMatch(/export const userDevices = pgTable\("user_devices"/)
  })

  it('tiene columnas requeridas', () => {
    expect(schemaSrc).toMatch(/userId:.*uuid\("user_id"\)/)
    expect(schemaSrc).toMatch(/deviceId:.*text\("device_id"\)/)
    expect(schemaSrc).toMatch(/deviceLabel:.*text\("device_label"\)/)
    expect(schemaSrc).toMatch(/lastSeenAt:.*timestamp\("last_seen_at"/)
    expect(schemaSrc).toMatch(/hwFingerprint:.*text\("hw_fingerprint"\)/)
  })

  it('tiene unique constraint en userId + deviceId', () => {
    expect(schemaSrc).toMatch(/unique\("user_devices_user_id_device_id_key"\)\.on\(table\.userId, table\.deviceId\)/)
  })
})

// ============================================
// 5. DEVICE LIMIT MODAL SOURCE CODE
// ============================================
describe('DeviceLimitModal — source code', () => {
  const modalSrc = fs.readFileSync(path.join(ROOT, 'components/DeviceLimitModal.tsx'), 'utf-8')

  it('es un componente client-side', () => {
    expect(modalSrc).toMatch(/'use client'/)
  })

  it('llama a GET /api/v2/devices para listar', () => {
    expect(modalSrc).toMatch(/fetch\('\/api\/v2\/devices'/)
  })

  it('llama a DELETE /api/v2/devices para desconectar', () => {
    expect(modalSrc).toMatch(/method: 'DELETE'/)
    expect(modalSrc).toMatch(/\/api\/v2\/devices/)
  })

  it('usa getAuthHeaders para autenticación', () => {
    expect(modalSrc).toMatch(/getAuthHeaders/)
  })

  it('tiene botón Desconectar por cada device', () => {
    expect(modalSrc).toMatch(/Desconectar/)
    expect(modalSrc).toMatch(/Desconectando\.\.\./)
  })

  it('ejecuta onRetry tras desconectar exitosamente', () => {
    expect(modalSrc).toMatch(/onRetry\(\)/)
  })

  it('muestra estado loading', () => {
    expect(modalSrc).toMatch(/Cargando dispositivos/)
  })

  it('muestra errores', () => {
    expect(modalSrc).toMatch(/No se pudo desconectar/)
    expect(modalSrc).toMatch(/Error de conexion/)
  })

  it('diferencia icono móvil vs desktop', () => {
    expect(modalSrc).toMatch(/android.*ios/i)
  })

  it('formatea fechas relativas', () => {
    expect(modalSrc).toMatch(/Hoy/)
    expect(modalSrc).toMatch(/Ayer/)
    expect(modalSrc).toMatch(/Hace.*dias/)
  })

  it('muestra texto informativo sobre el límite', () => {
    expect(modalSrc).toMatch(/Puedes conectar hasta 2 dispositivos/)
  })
})

// ============================================
// 6. HOOK useDeviceLimitModal
// ============================================
describe('useDeviceLimitModal — source code', () => {
  const hookSrc = fs.readFileSync(path.join(ROOT, 'hooks/useDeviceLimitModal.ts'), 'utf-8')

  it('escucha evento global vence:deviceLimitReached', () => {
    expect(hookSrc).toMatch(/vence:deviceLimitReached/)
    expect(hookSrc).toMatch(/addEventListener/)
    expect(hookSrc).toMatch(/removeEventListener/)
  })

  it('exporta dispatchDeviceLimitEvent', () => {
    expect(hookSrc).toMatch(/export function dispatchDeviceLimitEvent/)
  })

  it('retorna isDeviceLimitOpen, openDeviceLimitModal, closeDeviceLimit, retryAfterDeviceRemoval', () => {
    expect(hookSrc).toMatch(/isDeviceLimitOpen/)
    expect(hookSrc).toMatch(/openDeviceLimitModal/)
    expect(hookSrc).toMatch(/closeDeviceLimit/)
    expect(hookSrc).toMatch(/retryAfterDeviceRemoval/)
  })

  it('guarda retryFn en ref para evitar closures stale', () => {
    expect(hookSrc).toMatch(/retryFnRef/)
    expect(hookSrc).toMatch(/useRef/)
  })
})

// ============================================
// 7. INTEGRACIÓN: answerSaveQueue emite evento
// ============================================
describe('answerSaveQueue — device limit event', () => {
  const queueSrc = fs.readFileSync(path.join(ROOT, 'utils/answerSaveQueue.ts'), 'utf-8')

  it('detecta deviceLimitReached en respuesta 403', () => {
    expect(queueSrc).toMatch(/deviceLimitReached/)
  })

  it('emite evento vence:deviceLimitReached', () => {
    expect(queueSrc).toMatch(/vence:deviceLimitReached/)
    expect(queueSrc).toMatch(/CustomEvent/)
    expect(queueSrc).toMatch(/dispatchEvent/)
  })

  it('parsea body JSON del 403 (no text)', () => {
    expect(queueSrc).toMatch(/response\.json\(\)/)
  })
})

// ============================================
// 8. INTEGRACIÓN: componentes de test usan el modal
// ============================================
describe('componentes de test — DeviceLimitModal integrado', () => {
  const components = [
    { name: 'TestLayout', file: 'components/TestLayout.tsx' },
    { name: 'PsychometricTestLayout', file: 'components/PsychometricTestLayout.tsx' },
    { name: 'DynamicTest', file: 'components/DynamicTest.tsx' },
  ]

  for (const { name, file } of components) {
    describe(name, () => {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf-8')

      it('importa DeviceLimitModal', () => {
        expect(src).toMatch(/import DeviceLimitModal/)
      })

      it('importa useDeviceLimitModal', () => {
        expect(src).toMatch(/import.*useDeviceLimitModal/)
      })

      it('usa el hook useDeviceLimitModal', () => {
        expect(src).toMatch(/useDeviceLimitModal\(\)/)
      })

      it('renderiza <DeviceLimitModal />', () => {
        expect(src).toMatch(/<DeviceLimitModal/)
      })

      it('pasa isOpen, onClose y onRetry al modal', () => {
        expect(src).toMatch(/isOpen=\{isDeviceLimitOpen\}/)
        expect(src).toMatch(/onClose=\{closeDeviceLimit\}/)
        expect(src).toMatch(/onRetry=\{retryAfterDeviceRemoval\}/)
      })
    })
  }
})

// ============================================
// 9. ERROR MESSAGES — no dice "hazte premium" a premium
// ============================================
describe('device limit error messages', () => {
  const endpoints = [
    'app/api/v2/answer-and-save/route.ts',
    'app/api/answer/route.ts',
    'app/api/answer/psychometric/route.ts',
    'app/api/exam/answer/route.ts',
  ]

  for (const file of endpoints) {
    it(`${file} muestra dispositivos en el mensaje de error`, () => {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      expect(src).toMatch(/existingDevices/)
      expect(src).toMatch(/deviceCheck\.existingDevices/)
    })

    it(`${file} envía existingDevices en la respuesta`, () => {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      expect(src).toMatch(/existingDevices: deviceCheck\.existingDevices/)
    })
  }
})

// ============================================
// 10. RPC register_device devuelve existing_devices
// ============================================
describe('register_device RPC', () => {
  const deviceLimitSrc = fs.readFileSync(path.join(ROOT, 'lib/api/deviceLimit.ts'), 'utf-8')

  it('interface DeviceCheckResult tiene existingDevices', () => {
    expect(deviceLimitSrc).toMatch(/existingDevices: string/)
  })

  it('FAIL_OPEN tiene existingDevices vacío', () => {
    expect(deviceLimitSrc).toMatch(/existingDevices: ''/)
  })

  it('mapea existing_devices del RPC', () => {
    expect(deviceLimitSrc).toMatch(/result\.out_existing_devices.*result\.existing_devices/)
  })
})
