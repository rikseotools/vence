#!/usr/bin/env bash
# comprobar-secretos-permitidos.sh — «no registres una task def cuyos secretos el rol no puede
# leer». (T-399, 31/07/2026)
#
# EL FALLO QUE EVITA, medido: el deploy cablea un secreto nuevo en la task def, pero el permiso
# vive en una política IAM que enumera los ARNs UNO A UNO. Añadir el secreto y conceder el permiso
# son dos actos separados y nada comprobaba que fueran juntos. Cuando no van, el deploy dice OK,
# registra la task def, y ECS arranca una tarea cada ~5 min que muere ANTES de encender el
# contenedor (`ResourceInitializationError … AccessDeniedException … ssm:GetParameters`).
# `describe-services` se queda en `PRIMARY / IN_PROGRESS` con 0 running y 0 pending, que parece
# «va lento» y es «no puede». El 31/07 costó de 17:47 a 23:30 con el lock de deploy retenido —o
# sea, ninguna sesión podía desplegar nada— y producción sin caerse, así que ninguna alarma sonó.
#
# Va en un helper compartido a propósito: las dos superficies cablean secretos y las dos tienen su
# propio rol de ejecución. Dos copias del mismo criterio acaban divergiendo, y entonces la buena
# no protege (lección del registro de herramientas: una sola puerta por recurso).
#
# FAIL-OPEN DELIBERADO: si no se puede leer el IAM (permisos, red, `jq` ausente), AVISA y deja
# seguir. Esta comprobación solo puede convertir «una hora de no-convergencia muda» en «un aborto
# claro en segundos»; nunca debe ser ella la que impida desplegar.
#
# Uso:  . "$(dirname "$0")/lib/comprobar-secretos-permitidos.sh"
#       comprobar_secretos_permitidos "$TDNEW" "$P" "$R"   # devuelve 1 si falta permiso

comprobar_secretos_permitidos() {
  local td_json="${1:-}" perfil="${2:-}" region="${3:-}"
  local raiz; raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  local nucleo="$raiz/lib/deploy/secretosPermitidos.cjs"

  [ -s "$td_json" ] || { echo "   ⏭️  secretos: no hay task def que mirar — sigo"; return 0; }
  [ -f "$nucleo" ]  || { echo "   ⏭️  secretos: falta $nucleo — sigo"; return 0; }
  command -v aws >/dev/null 2>&1 || { echo "   ⏭️  secretos: sin aws CLI — sigo"; return 0; }

  # OJO: `require()` de un fichero SIN extensión .json lo interpreta como JavaScript y revienta —
  # y `TDNEW` viene de `mktemp`, o sea sin extensión SIEMPRE. La primera versión hacía
  # `require($td_json)` dentro de un try/catch mudo, así que esta comprobación nacía INERTE y
  # además parecía sana ("la task def no declara executionRoleArn — sigo"). Lo cazó probarla
  # contra una task def real. Es el mismo «no puedo mirar» disfrazado de verde que este helper
  # existe para evitar: por eso ahora se lee con readFileSync y el error se DICE.
  local rol_arn rol
  rol_arn="$(TD="$td_json" node -e "
    const fs=require('fs');
    try { process.stdout.write(JSON.parse(fs.readFileSync(process.env.TD,'utf8')).executionRoleArn||'') }
    catch (e) { console.error(e.message) }
  " 2>/tmp/vence-secretos-err.$$)"
  if [ -z "$rol_arn" ]; then
    local err; err="$(cat /tmp/vence-secretos-err.$$ 2>/dev/null)"; rm -f /tmp/vence-secretos-err.$$
    if [ -n "$err" ]; then
      echo "   ⚠️  secretos: no pude leer la task def ($err) — sigo SIN comprobar"
    else
      echo "   ⏭️  secretos: la task def no declara executionRoleArn — sigo"
    fi
    return 0
  fi
  rm -f /tmp/vence-secretos-err.$$
  rol="${rol_arn##*/}"

  # Recursos permitidos = los de TODOS los statements que dejan ssm:GetParameters, mirando tanto
  # las políticas inline como las gestionadas. Si se mirara solo una parte, un permiso concedido
  # por la otra se leería como ausente y abortaríamos un deploy correcto — el error caro aquí es
  # el falso positivo, no el falso negativo.
  local recursos; recursos="$(
    {
      for pol in $(aws iam list-role-policies --role-name "$rol" --profile "$perfil" \
                     --query 'PolicyNames[]' --output text 2>/dev/null); do
        aws iam get-role-policy --role-name "$rol" --policy-name "$pol" --profile "$perfil" \
          --query 'PolicyDocument.Statement[?contains(to_string(Action), `ssm:GetParameters`) && Effect==`Allow`].Resource[]' \
          --output text 2>/dev/null
      done
      for arn in $(aws iam list-attached-role-policies --role-name "$rol" --profile "$perfil" \
                     --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null); do
        v="$(aws iam get-policy --policy-arn "$arn" --profile "$perfil" \
               --query 'Policy.DefaultVersionId' --output text 2>/dev/null)"
        [ -n "$v" ] && aws iam get-policy-version --policy-arn "$arn" --version-id "$v" --profile "$perfil" \
          --query 'PolicyVersion.Document.Statement[?contains(to_string(Action), `ssm:GetParameters`) && Effect==`Allow`].Resource[]' \
          --output text 2>/dev/null
      done
    } | tr '\t' '\n' | grep -v '^$'
  )"

  if [ -z "$recursos" ]; then
    echo "   ⚠️  secretos: no pude leer las políticas de $rol (¿permisos de IAM?) — sigo sin comprobar"
    return 0
  fi

  local faltan
  faltan="$(TD="$td_json" RECURSOS="$recursos" node -e "
    const fs=require('fs');
    const { arnsSinPermiso, secretosDeTaskDef } = require('$nucleo');
    const td = JSON.parse(fs.readFileSync(process.env.TD,'utf8'));
    const recursos = process.env.RECURSOS.split('\n').map(s=>s.trim()).filter(Boolean);
    process.stdout.write(arnsSinPermiso(secretosDeTaskDef(td), recursos).join('\n'));
  " 2>/dev/null)"

  if [ -n "$faltan" ]; then
    echo ""
    echo "   ❌ ABORTO: el rol de ejecución '$rol' NO puede leer estos secretos de la task def:"
    printf '        %s\n' $faltan
    echo "   ECS los pide ANTES de encender el contenedor, así que la tarea moriría en bucle y el"
    echo "   deployment se quedaría en IN_PROGRESS con 0 running (parece lento; es que no puede)."
    echo "   Arréglalo añadiendo esos ARNs a la política del rol y vuelve a lanzar. Ver T-399."
    return 1
  fi
  echo "   ✅ secretos: los $(printf '%s\n' "$recursos" | grep -c .) recurso(s) permitidos cubren la task def"
  return 0
}
