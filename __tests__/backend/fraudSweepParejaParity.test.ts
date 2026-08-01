// Guardarraíl de SYNC entre el núcleo de «pareja farmeando» y su espejo en el backend. (T-372)
//
// POR QUÉ EXISTE: hay DOS fraud-sweep. `scripts/fraud-sweep.cjs` es un gemelo CLI y
// `backend/src/fraud-sweep/` es el que corre DE VERDAD (@Cron 03:15 UTC en Fargate). El 27/07 se
// reescribió un detector solo en el `.cjs` —el fichero que nadie ejecuta en producción— y habría
// quedado inerte sin que nada avisara. El backend compila con `rootDir: src` y no puede importar
// `lib/`, así que la lógica está replicada; este test impide que las dos copias divergan.
//
// Se compara POR COMPORTAMIENTO sobre los equipos REALES de producción medidos el 01/08, no por
// el texto del código.
import {
  clasificarEquipo as espejo,
  clasificarDia as espejoDia,
  gravedad as espejoGravedad,
  MIN_DIAS as espejoMinDias,
  MIN_PROPORCION as espejoMinProp,
  TOPE_FREE as espejoTope,
} from '../../backend/src/fraud-sweep/pareja-farmeo'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nucleo = require('@/lib/security/parejaFarmeo')

/** Construye los días de un equipo: `[[25,25], [25,3], …]` = un par por día. */
const equipo = (dias: number[][]) =>
  dias.map((cuentas, i) => ({
    fecha: `2026-07-${String(i + 1).padStart(2, '0')}`,
    cuentas: cuentas.map((q, j) => ({ userId: `u${j}`, preguntas: q })),
  }))

const rep = (n: number, dia: number[]) => Array.from({ length: n }, () => dia)

// Anclados a lo medido en producción el 01/08 sobre los equipos de 2-3 cuentas.
const CASOS: { nombre: string; dias: number[][] }[] = [
  { nombre: '23d64ed0: 18 de 20 clavados (90%) — rutina', dias: [...rep(18, [25, 25]), ...rep(2, [25, 4])] },
  { nombre: '2bbb2177 CONFIRMADO A MANO: 18 de 24 (75%)', dias: [...rep(18, [25, 25]), ...rep(6, [25, 2])] },
  { nombre: 'd60ca3e4 CONFIRMADO A MANO: 9 de 12 (75%)', dias: [...rep(9, [25, 25]), ...rep(3, [12, 0])] },
  { nombre: '002999b0 CONFIRMADO A MANO: 3 de 5 (60%) — el mínimo que sí es', dias: [...rep(3, [25, 25]), ...rep(2, [8, 1])] },
  { nombre: '4839e75e: 3 de 8 (38%) — zona de duda, NO abre señal', dias: [...rep(3, [25, 25]), ...rep(5, [10, 2])] },
  { nombre: 'ca8c880e: 1 de 16 — familia con un día intenso', dias: [...rep(1, [25, 25]), ...rep(15, [14, 6])] },
  { nombre: 'familia que REPARTE: nunca las dos al tope', dias: rep(20, [25, 6]) },
  { nombre: 'una sola cuenta apurando el free: no es equipo', dias: rep(20, [25]) },
  { nombre: 'el 24 cuenta como clavada (agotar no siempre cae exacto)', dias: rep(5, [24, 25]) },
  { nombre: 'el 23 NO cuenta', dias: rep(5, [23, 25]) },
  { nombre: 'trío clavado: tres cuentas al tope', dias: rep(4, [25, 25, 25]) },
  { nombre: 'trío donde una no llega: no es todas', dias: rep(4, [25, 25, 9]) },
  { nombre: 'justo en el mínimo de días', dias: rep(3, [25, 25]) },
  { nombre: 'justo por debajo del mínimo de días', dias: rep(2, [25, 25]) },
  { nombre: 'equipo sin actividad', dias: [] },
  { nombre: 'día con ceros: no cuenta como activo', dias: [...rep(3, [25, 25]), ...rep(4, [0, 0])] },
]

describe('el espejo del backend y el núcleo clasifican IGUAL', () => {
  it.each(CASOS)('$nombre', ({ dias }) => {
    const d = equipo(dias)
    expect(espejo(d)).toEqual(nucleo.clasificarEquipo(d))
  })

  it('…y también día a día', () => {
    for (const { dias } of CASOS) {
      for (const d of equipo(dias)) {
        expect(espejoDia(d.cuentas)).toEqual(nucleo.clasificarDia(d.cuentas))
      }
    }
  })

  it('…y la gravedad', () => {
    for (const { dias } of CASOS) {
      const v = nucleo.clasificarEquipo(equipo(dias))
      expect(espejoGravedad(v)).toBe(nucleo.gravedad(v))
    }
  })

  it('los umbrales son los mismos números en los dos sitios', () => {
    // Si alguien recalibra uno y no el otro, el mismo equipo abre señal de noche y no de día.
    expect(espejoMinDias).toBe(nucleo.MIN_DIAS)
    expect(espejoMinProp).toBe(nucleo.MIN_PROPORCION)
    expect(espejoTope).toBe(nucleo.TOPE_FREE)
  })
})
