/**
 * @jest-environment node
 */
// Ninguna página cacheada puede hornear su pantalla de error (T-506, 03/08/2026).
//
// Nace de un fallo real: `/administrativo-estado/test` sirvió «Error cargando temas» durante ~17 h
// con los 45 temas intactos en la base de datos, porque el componente atrapaba el error de la
// consulta y devolvía un aviso… en una página con `revalidate = false`. Lo descubrió un usuario
// premium (feedback `ddaa31dd`), no nosotros.
//
// Los dos ingredientes son inocentes por separado —cachear está bien, capturar está bien— y el
// daño solo aparece al juntarlos. Por eso lo comprueba el CI: nadie lo va a recordar al escribir
// el siguiente componente.

import fs from 'fs'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analizarFuente } = require('@/lib/calidad/erroresHorneados.cjs')

const RAIZ = path.resolve(__dirname, '../..')
const DIRS = ['app', 'components']
const EXT = ['.tsx', '.jsx', '.ts', '.js']

function ficheros(dir: string, acc: string[] = []): string[] {
  const abs = path.join(RAIZ, dir)
  if (!fs.existsSync(abs)) return acc
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      ficheros(rel, acc)
    } else if (EXT.includes(path.extname(e.name))) {
      acc.push(rel)
    }
  }
  return acc
}

describe('analizarFuente — el núcleo, calibrado con los dos casos reales', () => {
  it('marca el catch que pinta JSX en una página cacheada (el fallo de TestHubPage)', () => {
    const codigo = `
      export default async function P() {
        try { return await datos() } catch (e) {
          return (<div><p className="text-red-600">Error cargando temas</p></div>)
        }
      }
      export const revalidate = false
    `
    const { hallazgos } = analizarFuente('components/test/X.tsx', codigo)
    expect(hallazgos).toHaveLength(1)
    expect(hallazgos[0].patron).toBe('catch_pinta_en_pagina_cacheada')
    expect(hallazgos[0].linea).toBeGreaterThan(0)
  })

  it('también cuando el cacheado se declara con force-static', () => {
    const codigo = `
      export const dynamic = 'force-static'
      async function P() { try { await x() } catch { return <p>vaya</p> } }
    `
    expect(analizarFuente('a.tsx', codigo).hallazgos).toHaveLength(1)
  })

  // El mismo catch en una página que NO se cachea es correcto: el aviso dura lo que la petición.
  it('no dice nada si la página no se cachea', () => {
    const codigo = `async function P() { try { await x() } catch { return <p>vaya</p> } }`
    expect(analizarFuente('a.tsx', codigo).hallazgos).toEqual([])
  })

  // Un catch que registra y relanza no hornea nada: es exactamente lo que queremos que se escriba.
  it('no marca el catch que NO pinta (registra, relanza, devuelve datos)', () => {
    const codigo = `
      export const revalidate = false
      async function P() {
        try { await x() } catch (e) { console.error(e); throw e }
        try { await y() } catch { return [] }
      }
    `
    expect(analizarFuente('a.tsx', codigo).hallazgos).toEqual([])
  })

  describe('la excepción firmada', () => {
    const conFirma = (firma: string) => `
      export const revalidate = 86400
      async function Trozo() {
        try { return <p>{await stats()}</p> }
        ${firma}
        catch { return <p>Error cargando estadísticas</p> }
      }
    `

    it('una excepción escrita al lado del catch se respeta, y se CUENTA', () => {
      const r = analizarFuente('a.tsx', conFirma('// erroresHorneados: excepcion — es un recuadro'))
      expect(r.hallazgos).toEqual([])
      expect(r.excepciones).toHaveLength(1)
    })

    // Si la firma valiera desde cualquier punto del fichero, una sola línea arriba del todo
    // taparía catches que nadie ha mirado. La excepción es por catch, no por fichero.
    it('una firma lejana NO cubre el catch', () => {
      const codigo = `
        // erroresHorneados: excepcion — puesta arriba del todo
        export const revalidate = false
        ${'\n'.repeat(40)}
        async function P() { try { await x() } catch { return <p>vaya</p> } }
      `
      expect(analizarFuente('a.tsx', codigo).hallazgos).toHaveLength(1)
    })
  })
})

describe('el repositorio, hoy', () => {
  it('ninguna página cacheada hornea una pantalla de error', () => {
    const hallazgos = DIRS.flatMap((d) => ficheros(d)).flatMap(
      (rel) => analizarFuente(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8')).hallazgos
    )
    const informe = hallazgos.map((h: { ruta: string; linea: number; detalle: string }) =>
      `  ${h.ruta}:${h.linea} — ${h.detalle}`).join('\n')
    expect(informe).toBe('')
  })

  // Trinquete: las excepciones son legítimas pero no pueden crecer sin que nadie lo note. Si este
  // número sube, alguien ha firmado una nueva y toca mirarla — no subir el techo por inercia.
  it('las excepciones firmadas siguen siendo las conocidas', () => {
    const excepciones = DIRS.flatMap((d) => ficheros(d)).flatMap(
      (rel) => analizarFuente(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8')).excepciones
    )
    expect(excepciones.map((e: { ruta: string }) => e.ruta).sort()).toEqual([
      'app/leyes/[law]/page.tsx',
    ])
  })
})
