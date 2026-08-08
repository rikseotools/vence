/** @jest-environment node */
// __tests__/integration/modalZIndexCapas.test.ts
//
// GUARDARRAÍL DE CÓDIGO (T-608 parte 2). Complementa a `__tests__/lib/ui/capas.test.ts`, que
// solo fija las RELACIONES entre capas (`tapaA`) — no podía ver que el código real siguiera
// escribiendo `z-50`/`z-[9999]` a mano en vez de usar `CAPAS`.
//
// De dónde sale: el modal de «solo preguntas falladas» se pintaba entero en el móvil y el
// cuarto inferior no se podía tocar, porque el banner de cookies vive en `z-[9999]` y el modal
// en `z-50` (feedback Laura Simar, 06/08/2026). Arreglado ESE modal con `CAPAS.modal` en
// `lib/ui/capas.ts`, pero el mismo agujero seguía en otros 46 sitios: 41 ficheros con
// `fixed inset-0 … z-50` (mismo grep que abrió la ficha) + 6 más con `z-[9999]`/`z-[9998]`/
// `z-[1000]`/`z-[999]`/`z-[100]`/`z-[60]` — números mágicos donde alguien ya había escalado a
// mano para "ganarle" al banner (`ArticleModal`/`AvatarChanger` lo hicieron dos veces antes de
// que existiera `CAPAS`; este barrido encontró una TERCERA vez en `admin/feedback` y CINCO más
// sin relación con el banner de cookies, pero con el mismo síntoma: perdían contra `CAPAS.modal`
// al no pasar por la escala común).
//
// Y una CUARTA cosa que salió al mismo tiempo, distinta de "modal pierde contra el banner":
// `FranjaImpersonacion` (el aviso rojo de "estás viendo la cuenta de otra persona") estaba en
// `z-[9999]`, que es MENOR que `CAPAS.modal` (10000) — un modal abierto durante una
// suplantación TAPABA el aviso, justo lo que `capas.ts` documenta que no puede pasar. Migrada a
// `CAPAS.sistema`.
//
// Qué NO cubre a propósito (no es el mismo patrón, no se ha tocado sin medir):
//   · overlays `fixed inset-0` SIN centrar contenido ni scroll — los "clic fuera para cerrar"
//     de menús/dropdowns pegados a la cabecera (`Header.tsx`, `HeaderDesktopNav.tsx`,
//     `NotificationBell.tsx`, `InteractiveBreadcrumbs.tsx`, `UserAvatar.tsx`): no son diálogos
//     centrados, viven arriba, y su z (40/60) es una jerarquía LOCAL frente a su propio
//     contenido, no frente al banner de cookies (abajo). El discriminante es objetivo: un
//     modal de verdad en este código SIEMPRE centra su contenido (`flex items-center
//     justify-center`) o lo hace desplazable (`overflow-y-auto`); un backdrop de menú no
//     hace ninguna de las dos cosas.
//   · elementos `fixed` que NO son `inset-0` (barras/tooltips/toasts como
//     `TTSFloatingPlayer`, `PwaInstallBanner`, los "fixed bottom-4 right-4" de
//     notificaciones): otra familia de componente, con otra semántica de capas.
//
// CI-safe: no necesita DB ni navegador, solo lee archivos.

import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const ROOTS = [join(process.cwd(), 'app'), join(process.cwd(), 'components')]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.(tsx|jsx|js)$/.test(full)) out.push(full)
  }
  return out
}

// La firma de un MODAL de verdad en este código: fondo fijo a pantalla completa que además
// centra su contenido o lo hace desplazable. Un backdrop de "clic fuera para cerrar" de un
// dropdown no hace ninguna de las dos cosas (ver cabecera del fichero).
const ES_MODAL = /flex items-center justify-center|overflow-y-auto/
const Z_SUELTO = /\bz-(\d+|\[[0-9]+\])\b/

describe('Guardarraíl de código: los modales de pantalla completa usan CAPAS, no un z suelto', () => {
  it('ningún `fixed inset-0` que centra/desplaza contenido lleva `z-NN`/`z-[NNNN]` en vez de CAPAS', () => {
    const offenders: string[] = []

    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const rel = file.slice(process.cwd().length + 1)
        const lines = readFileSync(file, 'utf8').split('\n')

        lines.forEach((line, i) => {
          const m = line.match(/className="([^"]*)"/)
          if (!m) return
          const classValue = m[1]
          if (!classValue.includes('fixed inset-0')) return
          if (!ES_MODAL.test(classValue)) return // no es un modal (ver exclusiones de cabecera)
          if (!Z_SUELTO.test(classValue)) return // ya no lleva z suelto

          offenders.push(`  ${rel}:${i + 1}  ${line.trim().slice(0, 110)}`)
        })
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} modal(es) de pantalla completa con un z-index suelto en vez de ` +
          `CAPAS (lib/ui/capas.ts) — pierden contra el banner de cookies (CAPAS.avisoLegal) o ` +
          `contra otro modal, según el número. Usa \`style={{ zIndex: CAPAS.modal }}\`:\n` +
          offenders.join('\n'),
      )
    }

    expect(offenders.length).toBe(0)
  })

  it('el aviso de suplantación (`FranjaImpersonacion`) usa CAPAS.sistema, no un número suelto', () => {
    // Caso aparte del `it` de arriba porque esta franja no es `inset-0` (es una barra superior,
    // no un backdrop de pantalla completa) y por eso el escaneo general no la ve. Fijado en
    // duro: es UN fichero, y lo que importa es que nunca vuelva a un z-[9999] que empataría con
    // el banner de cookies y perdería contra CAPAS.modal.
    const src = readFileSync(
      join(process.cwd(), 'components', 'admin', 'FranjaImpersonacion.tsx'),
      'utf8',
    )
    const claseDeLaFranja = src.match(/className="([^"]*fixed top-0[^"]*)"/)?.[1] ?? ''
    expect(src).toMatch(/CAPAS\.sistema/)
    expect(claseDeLaFranja).not.toMatch(/z-\[\d+\]|z-\d+\b/)
  })
})
