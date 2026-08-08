#!/usr/bin/env bash
set -u
SP=/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad
export AUTH_SECRET="$(cat "$SP/authsecret.txt")"
npx tsx --env-file=.env.local scripts/impugnaciones/cerrar.ts \
  99ec0b16-3ca7-4eb9-97c4-32bcf6233a5f \
  --estado resolved \
  --mensaje "$SP/borrador-laura-impugnacion.md" \
  --sistemico "medido: ampliado el detector visual_deixis_no_image a la deixis NUMERADA (figura 1 / Figura 2), que no veia porque solo buscaba 'el siguiente <visual>' -> 2 casos irresolubles en todo el banco activo, los dos jubilados (admin_image_unavailable). Ficha T-691, con los 2 falsos positivos descartados en los tests." \
  --aplicar
