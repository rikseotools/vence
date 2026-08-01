// lib/oposicionPersonalizada/nombrePublico.ts — «<nombre> by <Nombre I.>». (T-327)
//
// Vive en `lib/` y no dentro del componente porque lo necesitan LOS DOS LADOS: la pantalla que
// enseña cómo se va a publicar, y el servidor al fijar la oposición objetivo (que compone el
// nombre con el que aparecerá en la cabecera y en todos los selectores). Duplicarlo haría que un
// día se llamara distinto en cada sitio.

/**
 * Nombre público de una oposición personalizada.
 *
 * La autoría va EN EL NOMBRE por decisión de producto (01/08): sostiene la idea de temarios con
 * seguidores y, sobre todo, **le pone dueño a una etiqueta**. Medido el 30/07: los nombres
 * genéricos («Estudiante», «Renfe», «Administrativo») son justo los que concentran a la gente que
 * se apunta y no llega a hacer un test.
 *
 * Se usa el nombre de pila y las INICIALES del resto: ni el apellido completo ni el email, que
 * son datos personales innecesarios para lo que esto resuelve — y la página es pública.
 */
export function nombrePublico(
  nombreOposicion: string,
  autor: string | null | undefined,
): string {
  const base = String(nombreOposicion ?? '').trim()
  const partes = String(autor ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (partes.length === 0) return base
  const pila = partes[0]
  const iniciales = partes
    .slice(1)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join('')
  return iniciales ? `${base} by ${pila} ${iniciales}` : `${base} by ${pila}`
}
