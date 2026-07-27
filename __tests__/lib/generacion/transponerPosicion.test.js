/**
 * Tests del núcleo puro `lib/generacion/transponerPosicion.js` (§2.2-ter).
 *
 * El caso que motiva el módulo es real: en `gen_atc_t209` (25/07/2026) se rotaron las
 * cuatro opciones a mano y dos viñetas quedaron describiendo la opción equivocada, sin
 * que ningún gate lo viera. Aquí se fija que la transposición mueve DOS letras y que
 * cada viñeta sigue describiendo su opción.
 */
const {
  transponer,
  planEquilibrio,
  equilibrarLote,
} = require('../../../lib/generacion/transponerPosicion')

// Pregunta de laboratorio: cada opción y su viñeta se identifican por su contenido,
// así que un remapeo mal hecho se ve a simple vista.
const preguntaBase = (correct = 2) => ({
  question_text: '¿Cuál es la correcta?',
  options: ['texto-A', 'texto-B', 'texto-C', 'texto-D'],
  correct_option: correct,
  explanation:
    '> **Art. 1**\n> "cita"\n\n' +
    `**Por qué ${'ABCD'[correct]} es correcta:** porque sí.\n\n` +
    '**Por qué las demás son incorrectas:**\n' +
    ['A', 'B', 'C', 'D']
      .filter((l) => l !== 'ABCD'[correct])
      .map((l) => `- **${l})** falla lo de texto-${l}.`)
      .join('\n'),
})

const vinieta = (exp, letra) =>
  (exp.split('\n').find((l) => l.startsWith(`- **${letra})**`)) || '').replace(`- **${letra})** `, '')

describe('transponer', () => {
  test('intercambia SOLO las dos posiciones implicadas', () => {
    const { pregunta, movida, de, a } = transponer(preguntaBase(2), 0)
    expect(movida).toBe(true)
    expect([de, a]).toEqual(['C', 'A'])
    expect(pregunta.correct_option).toBe(0)
    expect(pregunta.options).toEqual(['texto-C', 'texto-B', 'texto-A', 'texto-D'])
    // las dos ajenas, intactas
    expect(pregunta.options[1]).toBe('texto-B')
    expect(pregunta.options[3]).toBe('texto-D')
  })

  test('cada viñeta sigue describiendo la opción que ocupa su letra (el fallo de gen_atc_t209)', () => {
    const { pregunta } = transponer(preguntaBase(2), 0)
    expect(pregunta.explanation).toContain('**Por qué A es correcta:**')
    // en C está ahora el distractor que antes estaba en A
    expect(pregunta.options[2]).toBe('texto-A')
    expect(vinieta(pregunta.explanation, 'C')).toContain('texto-A')
    expect(vinieta(pregunta.explanation, 'B')).toContain('texto-B')
    expect(vinieta(pregunta.explanation, 'D')).toContain('texto-D')
    // y ya no queda viñeta de la letra que pasó a ser la correcta
    expect(pregunta.explanation).not.toMatch(/^- \*\*A\)\*\*/m)
  })

  test('las viñetas quedan en orden alfabético', () => {
    const { pregunta } = transponer(preguntaBase(0), 3)
    const letras = pregunta.explanation
      .split('**Por qué las demás son incorrectas:**')[1]
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => l.match(/^- \*\*([ABCD])\)/)[1])
    expect(letras).toEqual([...letras].sort())
  })

  test('destino igual a la posición actual es no-op', () => {
    const q = preguntaBase(1)
    const { pregunta, movida } = transponer(q, 1)
    expect(movida).toBe(false)
    expect(pregunta).toBe(q)
  })

  test('aborta si la cabecera no está sincronizada con correct_option', () => {
    const q = preguntaBase(2)
    q.correct_option = 1 // la cabecera sigue diciendo C
    expect(() => transponer(q, 0)).toThrow(/cabecera/)
  })

  test('aborta si falta la viñeta del destino', () => {
    const q = preguntaBase(2)
    q.explanation = q.explanation.replace(/^- \*\*A\)\*\*.*$/m, '')
    expect(() => transponer(q, 0)).toThrow(/viñeta/)
  })

  test('rechaza destinos fuera de rango', () => {
    expect(() => transponer(preguntaBase(0), 4)).toThrow(/destino/)
    expect(() => transponer(preguntaBase(0), -1)).toThrow(/destino/)
  })

  test('mueve también las razones del formato estructurado §8.2', () => {
    const q = { ...preguntaBase(2), explanation_data: { v: 1, options: { 0: 'r-A', 1: 'r-B', 2: 'r-C', 3: 'r-D' } } }
    const { pregunta } = transponer(q, 0)
    expect(pregunta.explanation_data.options['0']).toBe('r-C')
    expect(pregunta.explanation_data.options['2']).toBe('r-A')
    expect(pregunta.explanation_data.options['1']).toBe('r-B')
  })

  test('no muta la pregunta de entrada', () => {
    const q = preguntaBase(2)
    const copia = JSON.parse(JSON.stringify(q))
    transponer(q, 0)
    expect(q).toEqual(copia)
  })
})

