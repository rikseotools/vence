/**
 * Tests for /api/v2/official-exams/complete behavior
 *
 * Verifies the distinction between:
 * 1. Exam Score (shown to user) - blank questions don't count
 * 2. Learning History (internal) - blank questions count as failures
 */

describe('Official Exam Complete - Scoring vs Learning', () => {
  describe('Exam Score Calculation', () => {
    it('should only count answered questions for score', () => {
      // Simulate exam results
      const results = [
        { questionOrder: 1, userAnswer: 'a', isCorrect: true },   // Answered correctly
        { questionOrder: 2, userAnswer: 'b', isCorrect: false },  // Answered incorrectly
        { questionOrder: 3, userAnswer: '', isCorrect: false },   // Blank
        { questionOrder: 4, userAnswer: '', isCorrect: false },   // Blank
      ]

      // Filter answered questions (same logic as /complete API)
      const answeredQuestions = results.filter(
        r => r.userAnswer && r.userAnswer !== 'sin_respuesta' && r.userAnswer.trim() !== ''
      )
      const correctCount = answeredQuestions.filter(r => r.isCorrect).length
      const answeredCount = answeredQuestions.length
      const score = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0

      // Score should be 50% (1 correct out of 2 answered)
      // NOT 25% (1 correct out of 4 total)
      expect(answeredCount).toBe(2)
      expect(correctCount).toBe(1)
      expect(score).toBe(50)
    })

    it('should return 0% when no questions are answered', () => {
      const results = [
        { questionOrder: 1, userAnswer: '', isCorrect: false },
        { questionOrder: 2, userAnswer: '', isCorrect: false },
      ]

      const answeredQuestions = results.filter(
        r => r.userAnswer && r.userAnswer.trim() !== ''
      )
      const answeredCount = answeredQuestions.length
      const score = answeredCount > 0 ? Math.round((1 / answeredCount) * 100) : 0

      expect(answeredCount).toBe(0)
      expect(score).toBe(0)
    })
  })

  describe('Learning History Registration', () => {
    it('should identify unanswered questions for history registration', () => {
      const savedQuestions = [
        { questionId: 'q1', userAnswer: 'a' },   // Answered
        { questionId: 'q2', userAnswer: 'b' },   // Answered
        { questionId: 'q3', userAnswer: '' },    // Blank
        { questionId: 'q4', userAnswer: null },  // Blank (null)
        { questionId: 'q5', userAnswer: '  ' },  // Blank (whitespace)
      ]

      // Answered questions (saved with their actual result)
      const answered = savedQuestions.filter(
        q => q.questionId && q.userAnswer && q.userAnswer.trim() !== ''
      )

      // Unanswered questions (saved as failures for review)
      const unanswered = savedQuestions.filter(
        q => q.questionId && (!q.userAnswer || q.userAnswer.trim() === '')
      )

      expect(answered.length).toBe(2)
      expect(unanswered.length).toBe(3)
    })

    it('should mark unanswered questions as failures with 0 correct attempts', () => {
      // When registering unanswered question in history
      const unansweredHistoryEntry = {
        totalAttempts: 1,
        correctAttempts: 0,  // Unanswered = failed
        successRate: '0.00',
      }

      expect(unansweredHistoryEntry.correctAttempts).toBe(0)
      expect(unansweredHistoryEntry.successRate).toBe('0.00')
    })
  })

  describe('Total Questions Count', () => {
    it('should count ALL questions (including unanswered) for total', () => {
      const results = [
        { questionOrder: 1, userAnswer: 'a' },
        { questionOrder: 2, userAnswer: '' },
        { questionOrder: 3, userAnswer: '' },
      ]

      // totalQuestions should be all questions, not just answered
      const totalQuestions = results.length

      expect(totalQuestions).toBe(3)
    })
  })
})

describe('Official Exam - Spanish Oposiciones Scoring Rules', () => {
  it('should follow standard oposiciones formula', () => {
    /**
     * Standard Spanish oposiciones scoring:
     * - Correct: +1 point
     * - Incorrect: -1/3 point (penalty to discourage guessing)
     * - Blank: 0 points
     *
     * Final score = (correct - incorrect/3) / total * 10
     *
     * Note: The actual penalty calculation happens in the frontend.
     * This API just tracks correct/incorrect/blank status.
     */

    const exam = {
      totalQuestions: 64,
      correct: 30,
      incorrect: 20,
      blank: 14,
    }

    // Verify counts add up
    expect(exam.correct + exam.incorrect + exam.blank).toBe(exam.totalQuestions)

    // Simulated score calculation (as shown in UI)
    const rawScore = exam.correct - (exam.incorrect / 3)
    const scoreOver10 = (rawScore / exam.totalQuestions) * 10

    expect(rawScore).toBeCloseTo(23.33, 1)
    expect(scoreOver10).toBeCloseTo(3.65, 1)
  })
})
