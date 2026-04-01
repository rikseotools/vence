'use client'

/**
 * OptionContent — Renderiza el contenido de una opción de respuesta.
 *
 * Si el valor es una URL de imagen de nuestro bucket (question-images),
 * renderiza un <img>. En cualquier otro caso, renderiza texto tal cual.
 */

interface OptionContentProps {
  value: string
}

function isOptionImageUrl(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.startsWith('https://') &&
    value.includes('question-images')
  )
}

export default function OptionContent({ value }: OptionContentProps) {
  if (isOptionImageUrl(value)) {
    return (
      <img
        src={value}
        alt=""
        className="max-h-12 inline-block"
        loading="lazy"
      />
    )
  }
  return <>{value}</>
}
