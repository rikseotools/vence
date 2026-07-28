/**
 * @jest-environment node
 */
// __tests__/guardrails/pwaManifest.guardrail.test.ts
//
// El manifest de la PWA y sus iconos, verificados contra los BYTES del fichero.
//
// ## Por qué existe
//
// Una usuaria (Lara, 28/07/2026) preguntó si hay app para Android. La respuesta correcta es
// "no hay app nativa, pero puedes instalarla desde el navegador"… salvo que no se podía:
// el manifest declaraba UN solo icono, `/icon-192.png`, y ese fichero **no era un PNG**.
// Era un fichero de texto de 202 bytes con un TODO dentro:
//
//     # Este archivo debe ser reemplazado por un icono PNG real de 192x192px
//
// Producción lo servía con `content-type: image/png` y un 200, así que **ningún check de
// disponibilidad lo habría cazado**: la URL respondía. Solo mirando los bytes se ve.
//
// De ahí la forma de este guardarraíl: no comprueba que el fichero exista (existía), ni que
// la ruta responda (respondía). Comprueba la **firma PNG y las dimensiones reales**, que es
// lo único que distingue un icono de un post-it.
//
// Y una segunda lección, del mismo día: había DOS manifiestos con el mismo contenido
// (`app/manifest.js`, que es el que se sirve, y `public/manifest.json`, que no leía nadie).
// El arreglo se hizo primero sobre la copia muerta. Por eso este test lee `app/manifest.js`
// y por eso la copia se borró: dos definiciones de lo mismo es una que se queda vieja.

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Se lee el manifiesto REAL: el que Next sirve en /manifest.webmanifest. Y no es un detalle
// de estilo — la primera versión de este test apuntaba a `public/manifest.json`, una copia
// muerta que no leía nadie, así que habría dado verde con el manifiesto de producción roto.
// Esa copia ya no existe (se borró el 28/07 justo por esto).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const manifest = require('../../app/manifest.js').default()

/** Cabecera PNG + dimensiones leídas del chunk IHDR. Sin dependencias. */
function leerPng(buf: Buffer): { esPng: boolean; ancho: number; alto: number } {
  const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const esPng = buf.length > 24 && buf.subarray(0, 8).equals(FIRMA)
  if (!esPng) return { esPng: false, ancho: 0, alto: 0 }
  // IHDR va siempre el primero: 8 firma + 4 longitud + 4 tipo, luego ancho y alto (uint32 BE).
  return { esPng: true, ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) }
}

describe('manifest de la PWA', () => {
  it('cumple los requisitos de instalación de Chrome en Android', () => {
    // Sin esto no sale el "Instalar aplicación": queda en un acceso directo.
    expect(manifest.name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    const sizes = (manifest.icons ?? []).map((i: any) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('el nombre no habla de UNA sola oposición', () => {
    // Decía "Vence.es - Oposiciones Auxiliar Administrativo" cuando la plataforma cubre más
    // de cien. Es lo que el usuario ve bajo el icono al instalarla.
    expect(manifest.name).not.toMatch(/auxiliar administrativo/i)
  })

  it('cada icono declarado EXISTE y es un PNG de verdad, del tamaño que dice', () => {
    // El corazón del asunto: un .png que no es un png pasa cualquier comprobación de ruta.
    const icons = manifest.icons ?? []
    expect(icons.length).toBeGreaterThan(0)

    for (const icon of icons) {
      const ruta = join(process.cwd(), 'public', icon.src)
      expect(existsSync(ruta)).toBe(true)

      const { esPng, ancho, alto } = leerPng(readFileSync(ruta))
      // Mensaje explícito: si esto peta, que se lea el motivo sin abrir el fichero.
      expect(`${icon.src}:${esPng ? 'png' : 'NO-ES-PNG'}`).toBe(`${icon.src}:png`)

      const [w, h] = String(icon.sizes).split('x').map(Number)
      expect(`${icon.src}:${ancho}x${alto}`).toBe(`${icon.src}:${w}x${h}`)
    }
  })

  it('ningún icono es un marcador de posición con texto dentro', () => {
    // El fichero roto empezaba por "#" y pesaba 202 bytes. Un PNG de 192x192 no baja de ~1 KB.
    for (const icon of manifest.icons ?? []) {
      const buf = readFileSync(join(process.cwd(), 'public', icon.src))
      expect(`${icon.src}:${buf.length > 1000}`).toBe(`${icon.src}:true`)
    }
  })
})
