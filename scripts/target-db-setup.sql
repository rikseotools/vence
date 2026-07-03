-- scripts/target-db-setup.sql
-- Setup de un Postgres gestionado (Neon / RDS / Crunchy) como destino de la migración
-- de Vence desde Supabase. Receta VERIFICADA en el dry-run 2 (2026-07-03): con esto +
-- el esquema post-C4 (RLS auth.uid() dropeadas), el restore da 0 errores reales.
-- Ver docs/roadmap/migracion-vercel-a-aws.md §3.1.
--
-- Orden: (1) este script en la BD destino vacía -> (2) restaurar el dump de esquema
-- post-C4 -> (3) migrar datos (CDC / pg_dump --data-only) -> (4) apuntar DATABASE_URL.

-- 1) Roles que las políticas/GRANTs del esquema referencian (Supabase los trae de serie).
DO $$ BEGIN CREATE ROLE anon;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Extensiones. OJO al SCHEMA (el dump las referencia schema-qualified):
--    - la mayoria en 'extensions' (layout Supabase)
--    - pg_trgm en 'public' -> el indice GIN usa public.gin_trgm_ops
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"        SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto           SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent           SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector             SCHEMA extensions;  -- pgvector: RDS/Neon lo soportan
CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA extensions;  -- lo usa v_insert_test_questions_latency
CREATE EXTENSION IF NOT EXISTS pg_trgm            SCHEMA public;      -- gin_trgm_ops debe resolver en public

-- NO instalar (no portables y ya sin uso en el esquema tras los drops del 03/07):
--   http, pg_net, supabase_vault  -> 0 funciones/vistas de la app los usan.

-- 3) Tras esto: restaurar el esquema post-C4 y luego los datos.
--    El emisor de tokens ya es Auth.js (RS256/JWKS), no depende de auth.users/GoTrue.
