// lib/chat/shared/formatting.ts
// Funciones de post-procesado de respuestas LLM antes de devolverlas al cliente.

/**
 * Elimina notación LaTeX de un texto sustituyéndola por equivalentes en markdown
 * plano o caracteres Unicode. El chat UI de Vence NO renderiza LaTeX (KaTeX/MathJax),
 * así que cualquier `\frac{}{}`, `\[ \]`, `\left(`, etc. se mostraría literal al usuario.
 *
 * Defensa adicional al system prompt: aunque las instrucciones piden no usar LaTeX,
 * los LLMs (especialmente gpt-4o en problemas matemáticos) lo usan a veces. Esta función
 * garantiza que el usuario nunca vea código LaTeX literal.
 *
 * Verificado con 48 casos en tests/test_chat_fixes (incluyendo el caso real del
 * chat 2563beb1 que motivó esta función).
 *
 * Idempotente: stripLatex(stripLatex(x)) === stripLatex(x).
 */
export function stripLatex(text: string | null | undefined): string | null | undefined {
  if (!text) return text
  let out = text

  // 1. Fracciones: \frac{a}{b} → (a) / (b)
  // Soporta un nivel de llaves anidadas (suficiente para casos del LLM en chat).
  out = out.replace(
    /\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
    '($1) / ($2)'
  )

  // 2. Delimitadores display/inline: \[ ... \] y \( ... \) → conservar contenido
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, '$1')
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, '$1')

  // 3. \left( \right) y similares — quitar prefijos
  out = out.replace(/\\left\s*([(\[\{])/g, '$1')
  out = out.replace(/\\right\s*([)\]\}])/g, '$1')

  // 4. Envolventes tipográficos: \text{X}, \mathbf{X}, \mathrm{X}, \boldsymbol{X}, \operatorname{X} → X
  out = out.replace(/\\(text|mathbf|mathrm|boldsymbol|operatorname)\{([^{}]*)\}/g, '$2')

  // 5. Operadores comunes → Unicode
  out = out.replace(/\\times\b/g, '×')
  out = out.replace(/\\cdot\b/g, '·')
  out = out.replace(/\\div\b/g, '÷')
  out = out.replace(/\\pm\b/g, '±')
  out = out.replace(/\\approx\b/g, '≈')
  out = out.replace(/\\neq\b/g, '≠')
  out = out.replace(/\\leq\b/g, '≤')
  out = out.replace(/\\geq\b/g, '≥')
  out = out.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
  out = out.replace(/\\sqrt\b/g, '√')

  // 6. Símbolos griegos minúsculos comunes
  const greek: Record<string, string> = {
    '\\\\alpha\\b': 'α', '\\\\beta\\b': 'β', '\\\\gamma\\b': 'γ', '\\\\delta\\b': 'δ',
    '\\\\theta\\b': 'θ', '\\\\lambda\\b': 'λ', '\\\\mu\\b': 'μ', '\\\\pi\\b': 'π',
    '\\\\sigma\\b': 'σ', '\\\\omega\\b': 'ω',
  }
  for (const [pattern, replacement] of Object.entries(greek)) {
    out = out.replace(new RegExp(pattern, 'g'), replacement)
  }

  // 7. Limpiar dobles espacios resultantes
  out = out.replace(/[ \t]{2,}/g, ' ')

  return out
}
