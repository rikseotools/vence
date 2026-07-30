// backend/src/daily-limit/device-limit-mode.ts
//
// ESPEJO de `lib/security/deviceLimitMode.ts` (el backend compila con `rootDir: src` y no puede
// importar de la raíz). La paridad la fija `__tests__/guardrails/deviceLimitModeParity.test.ts`:
// si los dos lados discrepan, el mismo usuario se bloquearía o no según por qué camino entre su
// petición — y `answer-and-save` reparte tráfico entre ambos.
//
// Ver el original para el porqué del modo sombra. Resumen: el ancla nueva agrupa cuentas que antes
// no se agrupaban; antes de cortar a nadie se mide sobre tráfico real lo que habría pasado.

export type DeviceLimitMode = 'off' | 'shadow' | 'enforce';

export const DEVICE_LIMIT_MODE_DEFAULT: DeviceLimitMode = 'shadow';

export function resolveDeviceLimitMode(
  raw: string | undefined | null,
): DeviceLimitMode {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'off' || v === 'false' || v === '0') return 'off';
  if (v === 'enforce' || v === 'on' || v === 'true' || v === '1') return 'enforce';
  if (v === 'shadow') return 'shadow';
  return DEVICE_LIMIT_MODE_DEFAULT;
}

export function shouldEvaluate(mode: DeviceLimitMode): boolean {
  return mode !== 'off';
}

export function shouldBlock(mode: DeviceLimitMode): boolean {
  return mode === 'enforce';
}

export function currentDeviceLimitMode(): DeviceLimitMode {
  return resolveDeviceLimitMode(process.env.DEVICE_LIMIT_MODE);
}
