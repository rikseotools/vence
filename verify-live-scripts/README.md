# verify-live-scripts

Scripts durables de la investigación "¿se puede automatizar el triaje/verificación de preguntas?"
(manual `docs/maintenance/verificacion-modelos-gratis-openrouter.md`).

- `prefilter_val.cjs` — Pilot 7 (§9.4, 15/07): valida un pre-filtro DETERMINISTA por solape de
  palabras (código, sin LLM) contra verdad-terreno (las 53 del piloto Orden INT/859/2023).
  Resultado: FALLA (67% de las "aparentemente bien" eran descartables). El solape no capta el hecho.
  Uso: `node verify-live-scripts/prefilter_val.cjs` (lee el scratchpad del piloto; adaptar rutas).

NOTA: otros scripts citados por el manual (bakeoff_*, ensemble_analysis, optlit/, pilots/) los
generó otra sesión y quedaron en su scratchpad (sin commitear). Recuperables re-ejecutando su método.
