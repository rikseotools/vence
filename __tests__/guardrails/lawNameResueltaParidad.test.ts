// __tests__/guardrails/lawNameResueltaParidad.test.ts
//
// GUARDARRAÍL: el criterio de `law_name` es UNO, en dos escritores.
//
// POR QUÉ (T-559, 05/08/2026). En junio/2026 se arregló el escritor de respuestas para que
// resolviera la ley desde `article_id` en vez de guardar el literal `'unknown'`. El arreglo
// se aplicó al gemelo de Next (`lib/api/test-answers/queries.ts`) y **NO** al del backend
// (`backend/src/test-answers/test-answers.service.ts`), que siguió escribiendo:
//
//     lawName: req.questionData.article?.law_short_name || 'unknown'
//
// Nada lo cazó: no hay tipos compartidos entre los dos proyectos, los tests del backend
// probaban su propia copia, y el defecto no emitía ningún evento. Resultado: 15.109 filas
// con una ley inventada, 253 usuarios, y una notificación publicando «Artículos
// Problemáticos: unknown» cuyo botón de teoría daba 404. Lo reportó una usuaria.
//
// Este test falla si:
//   · el núcleo del backend deja de comportarse como el de Next (se comparan COMPORTAMIENTOS,
//     no el texto del fichero: un port con otro estilo pero misma semántica es válido),
//   · la lista de rellenos diverge,
//   · algún escritor vuelve a persistir un literal de relleno.
//
// VALIDADO POR MUTACIÓN: ver `__tests__/guardrails/lawNameResueltaParidad.mutacion.test.ts`.
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  decidirLawNamePersistida as decidirNext,
  esLeyResuelta as esLeyResueltaNext,
  RELLENOS_DE_LEY as RELLENOS_NEXT,
  EVENTO_LAW_NAME_SIN_RESOLVER as EVENTO_NEXT,
  type EntradaLawName,
} from '@/lib/laws/lawNameResuelta'
import {
  decidirLawNamePersistida as decidirBackend,
  esLeyResuelta as esLeyResueltaBackend,
  RELLENOS_DE_LEY as RELLENOS_BACKEND,
  EVENTO_LAW_NAME_SIN_RESOLVER as EVENTO_BACKEND,
} from '../../backend/src/test-answers/law-name-resuelta'

const raiz = process.cwd()
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8')

/** Todas las combinaciones de entrada que puede recibir el núcleo. */
function todasLasEntradas(): EntradaLawName[] {
  const valores = [
    null,
    undefined,
    '',
    '   ',
    'CE',
    'Ley 39/2015',
    'Excel 365',
    ' Word 365 ',
    'unknown',
    'UNKNOWN',
    '  unknown  ',
    'undefined',
    'null',
    'nan',
  ]
  const out: EntradaLawName[] = []
  for (const delCliente of valores) {
    for (const resueltaDesdeArticulo of valores) {
      for (const tieneArticulo of [true, false]) {
        for (const esPsicotecnica of [true, false]) {
          out.push({ delCliente, resueltaDesdeArticulo, tieneArticulo, esPsicotecnica })
        }
      }
    }
  }
  return out
}

describe('paridad del criterio de law_name entre los dos escritores', () => {
  it('la lista de rellenos es idéntica (orden incluido: es una lista curada)', () => {
    expect([...RELLENOS_BACKEND]).toEqual([...RELLENOS_NEXT])
  })

  it('el nombre del evento es el mismo (dos emisores del mismo hecho, una sola señal)', () => {
    expect(EVENTO_BACKEND).toBe(EVENTO_NEXT)
  })

  it('esLeyResuelta da el MISMO veredicto en los dos, para toda entrada', () => {
    const valores = [null, undefined, '', ' ', 'CE', 'unknown', 'UNKNOWN', 'undefined', 'null', 'nan', 'Ley de lo unknown']
    for (const v of valores) {
      expect(esLeyResueltaBackend(v)).toBe(esLeyResueltaNext(v))
    }
  })

  it('decidirLawNamePersistida da la MISMA decisión en los dos, para las 784 combinaciones', () => {
    const entradas = todasLasEntradas()
    expect(entradas.length).toBeGreaterThan(500) // que el barrido no se vacíe por accidente
    for (const entrada of entradas) {
      expect({ entrada, d: decidirBackend(entrada) }).toEqual({
        entrada,
        d: decidirNext(entrada),
      })
    }
  })
})

describe('ningún escritor vuelve a persistir el relleno', () => {
  // Lectura de código: caza que alguien reintroduzca el `|| 'unknown'` sin pasar por el
  // núcleo, que es exactamente como nació el defecto. Se mira la forma EJECUTABLE
  // (asignación al campo que se persiste), no la mención en prosa.
  const escritores = [
    'lib/api/test-answers/queries.ts',
    'backend/src/test-answers/test-answers.service.ts',
  ]

  it.each(escritores)('%s no asigna un relleno a lawName', (rel) => {
    const src = leer(rel)
    // `lawName: <lo que sea> || 'unknown'` / `?? 'unknown'` en la construcción del row.
    const asignacionConRelleno = /lawName:\s*[^,\n]*(\|\||\?\?)\s*['"](unknown|undefined|null)['"]/
    expect(src).not.toMatch(asignacionConRelleno)
  })

  it.each(escritores)('%s decide la ley con el núcleo compartido', (rel) => {
    const src = leer(rel)
    expect(src).toContain('decidirLawNamePersistida')
  })
})
