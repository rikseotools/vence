#!/usr/bin/env bash
# T-190 — re-clonar los 4 documentos del BOE que están en BD con la extracción del /pdfs/
# (sin la ficha de ANÁLISIS, que es donde el BOE pone las plazas en cifra).
# Comandos verificados por w4-vence-flota y revisados con veredicto ok por w2-vence-flota.
set -e
cd /home/manuel/vence-sessions/movil3/backend || exit 1
set -a; . ../.env.local; set +a
export NODE_TLS_REJECT_UNAUTHORIZED=0

npx tsx scripts/clonar-documento.ts \
  --slug=auxiliar-administrativo-ayuntamiento-madrid \
  --url=https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-21734 \
  --tipo=convocatoria --titulo="Resolución de 4 de octubre de 2024, del Ayuntamiento de Madrid" \
  --boletin=BOE --ref=BOE-A-2024-21734 --fecha=2024-10-23 --refrescar-texto

npx tsx scripts/clonar-documento.ts \
  --slug=auxiliar-administrativo-ayuntamiento-cordoba \
  --url=https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-9772 \
  --tipo=convocatoria --titulo="Resolución de 27 de abril de 2026, del Ayuntamiento de Córdoba" \
  --boletin=BOE --ref=BOE-A-2026-9772 --fecha=2026-05-05 --refrescar-texto

npx tsx scripts/clonar-documento.ts \
  --slug=auxiliar-administrativo-diputacion-zaragoza \
  --url=https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-6897 \
  --tipo=otro --titulo="Resolución de 15 de marzo de 2026, de la Diputación Provincial de Zaragoza" \
  --boletin=BOE --ref=BOE-A-2026-6897 --fecha=2026-03-25 --refrescar-texto

npx tsx scripts/clonar-documento.ts \
  --slug=administrativo-diputacion-valencia \
  --url=https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-9387 \
  --tipo=otro --titulo="Resolución de 17 de abril de 2026, de la Diputación Provincial de Valencia" \
  --boletin=BOE --ref=BOE-A-2026-9387 --fecha=2026-04-30 --refrescar-texto
