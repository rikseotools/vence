/**
 * @jest-environment node
 *
 * El mensaje de límite diario es UNO SOLO — el de cuenta y el de dispositivo son indistinguibles.
 *
 * POR QUÉ (30/07/2026): había dos textos distintos. «Has alcanzado el límite diario de preguntas»
 * cuando topaba la cuenta, «Este dispositivo ha alcanzado el límite diario» cuando topaba el
 * dispositivo. Basta con cambiar de cuenta y comparar para deducir cómo contamos — y sabiéndolo,
 * el siguiente paso es coger otro móvil. Lo señaló Manuel: *"si dices esto, ya sabe que es por
 * dispositivo, entonces cogerá el móvil de su pareja y luego el de su hijo"*.
 *
 * El arreglo no fue suavizar el texto: fue que los dos casos digan LO MISMO. Este guardarraíl
 * impide que alguien vuelva a personalizar el del dispositivo «para que se entienda mejor» —
 * entenderlo mejor es justo el problema.
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

/** Rutas que aplican el límite diario y devuelven el mensaje al usuario. */
const RUTAS = [
  'app/api/v2/answer-and-save/route.ts',
  'app/api/answer/psychometric/route.ts',
  'app/api/answer/spelling/route.ts',
  'app/api/exam/answer/route.ts',
  'backend/src/answer-save/answer-save.controller.ts',
]

describe('límite diario — el mensaje no revela por qué se cortó', () => {
  it.each(RUTAS)('%s no menciona el dispositivo en el texto del usuario', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf-8')
    // Buscamos la MENCIÓN en cadenas de cara al usuario, no en comentarios.
    const lineasDeMensaje = src
      .split('\n')
      .filter((l) => /error:|message:/.test(l) && /límite diario/i.test(l))
    for (const l of lineasDeMensaje) {
      expect({ ruta: rel, dice_dispositivo: /dispositivo/i.test(l), linea: l.trim().slice(0, 90) })
        .toEqual({ ruta: rel, dice_dispositivo: false, linea: l.trim().slice(0, 90) })
    }
  })

  it('el texto es IDÉNTICO en todas las rutas (si difiere, se puede deducir cuál saltó)', () => {
    const textos = new Set<string>()
    for (const rel of RUTAS) {
      const src = readFileSync(join(ROOT, rel), 'utf-8')
      for (const m of src.matchAll(/'(Has alcanzado el límite diario[^']*)'/g)) textos.add(m[1])
    }
    expect({ variantesDistintas: [...textos] }).toEqual({
      variantesDistintas: [
        'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.',
      ],
    })
  })

  it('la constante compartida existe en los dos lados y coincide', () => {
    const raiz = readFileSync(join(ROOT, 'lib/api/daily-limit/mensajes.ts'), 'utf-8')
    const espejo = readFileSync(join(ROOT, 'backend/src/daily-limit/mensajes.ts'), 'utf-8')
    const sacar = (s: string) => s.match(/MSG_LIMITE_DIARIO\s*=\s*\n?\s*'([^']+)'/)?.[1]
    expect(sacar(raiz)).toBeTruthy()
    expect(sacar(espejo)).toBe(sacar(raiz))
  })

  it('ninguna ruta de la app conserva el mensaje viejo que delataba el mecanismo', () => {
    const sospechosas: string[] = []
    const escanear = (dir: string) => {
      for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue
        const rel = `${dir}/${e.name}`
        if (e.isDirectory()) escanear(rel)
        else if (e.name.endsWith('.ts') && readFileSync(join(ROOT, rel), 'utf-8').includes('Este dispositivo ha alcanzado')) {
          sospechosas.push(rel)
        }
      }
    }
    escanear('app')
    escanear('backend/src')
    expect({ ficherosConElMensajeViejo: sospechosas }).toEqual({ ficherosConElMensajeViejo: [] })
  })
})
