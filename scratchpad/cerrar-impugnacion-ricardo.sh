#!/usr/bin/env bash
set -u
SP=/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad
export AUTH_SECRET="$(cat "$SP/authsecret.txt")"
npx tsx --env-file=.env.local scripts/impugnaciones/cerrar.ts \
  2e705c38-036e-47ea-b39b-f17ced2cf66a \
  --estado rejected \
  --mensaje "$SP/borrador-ricardo.md" \
  --sistemico "aislado: la clave es correcta y no hay defecto que propagar. Verificado el art. 117.1 CE literal (la justicia emana del pueblo, se administra en nombre del Rey) y las 12 preguntas activas del MISMO articulo: sus claves son coherentes entre si (a79563df 'de quien emana la justicia' -> del pueblo; b0c4932b 'se administra' -> por Jueces y Magistrados en nombre del Rey). El usuario marco C, que es una afirmacion verdadera del articulo, asi que fallo legitimamente." \
  --aplicar