describe('planEquilibrio', () => {
  const lote = (letras) => letras.map((l) => ({ correct_option: 'ABCD'.indexOf(l) }))
  const secuencia = (preguntas) => preguntas.map((q) => 'ABCD'[q.correct_option]).join('')

  test('un lote ya plano no se toca', () => {
    expect(planEquilibrio(lote('ABCDBADC'.split('')))).toEqual([])
  })

  test('reparte la letra en exceso hacia las deficitarias', () => {
    const q = lote('BBBBBBBB'.split(''))
    const plan = planEquilibrio(q)
    expect(plan.length).toBe(6) // se quedan 2 en B (ceil(8/4)=2)
    const res = q.map((x, i) => {
      const m = plan.find((p) => p.i === i)
      return { correct_option: m ? m.a : x.correct_option }
    })
    const cuenta = [0, 0, 0, 0]
    res.forEach((x) => cuenta[x.correct_option]++)
    expect(Math.max(...cuenta) - Math.min(...cuenta)).toBeLessThanOrEqual(1)
  })

  test('rompe el ciclo regular de periodo 4 aunque el reparto ya sea plano', () => {
    const q = lote('ABCDABCDABCD'.split(''))
    const plan = planEquilibrio(q)
    expect(plan.length).toBeGreaterThan(0)
    const res = q.map((x, i) => {
      const m = plan.find((p) => p.i === i)
      return { correct_option: m ? m.a : x.correct_option }
    })
    const ciclo = res.every((x, k) => k < 4 || x.correct_option === res[k - 4].correct_option)
    expect(ciclo).toBe(false)
  })

  // Regresión del canario (27/07/2026): con 15 preguntas, cupoMin(3) < cupoMax(4), así
  // que repartir "solo hasta cubrir el mínimo" dejaba la letra en exceso al 40% — el
  // borde exacto que el gate tolera. Con n=8 el fallo es invisible (cupoMin===cupoMax).
  test('vacía la letra en exceso hasta el cupo, no solo hasta cubrir el mínimo ajeno', () => {
    const q = lote([...'CCCCCCCCCCC', 'D', 'A', 'B', 'C'])
    const plan = planEquilibrio(q)
    const cuenta = [0, 0, 0, 0]
    q.forEach((x, i) => {
      const m = plan.find((p) => p.i === i)
      cuenta[m ? m.a : x.correct_option]++
    })
    expect(Math.max(...cuenta)).toBeLessThanOrEqual(Math.ceil(q.length / 4))
    expect(Math.max(...cuenta) / q.length).toBeLessThanOrEqual(0.4)
  })

  test('es determinista: mismo lote, mismo plan', () => {
    const q = lote('AAAABBCC'.split(''))
    expect(planEquilibrio(q)).toEqual(planEquilibrio(q))
  })

  test('equilibrarLote deja el lote dentro de las bandas y con las explicaciones coherentes', () => {
    const preguntas = ['C', 'C', 'C', 'C', 'C', 'C', 'A', 'B'].map((l) => preguntaBase('ABCD'.indexOf(l)))
    const { preguntas: out, movimientos } = equilibrarLote(preguntas)
    expect(movimientos.length).toBeGreaterThan(0)
    const cuenta = [0, 0, 0, 0]
    out.forEach((q) => cuenta[q.correct_option]++)
    expect(Math.max(...cuenta) / out.length).toBeLessThanOrEqual(0.4)
    // invariante de fondo: la opción correcta y su cabecera siguen apuntando a lo mismo
    for (const q of out) {
      const letra = 'ABCD'[q.correct_option]
      expect(q.explanation).toContain(`**Por qué ${letra} es correcta:**`)
      expect(q.explanation).not.toMatch(new RegExp(`^- \\*\\*${letra}\\)`, 'm'))
      for (const l of ['A', 'B', 'C', 'D'].filter((x) => x !== letra)) {
        expect(vinieta(q.explanation, l)).toContain(q.options['ABCD'.indexOf(l)])
      }
    }
    expect(secuencia(out)).not.toMatch(/^(.)(.)(.)(.)\1\2\3\4$/)
  })
})
