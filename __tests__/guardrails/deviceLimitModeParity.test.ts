/**
 * @jest-environment node
 *
 * El modo del límite por dispositivo, y su ESPEJO en el backend.
 *
 * Hay dos copias del mismo interruptor porque el backend compila con `rootDir: src` y no puede
 * importar de la raíz. Y `answer-and-save` **reparte tráfico entre los dos caminos** (hace proxy
 * al backend cuando el flag está activo, y cae al local si falla), así que una discrepancia
 * significa que el mismo usuario se bloquea o no según por dónde entre su petición — un fallo
 * imposible de reproducir y muy fácil de no ver.
 *
 * Se compara POR COMPORTAMIENTO sobre las mismas entradas, no por el texto del código.
 */
import {
  resolveDeviceLimitMode as raiz,
  shouldBlock as bloqueaRaiz,
  shouldEvaluate as evaluaRaiz,
  cuentaElCupoDelDispositivo as cuentaRaiz,
  DEVICE_LIMIT_MODE_DEFAULT as defRaiz,
} from '@/lib/security/deviceLimitMode'
import {
  resolveDeviceLimitMode as espejo,
  shouldBlock as bloqueaEspejo,
  shouldEvaluate as evaluaEspejo,
  cuentaElCupoDelDispositivo as cuentaEspejo,
  DEVICE_LIMIT_MODE_DEFAULT as defEspejo,
} from '../../backend/src/daily-limit/device-limit-mode'

const ENTRADAS = [
  'enforce', 'shadow', 'off', 'on', 'true', 'false', '1', '0',
  'ENFORCE', ' Shadow ', 'OFF',
  '', ' ', 'enforcé', 'enfoce', 'sombra', 'yes', 'null',
  undefined, null,
]

describe('paridad raíz ↔ espejo del backend (modo del límite por dispositivo)', () => {
  it.each(ENTRADAS)('mismo modo para %p', (v) => {
    expect(espejo(v as string)).toBe(raiz(v as string))
  })

  it('mismas decisiones derivadas', () => {
    for (const v of ENTRADAS) {
      const m = raiz(v as string)
      expect(bloqueaEspejo(m)).toBe(bloqueaRaiz(m))
      expect(evaluaEspejo(m)).toBe(evaluaRaiz(m))
      for (const confirmado of [true, false]) {
        expect(cuentaEspejo(m, confirmado)).toBe(cuentaRaiz(m, confirmado))
      }
    }
  })

  it('el defecto es SHADOW en los dos: desplegar sin decidir mide, no corta', () => {
    expect(defRaiz).toBe('shadow')
    expect(defEspejo).toBe('shadow')
    expect(raiz(undefined)).toBe('shadow')
    expect(espejo(undefined)).toBe('shadow')
  })
})

describe('el modo decide, y ante la duda NO corta', () => {
  it('solo `enforce` bloquea', () => {
    expect(bloqueaRaiz(raiz('enforce'))).toBe(true)
    expect(bloqueaRaiz(raiz('shadow'))).toBe(false)
    expect(bloqueaRaiz(raiz('off'))).toBe(false)
  })

  it('en sombra SÍ se evalúa (si no, no habría datos que analizar)', () => {
    expect(evaluaRaiz(raiz('shadow'))).toBe(true)
  })

  it('en off no se evalúa: rollback total sin desplegar', () => {
    expect(evaluaRaiz(raiz('off'))).toBe(false)
  })

  it('un valor con typo NO se lee como enforce (un error de config no corta el servicio)', () => {
    for (const typo of ['enfoce', 'enforcé', 'ENFORC', 'sombra', 'sí', 'activar']) {
      expect(bloqueaRaiz(raiz(typo))).toBe(false)
      expect(bloqueaEspejo(espejo(typo))).toBe(false)
    }
  })
})
