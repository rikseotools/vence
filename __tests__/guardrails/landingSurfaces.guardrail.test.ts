// __tests__/guardrails/landingSurfaces.guardrail.test.ts
//
// Guardarraíl ANTI-HUECO de la landing (T-134). Corre en CI, sin BD y sin red.
//
// El problema que ataca: los detectores de contenido se añadieron de uno en uno, cada uno tras su
// incidente, y nadie tenía la vista de conjunto — así que un hueco solo se descubría cuando un
// usuario se caía por él (26/07: el botón "Ver convocatoria en BOE" llevaba al portal de aspirantes
// en INGLÉS con el plazo abierto, y los tres detectores de enlaces daban verde).
//
// `lib/admin/landingSurfaces.ts` enumera lo que el opositor VE; este test exige que cada cosa
// tenga detector o hueco declarado, en las dos direcciones.

import fs from 'fs'
import path from 'path'
import {
  LANDING_SURFACES,
  PREFIJOS_KIND_LANDING,
  kindsCubiertos,
  superficiesConHueco,
} from '../../lib/admin/landingSurfaces'
import { RUNBOOK_BY_KIND } from '../../lib/admin/runbookRegistry'

const REPO = path.resolve(__dirname, '../..')
const PAGE = fs.readFileSync(path.join(REPO, 'app/[oposicion]/page.tsx'), 'utf8')
const BACKLOG = fs.readFileSync(path.join(REPO, 'docs/roadmap/tareas-pendientes.md'), 'utf8')

describe('landingSurfaces — el inventario describe la landing REAL', () => {
  it('cada superficie nombra marcadores que existen en la página', () => {
    // Sin esto el inventario se vuelve ficción en cuanto alguien renombra o quita una sección,
    // y un inventario que miente es peor que no tenerlo: da por vigilado lo que ya no existe.
    const fantasmas: string[] = []
    for (const [id, s] of Object.entries(LANDING_SURFACES)) {
      for (const m of s.marcadores) if (!PAGE.includes(m)) fantasmas.push(`${id} → "${m}"`)
    }
    expect(fantasmas).toEqual([])
  })

  it('ninguna superficie se queda sin marcadores (entrada vacía = entrada inútil)', () => {
    const vacias = Object.entries(LANDING_SURFACES)
      .filter(([, s]) => s.marcadores.length === 0)
      .map(([id]) => id)
    expect(vacias).toEqual([])
  })
})

describe('landingSurfaces — cobertura: nada sin vigilar en silencio', () => {
  it('cada kind citado existe de verdad en el registro de runbooks', () => {
    const inventados = kindsCubiertos().filter((k) => !RUNBOOK_BY_KIND[k])
    expect(inventados).toEqual([])
  })

  it('una superficie SIN detectores declara su hueco (el silencio no vale)', () => {
    const mudas = Object.entries(LANDING_SURFACES)
      .filter(([, s]) => s.kinds.length === 0 && !s.hueco)
      .map(([id]) => id)
    expect(mudas).toEqual([])
  })

  it('todo hueco declarado se explica y, si tiene tarea, la tarea EXISTE en el backlog', () => {
    const problemas: string[] = []
    for (const { id, hueco, tarea } of superficiesConHueco()) {
      if (hueco.trim().length < 30) problemas.push(`${id}: el motivo del hueco es demasiado vago`)
      if (tarea && !/^T-\d{3}$/.test(tarea)) problemas.push(`${id}: "${tarea}" no tiene formato T-NNN`)
      // Anti-silo: un hueco que apunta a una tarea inexistente es un hueco que nadie va a cerrar.
      if (tarea && !BACKLOG.includes(`[${tarea}]`)) problemas.push(`${id}: ${tarea} no está en el backlog`)
    }
    expect(problemas).toEqual([])
  })

  it('A LA INVERSA: todo detector de landing está asignado a una superficie', () => {
    // Un detector nuevo obliga a decir QUÉ vigila. Si no, vuelve a pasar lo de siempre: tres
    // detectores de enlaces y ninguno cubriendo el caso que se llevó al usuario por delante.
    const deLanding = Object.keys(RUNBOOK_BY_KIND).filter((k) =>
      PREFIJOS_KIND_LANDING.some((p) => k.startsWith(p)),
    )
    const cubiertos = new Set(kindsCubiertos())
    const huerfanos = deLanding.filter((k) => !cubiertos.has(k)).sort()
    expect(huerfanos).toEqual([])
  })

  it('el botón oficial está cubierto por los TRES detectores de enlace (regresión de T-134)', () => {
    // Fijado a propósito: los tres se necesitan y cada uno tapa el punto ciego del anterior.
    expect(LANDING_SURFACES.enlace_oficial.kinds.sort()).toEqual([
      'convocatoria_enlace_no_boletin',
      'convocatoria_etiqueta_boletin',
      'convocatoria_link_mismatch',
    ])
  })
})
