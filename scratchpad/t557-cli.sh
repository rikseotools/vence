#!/usr/bin/env bash
cd /home/manuel/vence-sessions/movil3 || exit 1
set -a; . ./.env.local; set +a
export DATABASE_URL="$VENCE_LECTOR_URL"
node scripts/audit-explicacion-eco.cjs --json > scratchpad/t557-salida.json
node -e '
const r = require("/home/manuel/vence-sessions/movil3/scratchpad/t557-salida.json")
const lista = r.contaminadas || r.contaminado || r.items || []
console.log("base:", r.base, "· eco:", r.eco, "· contaminadas:", Array.isArray(lista) ? lista.length : r.contaminado)
const ids = (Array.isArray(lista) ? lista : []).map(x => String(x.question_id || x.id || "").slice(0,8))
console.log("ids:", ids.join(" "))
console.log(ids.includes("a1cfdaa9") ? "❌ a1cfdaa9 SIGUE en la cola" : "✅ a1cfdaa9 ya no aparece")
'
