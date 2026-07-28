// __tests__/guardrails/ciGateParidad.test.ts
//
// PARIDAD del veredicto de CI entre el núcleo puro y los scripts de deploy.
//
// El criterio de "¿puede desplegarse este commit?" existe en DOS sitios y no por capricho:
//   · `lib/deploy/ciGate.js` — puro y testeado, lo usa `scripts/deploy-cuando-verde.sh`.
//   · `scripts/deploy-{backend,frontend}.sh` — en bash+jq, porque el gate corre ANTES de que exista
//     nada de Node en el flujo y no se reescriben a la ligera: acababan de arreglarse el 27/07.
//
// Duplicar lógica es aceptable solo si algo impide que se bifurque. Esto es ese algo. No compara
// ejecuciones (una es jq y otra JS), compara las DECISIONES que ambas deben respetar — las mismas
// que costaron deploys reales:
//   1. `cancelled` se trata APARTE de `failure` (mezclarlos bloqueó tres deploys el 27/07).
//   2. `integration` NO gatea.
//   3. El orden de precedencia: faltan → rojo → cancelado → curso.
//
// Si alguien "simplifica" el bash y vuelve a meter cancelled en el saco de failure, esto se pone
// rojo y explica por qué.

import { readFileSync } from 'fs'
import { join } from 'path'

/* eslint-disable @typescript-eslint/no-var-requires */
const { clasificarCiCodigo, CHECKS_DE_CODIGO, CONCLUSIONES_ROJAS } = require('../../lib/deploy/ciGate')

const ROOT = join(__dirname, '..', '..')
const SCRIPTS = ['scripts/deploy-backend.sh', 'scripts/deploy-frontend.sh']
const fuentes = SCRIPTS.map((f) => ({ f, src: readFileSync(join(ROOT, f), 'utf8') }))

describe('paridad del gate de CI — núcleo puro ↔ scripts de deploy', () => {
  it('la extracción funciona (los scripts existen y traen el gate)', () => {
    for (const { f, src } of fuentes) {
      expect(src.length).toBeGreaterThan(500)
      expect(src).toContain('gate CI')
      expect(f).toMatch(/deploy-(backend|frontend)\.sh/)
    }
  })

  it('ambos scripts gatean con los MISMOS checks de código que el núcleo', () => {
    for (const { f, src } of fuentes) {
      for (const k of CHECKS_DE_CODIGO) {
        expect(`${f}:${k}`).toBe(src.includes(`"${k}"`) ? `${f}:${k}` : `${f}: FALTA el check ${k}`)
      }
    }
  })

  it('cancelled se evalúa APARTE de failure (la lección del 27/07)', () => {
    for (const { f, src } of fuentes) {
      // La variable de cancelados existe y NO se calcula junto a las conclusiones rojas.
      expect(`${f} declara CANCELLED`).toBe(/CANCELLED=/.test(src) ? `${f} declara CANCELLED` : `${f} NO declara CANCELLED`)
      const lineaFailed = src.split('\n').find((l) => /^\s*FAILED=/.test(l)) || ''
      expect(`${f}: FAILED sin cancelled`).toBe(
        lineaFailed.includes('cancelled') ? `${f}: FAILED MEZCLA cancelled` : `${f}: FAILED sin cancelled`,
      )
      // …y solo cuenta como rojo lo que el núcleo considera rojo.
      for (const c of CONCLUSIONES_ROJAS) expect(lineaFailed).toContain(c)
    }
  })

  it('`integration` está declarado como informativo, no como bloqueante', () => {
    for (const { f, src } of fuentes) {
      expect(`${f} menciona integration`).toBe(
        /integration/i.test(src) ? `${f} menciona integration` : `${f} NO menciona integration`,
      )
      // Aparece en el mensaje final (informativo), no en una condición de abort.
      expect(src).toMatch(/informativo|no bloquea|señal aparte/i)
    }
  })

  it('el ORDEN de precedencia del bash es el mismo que el del núcleo', () => {
    // El núcleo: faltan → rojo → cancelado → curso. Si el bash los reordenara, un commit con un
    // check cancelado Y otro en curso recibiría un diagnóstico distinto según quién lo mire.
    for (const { f, src } of fuentes) {
      const iFaltan = src.indexOf('MISSING:-0')
      const iRojo = src.indexOf('FAILED:-0')
      const iCanc = src.indexOf('CANCELLED:-0')
      const iCurso = src.indexOf('PENDING:-0')
      expect(`${f}: todos presentes`).toBe(
        [iFaltan, iRojo, iCanc, iCurso].every((i) => i > 0) ? `${f}: todos presentes` : `${f}: falta alguna rama`,
      )
      expect(iFaltan).toBeLessThan(iRojo)
      expect(iRojo).toBeLessThan(iCanc)
      expect(iCanc).toBeLessThan(iCurso)
    }
  })

  it('el núcleo aplica esa misma precedencia (no solo la documenta)', () => {
    const run = (name: string, status: string, conclusion: string | null) => ({ name, status, conclusion })
    // rojo gana a cancelado
    expect(
      clasificarCiCodigo([
        run('Unit tests', 'completed', 'cancelled'),
        run('Typecheck', 'completed', 'failure'),
        run('Lint', 'completed', 'success'),
      ]).estado,
    ).toBe('rojo')
    // cancelado gana a en-curso
    expect(
      clasificarCiCodigo([
        run('Unit tests', 'completed', 'cancelled'),
        run('Typecheck', 'in_progress', null),
        run('Lint', 'completed', 'success'),
      ]).estado,
    ).toBe('cancelado')
  })

  it('el lanzador usa el NÚCLEO y no reimplementa el criterio', () => {
    const src = readFileSync(join(ROOT, 'scripts/deploy-cuando-verde.sh'), 'utf8')
    expect(src).toContain('lib/deploy/ciGate.js')
    expect(src).toContain('clasificarCiCodigo')
    // Si algún día alguien copia el jq aquí, esto lo caza.
    expect(src).not.toMatch(/conclusion=="failure"/)
  })
})
