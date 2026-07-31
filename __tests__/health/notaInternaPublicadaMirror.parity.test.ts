// __tests__/health/notaInternaPublicadaMirror.parity.test.ts
//
// Paridad NÚCLEO ↔ ESPEJO del detector de notas internas publicadas [T-435], y guardarraíl de que
// su herramienta de saneo no abre un segundo camino de escritura al hub de provenance.
//
// El writer real de `content_health_findings` es el `@Cron` del backend, que NO puede importar del
// `lib/` del frontend (proyecto NestJS aparte) y por eso lleva un mirror inline. Un mirror a mano
// se desincroniza solo — pasó con el sweep entero el 22/07 (8 detectores de diferencia, snapshot
// incompleto cada noche EN SILENCIO). `content-sweep-parity` ya vigila que ambos emitan los mismos
// `kind`s; lo que NO vigila es que la LÓGICA coincida, que es justo donde duele: los dos pueden
// emitir `nota_interna_publicada` y discrepar en QUÉ marcan.
//
// Se compara por COMPORTAMIENTO sobre cadenas reales del banco, no por parecido textual de las
// regex: comparar regex con regex se rompe con el primer patrón raro y el test mentiría en silencio.
import fs from 'fs'
import path from 'path'

/* eslint-disable @typescript-eslint/no-var-requires */
const { clasificarValor } = require('../../lib/convocatoria/notaInternaPublicada.cjs') as {
  clasificarValor: (v: unknown) => { esNota: boolean; tipo: string | null }
}

const REPO = path.resolve(__dirname, '../..')
const BACKEND = fs.readFileSync(
  path.join(REPO, 'backend/src/content-health-sweep/content-health-sweep.service.ts'), 'utf8')
const HERRAMIENTA = fs.readFileSync(
  path.join(REPO, 'scripts/convocatoria/sanear-referencia-publicada.cjs'), 'utf8')

/**
 * Evalúa el espejo del backend: se extraen sus literales de regex y se ejecutan de verdad. Nada de
 * comparar cadenas de código — eso da falsos verdes en cuanto cambia un espacio.
 */
function clasificarConElEspejo(valor: string): { esNota: boolean; tipo: string | null } {
  const bloque = BACKEND.slice(BACKEND.indexOf('const NOTA_FAMILIAS'), BACKEND.indexOf('const NOTA_CAMPOS'))
  // Las regex del espejo no contienen barras internas, así que `[^/]+` corta exactamente en el
  // cierre. Se evita `.+` a propósito: greedy sobre una línea con varias barras se traga de más.
  const familias = [...bloque.matchAll(/tipo:\s*'([a-z_]+)',\s*re:\s*(\/[^/]+\/[a-z]*)/g)]
  expect(familias.length).toBeGreaterThanOrEqual(4)   // si el espejo se queda sin patrones, aquí salta
  for (const [, tipo, reLiteral] of familias) {
    const cuerpo = reLiteral.slice(1, reLiteral.lastIndexOf('/'))
    const flags = reLiteral.slice(reLiteral.lastIndexOf('/') + 1)
    if (new RegExp(cuerpo, flags).test(valor)) return { esNota: true, tipo }
  }
  return { esNota: false, tipo: null }
}

// Cadenas REALES del banco (31/07/2026): las cuatro que hay que marcar y las tres que no.
const CASOS: Array<[string, string]> = [
  ['duda del Celador', '⚠️ SIN VERIFICAR: la fila afirma 688 plazas (52 discapacidad) citando "BOCM núm. 158/2025".'],
  ['duda de Cantabria', '⚠️ NO VERIFICABLE CON ESTE DOCUMENTO. Decreto 51/2025 (BOC nº 161, 22/08/2025).'],
  ['rastro de competidor', 'Catalogada 04/07/2026 via Capa 3 competidores (oposiciones.es). ~59 plz (sin verificar).'],
  ['nota pegada al final', 'Decreto 51/2025 (BOC nº 161): OEP 2025. ⚠️ El decreto NO desglosa el cupo por subgrupo.'],
  ['referencia canónica corta', 'BOE-A-2026-6897'],
  ['cita literal larga (la convención de la casa)', 'RESOLUCIÓN de 19/11/2025 (DOG nº 228, 25/11/2025, AnuncioG0597-191125-0004): "El objeto del proceso selectivo será cubrir ochenta y tres (83) plazas del cuerpo auxiliar".'],
  ['prosa legítima con «pendiente de publicar»', 'Decreto 54/2026 (BOCM nº 125, 28/05/2026): OEP 2026 aprobada, convocatoria pendiente de publicar.'],
]

describe('paridad núcleo ↔ espejo del backend', () => {
  it.each(CASOS)('%s: núcleo y espejo dicen lo mismo', (_nombre, valor) => {
    const nucleo = clasificarValor(valor)
    const espejo = clasificarConElEspejo(valor)
    expect(espejo.esNota).toBe(nucleo.esNota)
    expect(espejo.tipo).toBe(nucleo.tipo)
  })

  it('el espejo mira los MISMOS campos publicables que el núcleo', () => {
    const { CAMPOS_PUBLICADOS } = require('../../lib/convocatoria/notaInternaPublicada.cjs')
    for (const campo of CAMPOS_PUBLICADOS) expect(BACKEND).toContain(`'${campo}'`)
  })

  it('el espejo lee de oposiciones_ssot, no de la tabla base', () => {
    // El GOTCHA que decide si el detector sirve para algo: la nota vive en `convocatorias` y la
    // landing lee la vista. Barriendo `oposiciones` el resultado fue CERO con el aviso en pantalla.
    // La consulta va DESPUÉS del rótulo del detector, no antes: se mira hacia delante.
    const i = BACKEND.indexOf('NOTAS INTERNAS PUBLICADAS EN LA LANDING')
    expect(i).toBeGreaterThan(0)
    expect(BACKEND.slice(i, i + 2000)).toContain('FROM oposiciones_ssot')
  })
})

describe('la herramienta de saneo NO abre un segundo camino de escritura al hub', () => {
  // `ensure_convocatoria_documento` es el ÚNICO camino de escritura a `convocatoria_documentos`, y
  // el clonador canónico es `backend/scripts/clonar-documento.ts`. Esta herramienta solo ENLAZA la
  // prueba que ya está clonada; si clonara por su cuenta tendríamos dos puertas al mismo recurso
  // con criterios distintos, que es como se pierde la provenance.
  it('no inserta en convocatoria_documentos', () => {
    expect(HERRAMIENTA).not.toMatch(/INSERT\s+INTO\s+convocatoria_documentos/i)
  })

  it('cuando falta el documento, manda al clonador CANÓNICO por su nombre', () => {
    expect(HERRAMIENTA).toContain('backend/scripts/clonar-documento.ts')
  })

  it('no marca verificado sin contrastar la cita contra el texto del documento clonado', () => {
    expect(HERRAMIENTA).toContain('extracted_text')
    expect(HERRAMIENTA).toMatch(/no se enlaza una prueba falsa|la cita NO aparece/)
  })
})
