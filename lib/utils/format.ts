// lib/utils/format.ts — Funciones de formato compartidas para landings y otros componentes

/** Formatea número con separador de miles español: 1700 → "1.700" */
export function formatNumber(n: number | null): string {
  if (n == null) return '—'
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Formatea fecha ISO a español largo: "2025-12-22" → "22 de diciembre de 2025" */
export function formatDateLarga(dateStr: string | null): string {
  if (!dateStr) return ''
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} de ${meses[m - 1]} de ${y}`
}

/** Formatea fecha ISO a corto: "2025-12-22" → "22/12/2025" */
export function formatDateCorta(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
