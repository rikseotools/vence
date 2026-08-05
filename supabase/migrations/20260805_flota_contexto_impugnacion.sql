-- T-578 — Que un trabajador de la flota sepa de qué oposición es quien impugna,
--         SIN abrirle `user_profiles` y SIN tocar nada de lo que ya está protegido.
--
-- POR QUÉ ESTA VISTA NUEVA Y NO LAS DOS SOLUCIONES "OBVIAS":
--
-- (a) Quitar `security_invoker` de `admin_disputes_dashboard` — DESCARTADO. Esa opción
--     estaba puesta A PROPÓSITO por `20260502_views_security_invoker.sql`, que cerró 16
--     issues «Security Definer View» del Advisor: una vista sin ella corre como su dueño
--     y bypassa el RLS de las tablas base. Hoy el vector concreto está cerrado por otra
--     vía (anon y authenticated ya no tienen SELECT sobre esa vista), pero quitarla
--     dejaría a la vista sin la segunda barrera y rompería la uniformidad de las 8 vistas
--     `admin_*`, que la tienen todas: una migración futura que las trate en bloque
--     revertiría el arreglo en silencio.
--
-- (b) `GRANT SELECT (columnas) ON user_profiles` — DESCARTADO. `user_profiles` tiene RLS
--     ACTIVO y CERO policies (medido), así que el GRANT por columna daría 0 filas sin
--     error: exactamente el fallo mudo de T-573. Habría que añadir además una policy a la
--     tabla con los datos más sensibles del sistema. Dos cambios donde caben cero.
--
-- LO QUE SÍ SE HACE: una vista propia de la flota que expone TRES datos y ninguno
-- identifica a nadie: el id de la impugnación, la oposición que prepara quien la escribió
-- y su tipo de plan. Sin nombre y sin email — un trabajador no escribe a personas (esa
-- puerta es `cerrar.ts`, que corre con credenciales de persona), así que no necesita saber
-- cómo se llama nadie. Es `security_invoker = off` DELIBERADO y acotado a estas columnas.
--
-- Coste real de no tenerlo (05/08/2026): un trabajador analizó una impugnación sin poder
-- leer `target_oposicion`, dedujo la oposición por los TAGS de la pregunta, se equivocó y
-- propuso un UPDATE de `topic_scope` en 4 oposiciones que habría servido preguntas fuera
-- de programa. Se paró al revisarlo a mano (T-582).

CREATE OR REPLACE VIEW public.flota_dispute_contexto
WITH (security_invoker = off) AS
 SELECT qd.id            AS dispute_id,
        up.target_oposicion AS reporter_oposicion,
        up.plan_type        AS reporter_plan
   FROM question_disputes qd
   LEFT JOIN user_profiles up ON up.id = qd.user_id;

COMMENT ON VIEW public.flota_dispute_contexto IS
  'T-578: contexto NO identificativo de quien impugna (oposición y plan), para que la flota no tenga que deducirlo de los tags. Nunca añadir aquí nombre, email ni teléfono: para hablar con la persona está scripts/impugnaciones/cerrar.ts, que exige credenciales de persona.';

GRANT SELECT ON public.flota_dispute_contexto TO vence_lector;
GRANT SELECT ON public.flota_dispute_contexto TO vence_coordinacion;
