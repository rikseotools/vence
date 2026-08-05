// Guardarraíl de SINCRONÍA entre la decisión "acotar al temario o degradar" y su espejo
// en el backend.
//
// ── POR QUÉ EXISTE — tres repeticiones de la misma lección ────────────────────────────────
//
// 1. [T-326] la lógica del contador «por leyes» vivía SOLO en el frontend… y la familia
//    `test-config` está enrutada al backend, así que producción ejecutaba otro código.
// 2. [T-551, 04/08/2026] la guarda de degradación estaba en el camino del TEST y no en el
//    del CONTADOR: Félix Peña (premium) veía 0 preguntas donde su selección tenía 1.283.
// 3. El arreglo de (2) se aplicó otra vez SOLO al gemelo del frontend. Medido contra
//    www.vence.es el 05/08 con su combinación real, y con `x-served-by: vence-backend`:
//
//        scopeToPosition=false → count 1283
//        scopeToPosition=true  → count 0     ← seguía roto en producción
//
// El backend compila con `rootDir: src` y NO puede importar `lib/` de la raíz, así que la
// decisión está replicada. Un espejo desincronizado es PEOR que no tenerlo: el mismo usuario
// vería un número distinto según quién le respondiera.
//
// Se compara POR COMPORTAMIENTO, no por el texto del código, y sobre el espacio ENTERO de
// entradas: son tres booleanos, o sea 8 casos — aquí la exhaustividad es gratis, así que no
// hay excusa para muestrear.

import {
  decidirAlcanceDeLey as espejo,
  esDegradacion as espejoDegrada,
} from '../../backend/src/test-config/alcance-de-ley'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  decidirAlcanceDeLey: nucleo,
  esDegradacion: nucleoDegrada,
} = require('@/lib/api/_shared/topicScopeSql')

const BOOLS = [false, true]

/** Las 8 combinaciones posibles, generadas — no listadas a mano (una lista se queda corta). */
const CASOS = BOOLS.flatMap(acotarAlTemario =>
  BOOLS.flatMap(tieneScopeDeLaLey =>
    BOOLS.map(haySeleccionManual => ({
      acotarAlTemario,
      tieneScopeDeLaLey,
      haySeleccionManual,
    })),
  ),
)

const etiqueta = (c: (typeof CASOS)[number]) =>
  `acotar=${c.acotarAlTemario} scope=${c.tieneScopeDeLaLey} seleccion=${c.haySeleccionManual}`

describe('paridad frontend ↔ backend: alcance de ley', () => {
  it('cubre el espacio ENTERO de entradas', () => {
    expect(CASOS).toHaveLength(8)
  })

  it.each(CASOS.map(c => [etiqueta(c), c] as const))(
    'decidirAlcanceDeLey coincide — %s',
    (_nombre, caso) => {
      expect(espejo(caso)).toBe(nucleo(caso))
    },
  )

  it.each(CASOS.map(c => [etiqueta(c), c] as const))(
    'esDegradacion coincide — %s',
    (_nombre, caso) => {
      expect(espejoDegrada(caso)).toBe(nucleoDegrada(caso))
    },
  )

  // Los dos casos que SON el defecto de Félix. Si alguien "simplifica" la regla, estos
  // dos son los que tienen que cantar: dicen qué pasa cuando la oposición no tiene temario.
  it('sin temario y CON selección del usuario → se respeta su selección, no 0', () => {
    const caso = {
      acotarAlTemario: true,
      tieneScopeDeLaLey: false,
      haySeleccionManual: true,
    }
    expect(nucleo(caso)).toBe('seleccion_del_usuario')
    expect(espejo(caso)).toBe('seleccion_del_usuario')
    expect(nucleoDegrada(caso)).toBe(true)
    expect(espejoDegrada(caso)).toBe(true)
  })

  it('sin temario y SIN selección → la ley entera, nunca un cero silencioso', () => {
    const caso = {
      acotarAlTemario: true,
      tieneScopeDeLaLey: false,
      haySeleccionManual: false,
    }
    expect(nucleo(caso)).toBe('ley_entera')
    expect(espejo(caso)).toBe('ley_entera')
  })

  it('CON temario sí se acota — la degradación no puede tragarse el caso normal', () => {
    const caso = {
      acotarAlTemario: true,
      tieneScopeDeLaLey: true,
      haySeleccionManual: true,
    }
    expect(nucleo(caso)).toBe('interseccion_con_temario')
    expect(espejo(caso)).toBe('interseccion_con_temario')
    expect(nucleoDegrada(caso)).toBe(false)
    expect(espejoDegrada(caso)).toBe(false)
  })
})
