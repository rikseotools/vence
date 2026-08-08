#!/usr/bin/env bash
# Cierra las tareas revisadas en verde cuyo trabajo ya está en main.
set -u
cerrar() {
  local id="$1"; shift
  local outcome="$1"
  echo "── $id"
  node --env-file=.env.local scripts/backlog.cjs done "$id" --outcome "$outcome" 2>&1 | grep -E "✅|❌|⚠️|aborta" | head -3
}

YA="revisada en verde por otro trabajador de la flota (diff leído y afirmaciones comprobadas una a una). Al traerla a main el cherry-pick sale VACIO: su contenido ya estaba en la rama principal por otra via, comprobado commit a commit. No habia nada que mergear, solo cerrarla."

cerrar T-214 "$YA"
cerrar T-298 "$YA"
cerrar T-161 "$YA"
cerrar T-163 "$YA"
cerrar T-206 "$YA"
cerrar T-208 "$YA"
cerrar T-223 "$YA"
cerrar T-232 "$YA"
cerrar T-315 "$YA"
cerrar T-237 "revisada en verde por w2-vence-flota. La UNICA de las nueve que necesitaba merge real: su commit 37ebb9ac9 se trajo a main (ahora a205990f9) resolviendo un choque en scripts/canary-rol-lector.cjs, donde T-237 y T-108 habian llegado por separado a pedir la misma tabla (oep_detection_signals) para el rol lector. Se declara UNA vez, conservando la traza de las dos: dos entradas de la misma tabla no dan mas permiso, solo hacen creer que son controles distintos. Sintaxis del canario verificada."
