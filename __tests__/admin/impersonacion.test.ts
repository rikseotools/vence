// Núcleo de la suplantación (T-289): las decisiones, sin red ni BD.
//
// Lo que se prueba aquí es exactamente lo que impide que «ver la cuenta de alguien» se
// convierta en «escribir en la cuenta de alguien».
import {
  permitidoDuranteImpersonacion,
  decidirImpersonacion,
  payloadSesionImpersonada,
  esImpersonacion,
  adminQueSuplanta,
  TTL_IMPERSONACION_SEG,
} from '@/lib/admin/impersonacion'

describe('candado de solo lectura', () => {
  it('deja pasar la lectura', () => {
    expect(permitidoDuranteImpersonacion('GET')).toBe(true)
    expect(permitidoDuranteImpersonacion('head')).toBe(true)
    expect(permitidoDuranteImpersonacion('OPTIONS')).toBe(true)
  })

  it('bloquea TODO lo que escribe', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post', 'Patch']) {
      expect(permitidoDuranteImpersonacion(m)).toBe(false)
    }
  })

  it('un método raro o vacío se bloquea (por defecto, NO se escribe)', () => {
    expect(permitidoDuranteImpersonacion('')).toBe(false)
    expect(permitidoDuranteImpersonacion('TRACE')).toBe(false)
    // @ts-expect-error — entrada basura a propósito
    expect(permitidoDuranteImpersonacion(undefined)).toBe(false)
  })
})

describe('quién puede suplantar a quién', () => {
  const base = {
    adminEmail: 'admin@vence.es',
    esAdmin: true,
    objetivoUserId: '75e32f96-358b-4623-91ea-246a3a890d91',
    objetivoEmail: 'alumna@example.com',
    objetivoEsAdmin: false,
  }

  it('un admin puede ver la cuenta de un usuario normal', () => {
    expect(decidirImpersonacion(base).ok).toBe(true)
  })

  it('quien no es admin, no', () => {
    expect(decidirImpersonacion({ ...base, esAdmin: false }).motivo).toBe('no_admin')
  })

  it('no se suplanta a otro admin (escalada cruzada)', () => {
    expect(decidirImpersonacion({ ...base, objetivoEsAdmin: true }).motivo).toBe('objetivo_es_admin')
  })

  it('ni a uno mismo, aunque sea inofensivo: confunde la auditoría', () => {
    expect(decidirImpersonacion({ ...base, objetivoEmail: 'ADMIN@vence.es' }).motivo).toBe('objetivo_es_uno_mismo')
  })

  it('el userId tiene que ser un UUID de verdad', () => {
    expect(decidirImpersonacion({ ...base, objetivoUserId: '../../etc/passwd' }).motivo).toBe('objetivo_invalido')
    expect(decidirImpersonacion({ ...base, objetivoUserId: null }).motivo).toBe('objetivo_invalido')
  })
})

describe('la sesión suplantada', () => {
  const p = payloadSesionImpersonada({
    objetivoUserId: '75e32f96-358b-4623-91ea-246a3a890d91',
    objetivoEmail: 'alumna@example.com',
    adminEmail: 'admin@vence.es',
    nowSec: 1_800_000_000,
  })

  it('la identidad es la del USUARIO (si no, no veríamos su pantalla)', () => {
    expect(p.appUserId).toBe('75e32f96-358b-4623-91ea-246a3a890d91')
    expect(p.sub).toBe(p.appUserId)
    expect(p.email).toBe('alumna@example.com')
  })

  it('lleva dentro quién está mirando, no en una cookie aparte', () => {
    expect(p.imp).toBe('admin@vence.es')
    expect(esImpersonacion(p)).toBe(true)
    expect(adminQueSuplanta(p)).toBe('admin@vence.es')
  })

  it('caduca sola a los 30 minutos', () => {
    expect(p.exp - p.iat).toBe(TTL_IMPERSONACION_SEG)
    expect(TTL_IMPERSONACION_SEG).toBeLessThanOrEqual(30 * 60)
  })

  it('una sesión normal NO se confunde con una suplantada', () => {
    expect(esImpersonacion({ appUserId: 'x', email: 'a@b.c' })).toBe(false)
    expect(esImpersonacion({ imp: '' })).toBe(false)
    expect(esImpersonacion(null)).toBe(false)
    expect(adminQueSuplanta({ appUserId: 'x' })).toBe(null)
  })
})
