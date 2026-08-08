#!/usr/bin/env bash
# Cierre SILENCIOSO del agradecimiento c5676023 (Manuel Martín): no se le escribe.
cd /home/manuel/vence-sessions/movil3 || exit 1
AUTH_SECRET="$(aws --profile vence --region eu-west-2 ssm get-parameter \
  --name /vence-frontend/AUTH_SECRET --with-decryption --query Parameter.Value --output text)" \
  npx tsx --env-file=.env.local scripts/impugnaciones/cerrar-feedback.ts \
    c5676023-f11b-4aec-8131-329548af1722 --silencioso --aplicar
