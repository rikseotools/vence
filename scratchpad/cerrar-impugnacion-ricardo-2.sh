#!/usr/bin/env bash
set -u
SP=/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad
export AUTH_SECRET="$(cat "$SP/authsecret.txt")"
npx tsx --env-file=.env.local scripts/impugnaciones/cerrar.ts \
  ea163bd5-10d4-468c-947f-a7411aac8367 \
  --estado rejected \
  --mensaje "$SP/borrador-ricardo-2.md" \
  --sistemico "aislado: la clave es correcta, verificada contra el BOE (art. 117.5 dice 'estado de sitio'; la opcion decia 'estado de excepcion'). La opcion que el senala como falsa (potestad jurisdiccional = juzgar y hacer ejecutar lo juzgado) es parafrasis fiel del 117.3. No hay defecto que propagar. Lo que SI se arreglo, y es el patron a vigilar: la explicacion empezaba con 'La respuesta correcta es D)' -letra clavada, kind shuffle_narrativa_letra_clavada- asi que la pregunta no podia barajar; reescrita estructurada y ahora nace barajable. Igual que en su otra impugnacion (2e705c38), asi que en este par de preguntas del art. 117 el defecto de formato estaba en las dos." \
  --aplicar
