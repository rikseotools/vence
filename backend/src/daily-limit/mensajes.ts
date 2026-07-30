// backend/src/daily-limit/mensajes.ts
//
// ESPEJO de `lib/api/daily-limit/mensajes.ts` (el backend compila con `rootDir: src` y no puede
// importar de la raíz). La paridad la fija `__tests__/guardrails/limiteDiarioMensajeUnico.test.ts`.
//
// UN SOLO mensaje para el límite por cuenta y por dispositivo, a propósito: si se distinguen,
// basta con cambiar de cuenta y comparar los textos para deducir cómo contamos — y el siguiente
// paso es coger otro móvil. Ver el original para el razonamiento completo.

export const MSG_LIMITE_DIARIO =
  'Has alcanzado el límite diario de preguntas del plan gratuito. Vuelve mañana o pásate a Premium para practicar sin límite.';

export const MSG_LIMITE_GRADUADO =
  'Vence tiene mucha demanda actualmente. Actualiza a Premium para acceso prioritario.';
