#!/usr/bin/env bash
# Verificación de un RELEASE en el navegador — AGNÓSTICA DEL PROVEEDOR.
#
# Contrato: recibe por entorno la URL de lo recién publicado y la identidad de la cuenta de
# test, y corre los journeys de Vence Sim marcados `postDeploy: true`. NO sabe de AWS, de ECS
# ni de SSM: quien despliega resuelve sus secretos como quiera y llama a esto. Al mudarse a
# koigrid, su script de despliegue hace lo mismo y este fichero no se toca.
#
#   VERIFY_BASE_URL   URL a verificar (obligatoria; también vale SIM_BASE).
#   SIM_AUTH_SECRET   secreto para forjar la sesión de la cuenta de TEST (si falta, los
#                     journeys autenticados se SALTAN — no se inventa una identidad).
#   SMOKE_USER_ID     identidad de la cuenta de test (o SIM_IDENTITY_USER_ID).
#   SIM_EMIT=1        deja el resultado en observabilidad (`sim_journey_result`).
#   VERIFY_STRICT=1   hace que un journey rojo devuelva error (por defecto NO: informa).
#
# Por qué por defecto NO bloquea: un rojo aquí puede ser del entorno (contenedor frío, límite
# de peticiones) y no del código. Un guardarraíl que tumba despliegues por causas ajenas se
# acaba desactivando, y entonces no guarda nada. El resultado queda en observabilidad, que es
# donde se mira; subirlo a bloqueante es un cambio de una línea cuando demuestre ser estable.
set -uo pipefail

BASE="${VERIFY_BASE_URL:-${SIM_BASE:-}}"
if [ -z "$BASE" ]; then
  echo "   ⏭️  verificación de release SALTADA: falta VERIFY_BASE_URL"
  exit 0
fi

cd "$(dirname "$0")/.." || exit 0

# Sin navegador instalado no hay verificación posible, pero tampoco es un fallo del release:
# se dice y se sigue (en una máquina de despliegue limpia esto es lo normal).
if ! ls "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"/chromium-* >/dev/null 2>&1; then
  echo "   ⏭️  verificación de release SALTADA: no hay navegadores de Playwright"
  echo "      (instálalos con 'npx playwright install chromium' para activarla)"
  exit 0
fi

echo "→ verificación de release en navegador (Vence Sim) contra $BASE"
SIM_BASE="$BASE" npx tsx scripts/sim/run.ts --post-deploy
CODIGO=$?

if [ "$CODIGO" -ne 0 ]; then
  echo "   ⚠️  la verificación de release encontró algo — mira el reporte de arriba"
  if [ "${VERIFY_STRICT:-0}" = "1" ]; then
    exit "$CODIGO"
  fi
  echo "   (no bloquea el despliegue; VERIFY_STRICT=1 lo haría bloqueante)"
fi
exit 0
