# Roadmap — Activación de oposiciones vendibles (priorización 02/06/2026)

> Origen: tras el barrido que dejó **375+ oposiciones catalogada con `seguimiento_url`** (vigiladas por el cron) y la **verificación a fondo (workflows multi-agente)** de las 234 en estado activo, que volcó a BD convocatoria + plazas + `programa_url` + **1.089 hitos**. De ahí salen **141 vendibles**. Este doc prioriza cuáles **activar** (landing pública + temario), que es trabajo manual por oposición.

## Criterio de priorización
1. **Convocatoria abierta** (captar inscripción en curso).
2. **Examen en 1-6 meses** (margen para crear y vender temario; un examen a <1 mes da poco recorrido).
3. Ordenado por **volumen de plazas** (proxy de nº de candidatos).
4. **Prioridad a C2** (Auxiliar Administrativo): reaprovecha el test y la base de temario del producto estrella → más rápido y barato de montar. Bombero/Policía C2 son C2 pero de contenido distinto (psicotécnicos+físicas).
5. **Coste de creación: temario normativo vs editorial.** Priorizar oposiciones cuyo temario sale de leyes/decretos (generable en casa o ya en BD) frente a las que necesitan temario editorial redactado por un humano (técnicas, oficios, protocolos). Demanda dice *cuáles interesan*; este criterio dice *cuáles son baratas de montar*. Detalle en `docs/maintenance/crear-nueva-oposicion.md` §0.bis.

## Cola de activación recomendada (C2 Auxiliar Administrativo)

### Abierta ahora (crear ya)
- **Aux. Administrativo UNED** — 48-54 plz, cierra 25/06/2026. On-brand puro.
- **Aux. Administrativo Univ. de Cádiz** — 10 plz, cierra 10/06/2026.
- **Aux. Administrativo INGESA** (Ceuta/Melilla) — 9 plz, cierra 09/06/2026.

### Examen 1-6 meses (campaña otoño)
- **Aux. Administrativo SCS Canarias — 643 plz, examen ~septiembre 2026. ★★ PRIMERA A CREAR** (máximo volumen C2 + margen).
- **Aux. Administrativo SERGAS (Galicia)** — 84 plz, ~julio 2026.
- **Aux. Administrativo SCS Cantabria** — plazas por confirmar, ~septiembre 2026.
- **Aux. Administrativo Complutense** — 53 plz (fecha estimada, confirmar).
- **Aux. Administrativo Osakidetza — 708 plz**, examen 21/06/2026 (inminente → preparar ficha para PRÓXIMA convocatoria, no temario a contrarreloj).

### Alto volumen no-C2 (fases posteriores, requieren temario propio)
- Enfermero ICS Cataluña (1.713, A2, sept) · Administrativo País Vasco (350 C1, oct) · Bombero Comunidad de Madrid (131, sept) · Celador Murcia (106, grupo E, sept) · Mossos (1.587 C1).

## Orden de arranque (por ROI)
1. **Aux. Administrativo SCS Canarias** (643, otoño). ← EN CURSO
2. Aux. Administrativo UNED (abierta).
3. Aux. Administrativo SERGAS (84, julio).
4. Aux. Administrativo Univ. Cádiz + INGESA (abiertas, quick wins).

## Notas de calidad
- Varias fechas de examen de Prioridad 2 son **estimaciones** del agente (día 01 de mes o fecha = hoy): **confirmar en el boletín oficial** antes de lanzar campaña.
- Falso positivo descartado: Policía Local de Mijas (plazo cerró 25/02/2026).
- Datos completos de las 141 vendibles: en `oposiciones` (estado, plazas, convocatoria, `programa_url`) + `convocatoria_hitos` (timeline). Memoria: `project_catalogada_seguimiento_sweep`.

## Qué significa "activar" una oposición
Configurar topics (estructura de temario fiel al programa oficial de las bases) + `topic_scope` (leyes/artículos por tema) + preguntas vinculadas + `is_active=true` para landing pública. Los hitos ya están cargados. Regla: temario **fiel al epígrafe oficial** y con preguntas suficientes (~100/tema) antes de publicar — nunca famélico.
