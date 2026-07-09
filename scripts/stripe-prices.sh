# scripts/stripe-prices.sh — FUENTE DE VERDAD de los price IDs de Stripe.
#
# Se SOURCEA desde deploy-frontend.sh DESPUÉS de .env.local, sobreescribiendo
# cualquier valor de precios que traiga el .env.local per-worktree.
#
# POR QUÉ (incidente real 09/07, task def :386): el deploy leía los precios del
# .env.local, que es per-worktree y gitignored → una sesión paralela con un
# .env.local viejo desplegó IDs de precio antiguos y tumbó create-checkout
# (400 en 3 de 4 planes). Al vivir aquí (commiteado), TODOS los worktrees
# despliegan los MISMOS precios, sin depender de su .env.local local.
#
# CAMBIAR PRECIOS = actualizar estos IDs + crear los precios en Stripe (ambas
# cuentas si aplica) + EXPECTED de scripts/canary-planes-precios.cjs + los
# build-args hardcodeados de .github/workflows/frontend-deploy.yml.
#
# Precios v2 (2026-07): Mensual 29 · Trimestral 39 · Semestral 69 · Anual 99.
# Las altas nuevas van a la cuenta Nila (STRIPE_NEW_SIGNUPS_ACCOUNT=nila); los
# IDs base (sin sufijo) y _NILA apuntan a los mismos precios de Nila post-flip.

export NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_1TrNBi0lMFwxldqjhNOtibLf
export NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY=price_1TrNBi0lMFwxldqjX6Z6EAIl
export NEXT_PUBLIC_STRIPE_PRICE_SEMESTER=price_1TrNBi0lMFwxldqjWYAVd93S
export NEXT_PUBLIC_STRIPE_PRICE_ANNUAL=price_1TrNBj0lMFwxldqjyc7TGHMa

export NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA=price_1TrNBi0lMFwxldqjhNOtibLf
export NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA=price_1TrNBi0lMFwxldqjX6Z6EAIl
export NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA=price_1TrNBi0lMFwxldqjWYAVd93S
export NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_NILA=price_1TrNBj0lMFwxldqjyc7TGHMa
