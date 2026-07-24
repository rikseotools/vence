#!/usr/bin/env node
// scripts/canary-laws-configurator.cjs
// Canary: el configurador de "Test combinando leyes" (/api/laws-configurator) DEBE
// responder 200 con leyes y RÁPIDO para una oposición con MUCHO dato. Nació del bug
// David/Galicia (24/07): la query de stats (EXISTS correlado + array-ANY sobre todas
// las preguntas) tardaba 30s → statement timeout → 500 → el usuario veía "Error al
// generar test". El smoke de deploy (home/asset/auth) no lo cazaba porque no ejercía
// este endpoint con una oposición pesada. Este canary sí.
//
// Aserción: HTTP 200 + success:true + data.length>0 + latencia < LAWS_CONF_CANARY_MAX_MS
// (default 6000). Un 500/timeout o lista vacía = regresión (query lenta o rota).
//
// Uso: BASE_URL=https://www.vence.es node scripts/canary-laws-configurator.cjs
//      LAWS_CONF_CANARY_PT=auxiliar_administrativo_galicia LAWS_CONF_CANARY_MAX_MS=6000
// Exit 0 = verde; exit 1 = regresión.

const BASE_URL = (process.env.BASE_URL || 'https://www.vence.es').replace(/\/$/, '');
// Oposición pesada por defecto = la que sufrió el bug (Galicia). Overridable.
const PT = process.env.LAWS_CONF_CANARY_PT || 'auxiliar_administrativo_galicia';
const MAX_MS = Number(process.env.LAWS_CONF_CANARY_MAX_MS) || 6000;

(async () => {
  const url = `${BASE_URL}/api/laws-configurator?positionType=${encodeURIComponent(PT)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MAX_MS + 2000);
  const t0 = Date.now();
  let res, body;
  try {
    res = await fetch(url, { headers: { 'x-vence-canary': '1' }, signal: ctrl.signal });
    body = await res.json().catch(() => null);
  } catch (e) {
    console.error(`❌ canary laws-configurator: fetch falló (${e.name}) para ${PT}`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
  const ms = Date.now() - t0;
  const laws = body && Array.isArray(body.data) ? body.data.length : 0;

  const fails = [];
  if (res.status !== 200) fails.push(`HTTP ${res.status} (esperado 200)`);
  if (!body || body.success !== true) fails.push('success !== true');
  if (laws === 0) fails.push('0 leyes (esperado > 0 para una oposición pesada)');
  if (ms > MAX_MS) fails.push(`lento: ${ms}ms > ${MAX_MS}ms`);

  if (fails.length) {
    console.error(`❌ canary laws-configurator [${PT}] ${ms}ms — ${fails.join('; ')}`);
    process.exit(1);
  }
  console.log(`✅ canary laws-configurator [${PT}] ${ms}ms · ${laws} leyes`);
  process.exit(0);
})();
