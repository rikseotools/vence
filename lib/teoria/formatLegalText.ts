// lib/teoria/formatLegalText.ts
//
// Normaliza el CONTENIDO de artículos legales para renderizarlo legible.
//
// PROBLEMA: mucho contenido se importó como texto plano extraído de PDF, con
// saltos de línea MECÁNICOS (a mitad de frase, donde el PDF cortaba la línea) y
// SIN estructura semántica. Al renderizarlo como Markdown, los saltos sueltos se
// colapsan en espacios → todo el articulado a) b) c)… se funde en un único bloque
// ("apelotonado", bug reportado 10/07). Y los apartados 1. 2. 3. no se separan.
//
// SOLUCIÓN (solo display, sin tocar datos): reconstruir la estructura por líneas:
//   - Enumeradores (a) b) …, 1. 2. …, 1.º) → SIEMPRE inician bloque nuevo.
//   - Salto MECÁNICO (la línea previa no cierra frase y la siguiente continúa en
//     minúscula) → se une con espacio (deshace el wrap del PDF).
//   - Cualquier otro salto (frase nueva, línea corta tipo tabla/código A1, E038…)
//     → se mantiene como separación. Así NO destroza tablas ni listas ya buenas
//     ni el Markdown existente (`- **Título**`, `| col |`).
//
// Es idempotente sobre contenido ya formateado y no lanza nunca.

/** Un enumerador de lista legal al principio de línea: a) / 12. / 1.º) … */
function startsWithEnumerator(line: string): boolean {
  return /^([a-zñ]\)|\d{1,3}\.(\s|$)|\d{1,3}\.[ºªo]\))/.test(line)
}

/** ¿La línea empieza en minúscula/continuación (no una frase/código nuevo)? */
function isLowercaseContinuation(line: string): boolean {
  return /^[a-záéíóúüñ¿¡"(«0-9]/.test(line) && !/^[A-ZÁÉÍÓÚÜÑ]/.test(line)
}

export function formatLegalText(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return ''

  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim())

  const blocks: string[] = []
  let current = ''
  const flush = () => {
    if (current) {
      blocks.push(current)
      current = ''
    }
  }

  const lastLineOf = (s: string) => s.slice(s.lastIndexOf('\n') + 1)
  const isTableRow = (l: string) => /^\|.*\|\s*$/.test(l)

  for (const line of lines) {
    if (line === '') {
      flush()
      continue
    }
    if (!current) {
      current = line
      continue
    }
    // Tablas Markdown: mantener las filas `| … |` contiguas (salto SIMPLE) para que
    // remark-gfm las renderice como tabla; nunca partirlas con doble salto. Esto deja
    // pasar intactas las tablas ya reconstruidas por datos (runbook tablas-articulos).
    const currentIsTable = isTableRow(lastLineOf(current))
    if (isTableRow(line)) {
      if (currentIsTable) current += '\n' + line
      else {
        flush()
        current = line
      }
      continue
    }
    if (currentIsTable) {
      // fin de la tabla → la siguiente línea abre bloque nuevo
      flush()
      current = line
      continue
    }
    if (startsWithEnumerator(line)) {
      flush()
      current = line
      continue
    }
    const prevClosesSentence = /[.:;»)?!]$/.test(current)
    if (!prevClosesSentence && isLowercaseContinuation(line)) {
      // salto mecánico del PDF → unir a la frase en curso
      current += ' ' + line
    } else {
      // frase nueva / línea corta tipo tabla → separar
      flush()
      current = line
    }
  }
  flush()

  return blocks.join('\n\n')
}
