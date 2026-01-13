import PsicotecnicosClient from './PsicotecnicosClient'

export const metadata = {
  title: 'Examen psicotécnico',
  description: 'Realiza todos los exámenes psicotécnicos que quieras, con este test online clasificados por temas',
  keywords: 'test psicotécnico, examen psicotécnico, pruebas psicotécnicas, aptitudes, razonamiento, cálculo numérico',
  openGraph: {
    title: 'Examen psicotécnico - Tests Online Gratuitos',
    description: 'Realiza todos los exámenes psicotécnicos que quieras, con este test online clasificados por temas',
    url: 'https://www.vence.es/psicotecnicos',
    type: 'website'
  }
}

const psychometricTopics = [
  { id: 'series-numericas', name: 'Series numéricas', description: 'Secuencias lógicas de números' },
  { id: 'series-letras', name: 'Series de letras', description: 'Patrones alfabéticos y secuencias' },
  { id: 'series-combinadas', name: 'Series combinadas de números y letras', description: 'Combinaciones alfanuméricas' },
  { id: 'sinonimos', name: 'Sinónimos', description: 'Palabras con significado similar' },
  { id: 'antonimos', name: 'Antónimos', description: 'Palabras con significado opuesto' },
  { id: 'analogias', name: 'Analogías', description: 'Relaciones lógicas entre conceptos' },
  { id: 'ortografia', name: 'Ortografía', description: 'Corrección de escritura y gramática' },
  { id: 'palabra-diferente', name: 'Palabra diferente', description: 'Identificación de elementos distintos' },
  { id: 'calculo-numerico', name: 'Cálculo numérico', description: 'Operaciones matemáticas básicas' },
  { id: 'razonamiento', name: 'Razonamiento', description: 'Lógica y deducción' },
  { id: 'actividad-administrativa', name: 'Actividad administrativa', description: 'Aptitudes para tareas administrativas' },
  { id: 'fichas-domino', name: 'Fichas de dominó', description: 'Patrones y secuencias visuales' },
  { id: 'figuras', name: 'Figuras', description: 'Razonamiento espacial y visual' }
]

export default function PsicotecnicosLanding() {
  return <PsicotecnicosClient psychometricTopics={psychometricTopics} />
}