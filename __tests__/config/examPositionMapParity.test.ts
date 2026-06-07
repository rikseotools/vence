// __tests__/config/examPositionMapParity.test.ts
//
// Test de PARIDAD del EXAM_POSITION_MAP entre frontend y backend.
//
// Hay DOS copias del mapa (deuda técnica conocida):
//   - frontend: lib/config/exam-positions.ts
//   - backend:  backend/src/test-config/test-config.helpers.ts (sirve test-config)
//
// Si divergen, la estimación de "preguntas oficiales/imprescindibles" cuenta mal
// (bug real 07/06/2026: Admin. Seguridad Social mostraba 94 oficiales cross-oposición
// en el Tema 2 frente a 1 real, porque la oposición estaba en el mapa del front pero
// NO en el del back). Este test obliga a actualizar las DOS copias a la vez.
//
// Cuando se unifique a una sola fuente, este test puede retirarse.

import fs from 'fs'
import path from 'path'
import { EXAM_POSITION_MAP as FRONTEND_MAP } from '@/lib/config/exam-positions'

/**
 * Extrae el objeto literal EXAM_POSITION_MAP del fichero del backend leyéndolo como
 * texto (no se puede importar: arrastra dependencias de NestJS/Drizzle). El literal usa
 * claves identificador y strings con comillas simples → es JS válido y se puede evaluar.
 */
function extractBackendMap(): Record<string, string[]> {
  const file = path.join(
    process.cwd(),
    'backend/src/test-config/test-config.helpers.ts',
  )
  const src = fs.readFileSync(file, 'utf8')
  const decl = src.indexOf('export const EXAM_POSITION_MAP')
  expect(decl).toBeGreaterThan(-1)
  const braceStart = src.indexOf('{', decl)
  let depth = 0
  let end = -1
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  expect(end).toBeGreaterThan(braceStart)
  const literal = src.slice(braceStart, end + 1)
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`return (${literal})`)() as Record<string, string[]>
}

describe('EXAM_POSITION_MAP — paridad frontend ↔ backend', () => {
  const BACKEND_MAP = extractBackendMap()

  it('ambas copias tienen exactamente las mismas oposiciones (claves)', () => {
    expect(Object.keys(BACKEND_MAP).sort()).toEqual(
      Object.keys(FRONTEND_MAP).sort(),
    )
  })

  it('cada oposición mapea a los mismos exam_position en ambas copias', () => {
    for (const key of Object.keys(FRONTEND_MAP)) {
      expect({ [key]: BACKEND_MAP[key] }).toEqual({ [key]: FRONTEND_MAP[key] })
    }
  })

  it('los mapas son idénticos (deep equal)', () => {
    expect(BACKEND_MAP).toEqual(FRONTEND_MAP)
  })
})
