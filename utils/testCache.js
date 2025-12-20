// utils/testCache.js - MÍNIMO para que compile el proyecto
export function getTestResult() { return null }
export function formatDate(dateString) { 
  if (!dateString) return 'Sin fecha'
  return new Date(dateString).toLocaleDateString('es-ES')
}
export function getFailedQuestions() { return [] }
export function getMostFailedQuestions() { return [] }
export function getFailedQuestionsStats() { return { totalFailed: 0, uniqueQuestions: 0, averageFailsPerQuestion: 0, lastFailedDate: null } }
export function clearFailedQuestions() { return true }
