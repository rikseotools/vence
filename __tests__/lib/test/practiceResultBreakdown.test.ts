import { summarizePracticeResults, BLANK_SELECTED_ANSWER } from '@/lib/test/practiceResultBreakdown'

describe('summarizePracticeResults — blanco NO cuenta como incorrecta (feedback Pablo)', () => {
  it('separa correctas / incorrectas / en blanco', () => {
    const r = summarizePracticeResults([
      { selectedAnswer: 2, correct: true },
      { selectedAnswer: 0, correct: false },
      { selectedAnswer: BLANK_SELECTED_ANSWER, correct: false }, // blanco
      { selectedAnswer: BLANK_SELECTED_ANSWER, correct: false }, // blanco
    ])
    expect(r).toEqual({ correct: 1, incorrect: 1, blank: 2, answered: 2 })
  })

  it('un blanco (selectedAnswer=-1) NUNCA suma a incorrectas', () => {
    const r = summarizePracticeResults([
      { selectedAnswer: BLANK_SELECTED_ANSWER, correct: false },
    ])
    expect(r.incorrect).toBe(0)
    expect(r.blank).toBe(1)
    expect(r.answered).toBe(0)
  })

  it('test sin blancos: answered === total', () => {
    const r = summarizePracticeResults([
      { selectedAnswer: 1, correct: true },
      { selectedAnswer: 3, correct: false },
    ])
    expect(r).toEqual({ correct: 1, incorrect: 1, blank: 0, answered: 2 })
  })

  it('lista vacía → todo a cero', () => {
    expect(summarizePracticeResults([])).toEqual({ correct: 0, incorrect: 0, blank: 0, answered: 0 })
  })

  it('correct=true tiene prioridad de conteo aunque sentinela no aplique', () => {
    // Una correcta siempre lleva un selectedAnswer real (>=0); nunca -1.
    const r = summarizePracticeResults([{ selectedAnswer: 0, correct: true }])
    expect(r.correct).toBe(1)
    expect(r.blank).toBe(0)
  })
})
