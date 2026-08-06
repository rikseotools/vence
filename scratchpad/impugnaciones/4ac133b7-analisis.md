# Impugnación 4ac133b7 — análisis

## Datos
- question_id: c2641428-6b08-448f-ab79-f27d6a56d157
- user_id: 2eebe749-de92-47e7-afcf-61d2d89d14e6 (target_oposicion no accesible con credencial de flota — PII bloqueada a propósito)
- dispute_type: otro | descripción literal: "Este artículo no entra en el Temario"
- Pregunta: art. 112 CE — cuestión de confianza. Clave C (Presidente del Gobierno, previa deliberación
  del Consejo de Ministros). Recall check 100%, formato §5.1 OK.
- Cluster del mismo usuario (mismo día, misma queja): 066a3d65 (art 108 CE), ea65996b (art 110 CE),
  21be6a56 (art 114 CE, pregunta de moción de censura). Las 4 son la MISMA queja: "no entra en el Temario".

## Identificación de la oposición (target_oposicion bloqueado por PII → inferido por evidencia)
- `user_theme_stats`: única fila — `auxiliar_administrativo_diputacion_cordoba` T3, 2/2, 2026-07-08.
- `user_article_stats` (CE, arts 97-127, hoy 2026-08-05): TODO el rango 97-127 aparece con `tema_number=2`
  en una tanda de las 11:30, incluidos 108,109,110,111,112,113,114,115 — coherente y completo.
  Después, en una segunda tanda a las 17:40 (los últimos ~10s de otra sesión), exactamente
  {108,110,111,112,115} reaparecen con `tema_number=NULL` (0 aciertos). 114 no se repite ahí.
  → Esto es justo el fenómeno de las 4 impugnaciones: al re-encontrar esas preguntas (probablemente
  vía repaso de fallos u otro flujo sin contexto de tema), el guardado no resolvió tema_number → NULL.
  Posible causa de la QUEJA del usuario: si en esa segunda vuelta la UI no mostraba "Tema 2" (por el
  NULL), pudo parecerle que la pregunta "no entra en el Temario". Haría falta mirar el flujo de guardado
  para confirmarlo con certeza, pero NO es asunto de esta impugnación (no toca scope).
- `topic_scope` para `auxiliar_administrativo_diputacion_cordoba` T2 "Las Cortes Generales, el Gobierno,
  el Poder Judicial y las leyes": arts CE 66–127 COMPLETOS, sin huecos, sin `sobre_inclusion`. El
  epígrafe oficial es amplio ("el Gobierno... Relaciones entre el Gobierno y las Cortes Generales")
  y no excluye ningún artículo del bloque 97-116 (Título IV+V CE: Gobierno + relaciones Gobierno-Cortes).
  → Art. 112 (cuestión de confianza, Título V) encaja de lleno en ese epígrafe.

## Gate obligatorio (regla 04/08 del manual)
`npm run epigrafe:revision -- auxiliar_administrativo_diputacion_cordoba --pregunta <question_id>`
bloqueó: el Paso 2 de T2 estaba sellado `verified_correct` pero por `multi_agent` con `run='--run'`
(fuera del pipeline de 2 agentes que exige el runbook) → no respalda nada.
Lanzado `verify:scope dump` + skill `verify-scope-oposicion` (2 agentes + juez) SOLO sobre T2
(recortado del dump completo para no gastar de más) → pendiente de resultado.

## Diagnóstico preliminar (a falta del veredicto del pipeline)
El artículo 112 CE SÍ pertenece al Tema 2 de esta oposición, con evidencia estructural clara
(scope 66-127 sin huecos + epígrafe amplio "el Gobierno... relaciones Gobierno-Cortes"). La queja del
usuario, si de verdad estudia esta oposición, es un FALSO POSITIVO. Falta el veredicto del pipeline
para poder cerrar (documentación robusta antes de rechazar).

## Sistémico
Las 4 disputas del cluster son la MISMA queja sobre el MISMO tema (T2, arts 108/110/112/114) —
un solo hallazgo, no cuatro independientes. Si T2 se confirma correcto, las 4 son rechazables por el
mismo motivo (no hay "primera que cobra": el tipo `otro` no es recompensable, ver dossier —
"Recompensa: no aplica — usuario sin plan").
