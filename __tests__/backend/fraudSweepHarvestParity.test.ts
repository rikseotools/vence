// Guardarraíl de SYNC entre el núcleo de detección de COSECHA y su espejo en el backend.
//
// POR QUÉ EXISTE — error real del 27/07/2026, y es el más caro de la sesión:
// hay DOS fraud-sweep. `scripts/fraud-sweep.cjs` es un gemelo CLI, y
// `backend/src/fraud-sweep/` es el que corre DE VERDAD (@Cron 03:15 UTC en
// Fargate). Se reescribió el detector solo en el `.cjs` — o sea, en el fichero que
// nadie ejecuta en producción — creyendo, por lo que decía el runbook, que corría
// desde GitHub Actions. El detector habría quedado inerte sin que nada avisara.
//
// El backend compila con `rootDir: src` y NO puede importar `lib/` de la raíz, así
// que la lógica está replicada. Un espejo desincronizado es PEOR que no tenerlo:
// el mismo usuario se clasificaría distinto según quién mire — el panel admin y el
// CLI por un lado, la alerta nocturna por otro.
//
// Se compara POR COMPORTAMIENTO sobre casos reales, no por el texto del código.

import {
  classifyHarvest as mirror,
  HARVEST_DEFAULTS as mirrorDefaults,
} from '../../backend/src/fraud-sweep/harvest-signals'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classifyHarvest: nucleo, DEFAULTS: nucleoDefaults } = require('@/lib/security/harvestSignals')

type Caso = { nombre: string; input: Record<string, unknown> | null }

// Casos anclados a datos REALES de producción (27/07/2026), no inventados.
const CASOS: Caso[] = [
  { nombre: 'anferbar987: 5.495 servidas / 2 respondidas, sin navegador', input: { served: 5495, answered: 2, pageViews: 0, hasDevice: false } },
  { nombre: 'el mismo perfil pero CON navegador (Playwright/extensión)', input: { served: 5495, answered: 2, pageViews: 2035, hasDevice: true } },
  { nombre: 'usuario más intenso real: 6.200 servidas / 4.897 respondidas', input: { served: 6200, answered: 4897, pageViews: 1500, hasDevice: true } },
  { nombre: 'volumen enorme con ratio sano', input: { served: 50000, answered: 48000, pageViews: 9000, hasDevice: true } },
  { nombre: 'novato: 20 servidas / 0 respondidas (bajo el mínimo)', input: { served: 20, answered: 0, pageViews: 0, hasDevice: false } },
  { nombre: 'justo en el mínimo de volumen', input: { served: 300, answered: 0, pageViews: 0, hasDevice: false } },
  { nombre: 'justo bajo el mínimo de volumen', input: { served: 299, answered: 0, pageViews: 0, hasDevice: false } },
  { nombre: 'frontera exacta del ratio (0,2)', input: { served: 1000, answered: 200, pageViews: 10, hasDevice: true } },
  { nombre: 'justo por debajo de la frontera del ratio', input: { served: 1000, answered: 199, pageViews: 10, hasDevice: true } },
  { nombre: 'agravante por volumen: ratio malo y servidas enormes', input: { served: 9000, answered: 0, pageViews: 50, hasDevice: true } },
  { nombre: 'ratio malo con volumen moderado', input: { served: 1000, answered: 0, pageViews: 50, hasDevice: true } },
  { nombre: 'sin saber pageViews ni hasDevice', input: { served: 1000, answered: 0 } },
  { nombre: 'abandona la mitad de los tests', input: { served: 1000, answered: 500, pageViews: 200, hasDevice: true } },
  // Basura: corre en un cron nocturno, no puede petar por un dato sucio.
  { nombre: 'entrada nula', input: null },
  { nombre: 'entrada vacía', input: {} },
  { nombre: 'números imposibles', input: { served: NaN, answered: -5, pageViews: Infinity, hasDevice: false } },
  { nombre: 'tipos equivocados', input: { served: 'muchas', answered: 'pocas' } },
]

describe('paridad núcleo ↔ espejo del backend (detección de cosecha)', () => {
  it.each(CASOS)('mismo veredicto en: $nombre', ({ input }) => {
    const a = nucleo(input as never)
    const b = mirror(input as never)
    // Normaliza null vs objeto y compara el veredicto COMPLETO (kind, severidad,
    // ratio y motivos): que coincida el kind pero no la severidad sería una
    // divergencia igual de dañina — la alerta escalaría distinto según el gemelo.
    expect(b).toEqual(a)
  })

  it('los umbrales por defecto coinciden', () => {
    expect(mirrorDefaults.minServed).toBe(nucleoDefaults.minServed)
    expect(mirrorDefaults.maxAnswerRatio).toBe(nucleoDefaults.maxAnswerRatio)
    expect(mirrorDefaults.egregiousServed).toBe(nucleoDefaults.egregiousServed)
  })

  it('un umbral pasado por opts se respeta igual en ambos', () => {
    const caso = { served: 400, answered: 0, pageViews: 0, hasDevice: false }
    expect(mirror(caso, { minServed: 1000 })).toEqual(nucleo(caso, { minServed: 1000 }))
    expect(mirror(caso, { minServed: 1000 })).toBeNull()
  })

  // Si alguien reintroduce `harvest_volume` en un lado, esto lo caza: el usuario
  // real más intenso quedaba a un 2 % de aquel umbral.
  it('NINGUNO de los dos marca por volumen con ratio sano', () => {
    const intenso = { served: 6200, answered: 4897, pageViews: 1500, hasDevice: true }
    expect(nucleo(intenso)).toBeNull()
    expect(mirror(intenso)).toBeNull()
  })
})
