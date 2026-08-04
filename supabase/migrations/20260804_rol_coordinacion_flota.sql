-- T-539 — Un rol de BD que SOLO sirve para coordinarse, para los trabajadores de la flota.
--
-- ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
-- Para que un trabajador autónomo participe del reparto necesita hablar con la BD: reclamar una
-- tarea, latir para ser visible, preguntar y dejar rastro de fricción. Y hasta hoy la única forma
-- de dárselo era copiarle el `.env.local`, es decir, la credencial de la APLICACIÓN.
--
-- Eso es lo que había que evitar, y no por prudencia abstracta: esa credencial abre `user_profiles`,
-- `questions`, `test_sessions` y todo lo demás. N trabajadores = N copias de un secreto de negocio
-- en máquinas que no lo necesitan, sin forma de rotarlas ni de saber cuál se usó.
--
-- ── EL ALCANCE ESTÁ MEDIDO, NO ESTIMADO (04/08/2026) ────────────────────────────────────────
-- Se recorrieron los escritores reales del andamiaje (`backlog.cjs`, `latir.cjs`, los tres
-- push-guards, `check-indice-compartido.cjs`, `friccion-emitir.cjs`) y tocan **cuatro tablas y
-- ninguna de negocio**. Con esto, un trabajador NO PUEDE leer los datos de un usuario ni tocar
-- cobros aunque su código se lo pidiera: es una propiedad del permiso, no una promesa de conducta.
--
-- ── DOS DECISIONES QUE PARECEN DETALLE Y NO LO SON ──────────────────────────────────────────
--
--  1. **`observable_events` solo INSERT.** El andamiaje escribe fricción y veredictos de preflight
--     ahí, y NUNCA lee esa tabla. Tiene 307.224 filas con `user_id` en 7 días, así que un SELECT
--     de conveniencia regalaría datos de usuarios sin ninguna razón. Se comprueba en el canario.
--
--  2. **Ningún DELETE, en ninguna tabla.** Un trabajador no borra tareas, ni sesiones, ni eventos.
--     Lo que hace mal se puede ver y deshacer; lo que borra, no.
--
-- ── LA CONTRASEÑA NO ESTÁ AQUÍ, A PROPÓSITO ─────────────────────────────────────────────────
-- El rol se crea CON `LOGIN` pero SIN contraseña, así que **no puede conectarse todavía**: con
-- `scram-sha-256` un rol sin contraseña no autentica. La contraseña se pone aparte, con el valor
-- que vive en SSM Parameter Store (el mismo patrón que los demás secretos de runtime del
-- proyecto). Un secreto en un fichero versionado no es un secreto.
--
-- Procedimiento completo (crear el parámetro, fijar la contraseña, verificar):
--   docs/runbooks/sistema-sesiones-paralelas.md §6.quater
--
-- Idempotente: se puede volver a aplicar sin efecto.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vence_coordinacion') THEN
    -- NOINHERIT: no arrastra privilegios de ningún rol que se le conceda por error más adelante.
    -- Sin CREATEDB/CREATEROLE/SUPERUSER, que son los tres caminos para salirse de este alcance.
    -- CONNECTION LIMIT acotado: una flota que se desmande no puede agotar las conexiones de la app.
    CREATE ROLE vence_coordinacion
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
      CONNECTION LIMIT 10;
  END IF;
END $$;

COMMENT ON ROLE vence_coordinacion IS
  'T-539 — trabajadores de la flota. SOLO tablas de coordinación: nada de negocio, nada de pagos, ningún DELETE. Contraseña en SSM, nunca en el repo.';

-- Sin esto no ve ni el esquema, aunque tenga permisos sobre las tablas.
GRANT USAGE ON SCHEMA public TO vence_coordinacion;

-- ── LAS CUATRO TABLAS, UNA A UNA Y CON SU MOTIVO ────────────────────────────────────────────

-- Reclamar tareas, renovar el lease, cerrarlas, reservar ids nuevos.
GRANT SELECT, INSERT, UPDATE ON public.backlog_tasks TO vence_coordinacion;

-- Latir: sin esto la sesión es INVISIBLE para las demás (y ellas para ella).
GRANT SELECT, INSERT, UPDATE ON public.worktree_sessions TO vence_coordinacion;

-- El embudo de preguntas a Manuel (T-493): preguntar y marcar como vistas.
GRANT SELECT, INSERT, UPDATE ON public.session_questions TO vence_coordinacion;
-- Su id sale de una secuencia; sin USAGE, el INSERT falla con un error que no dice por qué.
GRANT USAGE, SELECT ON SEQUENCE public.session_questions_id_seq TO vence_coordinacion;

-- Fricción y veredictos de preflight. SOLO INSERT: ver decisión (1) arriba.
GRANT INSERT ON public.observable_events TO vence_coordinacion;

-- ── LO QUE NO SE CONCEDE, DICHO EN VOZ ALTA ─────────────────────────────────────────────────
-- No hay GRANT sobre ninguna otra tabla, y el rol nace sin nada: medido el 04/08, `PUBLIC` no
-- tiene privilegios sobre NINGUNA tabla de este esquema (0 filas en `role_table_grants`).
--
-- Ese supuesto se AFIRMA, no se fuerza. La tentación era `REVOKE ALL ... FROM PUBLIC`, y sería
-- una línea peligrosa dejada en una migración que alguien puede reaplicar dentro de un año contra
-- una base distinta: hoy no haría nada, y el día que PUBLIC tenga un grant legítimo lo quitaría
-- en silencio. Si el supuesto deja de ser cierto, esto FALLA y obliga a mirarlo.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE grantee = 'PUBLIC' AND table_schema = 'public';
  IF n > 0 THEN
    RAISE EXCEPTION 'PUBLIC tiene % privilegio(s) sobre tablas de public: revísalos antes de dar por acotado el alcance de vence_coordinacion (T-539)', n;
  END IF;
END $$;

-- El canario `npm run canary:rol-coordinacion` comprueba las dos mitades: que SÍ puede coordinarse
-- y que NO puede leer negocio. Un permiso que nadie ejercita no se sabe si está bien puesto.
