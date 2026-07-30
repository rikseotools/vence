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
  impersonacionCaducada,
  restanteImpersonacionSeg,
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

  it('caduca sola a los 30 minutos, y el plazo va en un claim NUESTRO', () => {
    expect(TTL_IMPERSONACION_SEG).toBeLessThanOrEqual(30 * 60)
    expect(p.impExp - p.iat).toBe(TTL_IMPERSONACION_SEG)
    // `exp` se sigue emitiendo por higiene, pero NO es el reloj: Auth.js lo reescribe en
    // cada rotación. Quien mande aquí tiene que ser `impExp`
    // (ver __tests__/integration/impersonacionRotacionTtl.test.ts).
    expect(p.exp - p.iat).toBe(TTL_IMPERSONACION_SEG)
  })

  it('una sesión normal NO se confunde con una suplantada', () => {
    expect(esImpersonacion({ appUserId: 'x', email: 'a@b.c' })).toBe(false)
    expect(esImpersonacion({ imp: '' })).toBe(false)
    expect(esImpersonacion(null)).toBe(false)
    expect(adminQueSuplanta({ appUserId: 'x' })).toBe(null)
  })
})

describe('el reloj de la suplantación', () => {
  const nacimiento = 1_800_000_000
  const viva = payloadSesionImpersonada({
    objetivoUserId: '75e32f96-358b-4623-91ea-246a3a890d91',
    objetivoEmail: 'alumna@example.com',
    adminEmail: 'admin@vence.es',
    nowSec: nacimiento,
  })

  it('está viva hasta el último segundo del plazo, y muerta a partir de él', () => {
    expect(impersonacionCaducada(viva, nacimiento)).toBe(false)
    expect(impersonacionCaducada(viva, nacimiento + TTL_IMPERSONACION_SEG - 1)).toBe(false)
    expect(impersonacionCaducada(viva, nacimiento + TTL_IMPERSONACION_SEG)).toBe(true)
  })

  it('las sesiones NORMALES no caducan por esta vía (no desconectamos a nadie por error)', () => {
    expect(impersonacionCaducada({ appUserId: 'x', email: 'a@b.c' }, nacimiento)).toBe(false)
    expect(impersonacionCaducada(null, nacimiento)).toBe(false)
    expect(impersonacionCaducada(undefined, nacimiento)).toBe(false)
    expect(restanteImpersonacionSeg({ appUserId: 'x' }, nacimiento)).toBe(null)
  })

  it('marca SIN reloj = caducada (fail-closed): así mueren solas las sesiones ya emitidas', () => {
    expect(impersonacionCaducada({ imp: 'admin@vence.es' }, nacimiento)).toBe(true)
    expect(restanteImpersonacionSeg({ imp: 'admin@vence.es' }, nacimiento)).toBe(0)
  })

  it('un reloj basura no vale como reloj', () => {
    for (const basura of ['9999999999', null, NaN, Infinity, {}, true]) {
      expect(impersonacionCaducada({ imp: 'admin@vence.es', impExp: basura }, nacimiento)).toBe(true)
    }
  })

  it('el restante sirve para recortar lo que derive de la sesión, y nunca es negativo', () => {
    expect(restanteImpersonacionSeg(viva, nacimiento)).toBe(TTL_IMPERSONACION_SEG)
    expect(restanteImpersonacionSeg(viva, nacimiento + 60)).toBe(TTL_IMPERSONACION_SEG - 60)
    expect(restanteImpersonacionSeg(viva, nacimiento + 10 * TTL_IMPERSONACION_SEG)).toBe(0)
  })
})
