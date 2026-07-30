// Partir el texto de un mensaje de soporte en texto y adjuntos.
//
// ## Por qué existe (30/07/2026)
//
// Los adjuntos de una conversación viajan DENTRO del mensaje como enlaces al bucket
// (`https://vence-uploads.s3.eu-west-2.amazonaws.com/feedback-images/…`). Pintados en crudo,
// al usuario le aparece una URL interna nuestra en mitad de su conversación: no le dice nada
// y enseña infraestructura que no tiene por qué ver.
//
// Se saca a función pura porque la primera versión vivía dentro del componente y traía el
// fallo clásico de JavaScript: un regex con la bandera `g` reutilizado con `.test()` conserva
// `lastIndex` entre llamadas, así que devuelve `true` y `false` alternos sobre los MISMOS
// datos. Resultado: una imagen se pintaba bien y la siguiente salía como URL. Un fallo así no
// se ve mirando el código, se ve con un test que pase dos adjuntos seguidos.

export type ParteMensaje =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'imagen'; url: string }

/** Con `g` SOLO para `split`, que sí lo necesita. */
const PARTIR = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s]*)?)/gi
/** Sin `g` para comprobar: así no arrastra estado entre llamadas. */
const ES_IMAGEN = /^https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s]*)?$/i

/**
 * Devuelve el mensaje troceado. Los enlaces a imágenes salen como `imagen` (para pintarlas) y
 * el resto como `texto`. Nunca devuelve una URL de imagen dentro de un trozo de texto.
 */
export function partirMensaje(texto: string | null | undefined): ParteMensaje[] {
  const t = String(texto ?? '')
  if (!t) return []
  return t
    .split(PARTIR)
    .filter((p) => p !== undefined && p !== '')
    .map((p) => (ES_IMAGEN.test(p.trim()) ? { tipo: 'imagen' as const, url: p.trim() } : { tipo: 'texto' as const, valor: p }))
}

/** ¿Queda alguna URL cruda a la vista? Útil para asegurarlo en los tests. */
export function tieneUrlVisible(partes: ParteMensaje[]): boolean {
  return partes.some((p) => p.tipo === 'texto' && /https?:\/\/\S+/.test(p.valor))
}
