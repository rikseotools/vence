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

### Personal laboral Junta de Extremadura — Grupo V (PENDIENTE crear, de feedback de usuario 09-10/06/2026)
> Origen: feedback de usuario (Jesús, `d2561ead`) pidiendo "cocinero, ordenanza y camarero limpiador" de Extremadura. Investigado: convocatorias VIVAS (OPE 2025 Extremadura, 2.356 plz; DOE 244 de 19/12/2025; solicitudes 12/01–06/02/2026 → exámenes pendientes en 2026).
- **Ordenanza (Grupo V) — 39 plz turno libre** (DOE nº244, Orden 17/12/2025; el "119-130" anterior era erróneo). Test 37 preg/70 min. **REEVALUADO 10/06/2026 (FASE 1):** el temario NO es mayormente reutilizable como se creía — son **13 temas: solo 5 generales reutilizables** (CE I y II, Estatuto Extremadura, PRL, Igualdad/Violencia Ext) y **8 específicos EDITORIALES de oficio** (funciones del ordenanza, máquinas de oficina, atención/información al público, comunicación telefónica, gestión documental/postal, emergencias). → **medio-coste (editorial), NO quick-win.** Además **fecha de examen NO publicada aún** → no se puede confirmar "examen próximo". **Esperar a que el DOE publique la fecha** antes de invertir el trabajo editorial; con 39 plz + examen incierto + 62% editorial, no es prioritaria.
- **Camarero/a-Limpiador/a (Grupo V) — 39 plz.** Test 37 preguntas/70 min. Mismo perfil que Ordenanza: parte general reutilizable + específica editorial. Mismo veredicto (esperar fecha).
- **Cocinero / Ayudante de cocina (Grupo IV/V) — nicho.** Contenido especializado (cocina) → editorial; dejar para el final.
- **Acción:** **esperar a que el DOE publique la fecha de examen** del Grupo V; si sale con margen (1-6 meses), reevaluar ROI (39 plz × test) vs el coste editorial de los 8 temas de oficio.

### Administrativo (C1) Diputación de Valencia (PENDIENTE crear, de feedback de usuario 10/06/2026)
> Origen: feedback (María José, `1eac3652`, premium) pidiendo "Temario administrativo Diputación de Valencia, convocatoria 03/26". Investigado: convocatoria VIVA — **66 plazas** (acumuladas 2023-26, 10 reserva discapacidad), bases BOP Valencia nº72 17/04/2026 + BOE 105 30/04/2026, solicitudes 04-15/05/2026 (cerradas) → **examen pendiente, estudio AHORA**. Formato **test** (1ª parte 75+10 preguntas + 2ª parte 5 casos prácticos × 5 preguntas) → encaja con Vence.
- **C1 Administrativo** (no C2). Ya tenemos `auxiliar-administrativo-diputacion-valencia` (C2) inactiva y Administrativo GVA activa → mucha **parte general reutilizable**. Vendible (66 plz, test). Confirmar fecha de examen en BOP antes de campaña.

### TCAE / Auxiliar de Enfermería de DIPUTACIONES andaluzas (PENDIENTE crear, de feedback de usuaria 02/08/2026)
> Origen: feedback de Mari Carmen Verdejo (`58299f8c`, premium, TCAE SERGAS, vive en Dos Hermanas): *"hay muchísimas convocatorias de diputaciones pero no hay tcae de diputaciones, por ejemplo Sevilla, Cádiz o Granada… desde que salió la ley de los interinos están pegando fuerte todas"*. Es la **categoría sanitaria** del mismo nicho de diputación que ya vendemos en administración: tenemos 17 diputaciones activas, todas de perfil administrativo, y **una sola** de cuidados (`cuidador-diputacion-cordoba`, que ella empezó a usar el mismo día).
- **Cádiz — Auxiliar de Enfermería Geriatría, 31 plz** (C2, **oposición libre**, acumulación OEP 2023+2024+2025). Bases en BOP Cádiz nº28 de 11/02/2026 y nº72 de 17/04/2026. ★ la más vendible de las tres por volumen y por ser oposición pura (test). ⚠️ Confirmar el estado exacto del proceso en la sede de Dipucádiz antes de campaña (la ficha que sale primero en buscadores es el proceso ANTERIOR, OEP 2020, finalizado en 2024).
- **Sevilla — Auxiliar de Clínica, 12 plz** (escala Admón. Especial, turno libre). **Verificado en fuente oficial:** BOE-A-2026-3554, Resolución de 9/02/2026 de la Diputación Provincial de Sevilla; plazo de 10 días hábiles desde el 16/02/2026 → **cerrado, examen pendiente = estudio AHORA**. Ojo al nombre: la diputación NO la llama "TCAE" sino **"Auxiliar de Clínica"** (buscar por TCAE en el BOE no la encuentra).
- **Granada — DESCARTADA (verificada el 02/08, [T-490]).** Comprobado contra la API de su propio portal (`apigw.convoca.online`, 214 procesos), no contra buscadores: la de «14 plazas» que enseñan los portales es de **BOP 306 de 2021**; lo vivo de 2026 son **142 plazas de Cuidador/a Técnico/a de Personas Dependientes de PROMOCIÓN INTERNA** (`free:0`, cerrada al público) y un turno libre de esa misma categoría con **5 plazas** y plazo cerrado en octubre de 2025. Volver a mirar cuando se reponga la plantilla de auxiliares de enfermería (111 estabilizadas en 2022).
- **⚠️ BUSCAR POR «TCAE» ES CIEGO en administración local:** Sevilla la llama **Auxiliar de Clínica**, Cádiz **Auxiliar de Enfermería Geriatría** y Granada **Cuidador/a Técnico/a de Personas Dependientes**. Ninguna usa «TCAE», y por eso este hueco de catálogo llevaba años sin verse. Barrer por las cuatro variantes.
- **Ángulo de reutilización:** parte general de administración local **ya montada** en las 17 diputaciones activas (CE, Ley 39/2015, régimen local, igualdad, PRL), y parte de cuidados en `cuidador-diputacion-cordoba` + `tcae-sas`. El coste real es el temario específico de cada bases, no la base común.
- **Acción:** verificar bases y calendario de Cádiz y Sevilla contra BOP/sede; si Cádiz sigue vivo, es candidata de arranque (31 plz, C2, test, Andalucía, con demanda declarada por una usuaria premium de la zona).

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
