/**
 * @jest-environment node
 *
 * La marca que sobrevive al borrado de la cuenta (T-304).
 *
 * Manuel: «hay que dejar trackeadas esas cuentas y marcadas … para que no pida eliminar y volverla
 * a crear». Hoy `fraud_watch_list.user_id` y `user_devices.user_id` van con ON DELETE CASCADE:
 * pedir la baja borra el historial y se empieza limpio. Por eso la marca se ancla al DISPOSITIVO
 * (huella v2) y al HASH del correo, no a la cuenta.
 *
 * Aquí se prueba la parte pura: el hash. Que la fila sobreviva al DELETE está verificado contra la
 * base de datos real (sonda creada y borrada), porque eso depende del esquema, no del código.
 */
import { hashEmail, RETENCION_AÑOS } from '@/lib/api/fraud/marcaPersistente'

describe('hashEmail — reconocer al que vuelve sin guardar su correo', () => {
  it('es estable: el mismo correo da siempre el mismo hash', () => {
    expect(hashEmail('juan@gmail.com')).toBe(hashEmail('juan@gmail.com'))
  })

  it('NO guarda el correo: el resultado no lo contiene', () => {
    const h = hashEmail('juan@gmail.com')
    expect(h).not.toContain('juan')
    expect(h).not.toContain('@')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('normaliza mayúsculas y espacios — si no, cambiar una letra estrena expediente', () => {
    const ref = hashEmail('juan@gmail.com')
    for (const variante of ['JUAN@GMAIL.COM', ' juan@gmail.com ', 'Juan@Gmail.com', '\tjuan@gmail.com\n']) {
      expect(hashEmail(variante)).toBe(ref)
    }
  })

  it('correos distintos dan hashes distintos (incluido el truco del punto)', () => {
    expect(hashEmail('juan@gmail.com')).not.toBe(hashEmail('juan2@gmail.com'))
    // Gmail ignora los puntos, pero para nosotros son correos distintos: no se asume nada
    // del proveedor. Queda anotado por si algún día se quiere normalizar también eso.
    expect(hashEmail('ju.an@gmail.com')).not.toBe(hashEmail('juan@gmail.com'))
  })

  it('la retención es acotada, no "para siempre" (RGPD art. 17.3)', () => {
    expect(RETENCION_AÑOS).toBeGreaterThan(0)
    expect(RETENCION_AÑOS).toBeLessThanOrEqual(5)
  })
})
