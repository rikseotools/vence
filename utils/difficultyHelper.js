/**
 * Utilidades para trabajar con dificultad calculada (global_difficulty)
 * y dificultad estática (difficulty) como fallback
 */

/**
 * Convierte dificultad numérica (0-100) a categoría textual
 * @param {number} globalDifficulty - Dificultad calculada (0-100)
 * @returns {string} Categoría: 'easy', 'medium', 'hard', 'extreme'
 */
export function getDifficultyCategory(globalDifficulty) {
  if (globalDifficulty === null || globalDifficulty === undefined) {
    return null
  }

  if (globalDifficulty < 25) return 'easy'
  if (globalDifficulty < 50) return 'medium'
  if (globalDifficulty < 75) return 'hard'
  return 'extreme'
}

/**
 * Obtiene la dificultad efectiva de una pregunta
 * Prioriza global_difficulty (calculada), fallback a difficulty (estática)
 * @param {Object} question - Objeto pregunta con global_difficulty y difficulty
 * @returns {string} Categoría: 'easy', 'medium', 'hard', 'extreme'
 */
export function getEffectiveDifficulty(question) {
  if (!question) return null

  // Priorizar dificultad calculada
  if (question.global_difficulty !== null && question.global_difficulty !== undefined) {
    return getDifficultyCategory(question.global_difficulty)
  }

  // Fallback a dificultad estática
  return question.difficulty
}

/**
 * Filtra preguntas por dificultad objetivo
 * Usa global_difficulty (calculada) cuando está disponible
 * @param {Array} questions - Array de preguntas
 * @param {string} targetDifficulty - 'easy', 'medium', 'hard', 'extreme', 'random'
 * @returns {Array} Preguntas filtradas
 */
export function filterQuestionsByDifficulty(questions, targetDifficulty) {
  if (!questions || questions.length === 0) return []
  if (targetDifficulty === 'random' || !targetDifficulty) return questions

  return questions.filter(q => {
    const effectiveDifficulty = getEffectiveDifficulty(q)
    return effectiveDifficulty === targetDifficulty
  })
}

/**
 * Añade campo 'global_difficulty' al SELECT de Supabase query builder
 * @param {string} existingSelect - SELECT string actual
 * @returns {string} SELECT con global_difficulty añadido
 */
export function addGlobalDifficultyToSelect(existingSelect) {
  // Si ya incluye global_difficulty, retornar sin cambios
  if (existingSelect.includes('global_difficulty')) {
    return existingSelect
  }

  // Si incluye 'difficulty' pero no 'global_difficulty', añadir global_difficulty
  if (existingSelect.includes('difficulty')) {
    // Buscar 'difficulty' y añadir 'global_difficulty' justo antes
    return existingSelect.replace(/(\s*)difficulty/, '$1global_difficulty,\n$1difficulty')
  }

  // Si no incluye difficulty, añadir ambos al final
  return existingSelect.trim() + ',\nglobal_difficulty,\ndifficulty'
}
