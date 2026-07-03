-- 20260703_fase_b_orphan_cleanup.sql
-- FASE 1 (Fase B) · precondición del re-point de FKs auth.users -> user_profiles.
-- Deja en 0 los huérfanos (user-ref en auth.users pero NO en user_profiles).
--
-- 504 huérfanas = 218 de 8 cuentas auth-only (0 tests) + 286 de 2 tablas de archivo.
--   - 8 cuentas: BACKFILL no destructivo (id = auth.users.id) — decisión Manuel 03/07.
--   - 2 tablas *_pre_outbox: archivo congelado (sin escrituras desde 2026-05-29) → DELETE.
-- Verificado: 0 usuarios activos sin perfil (8/9285, 0 con login en 7d) → seguro.
BEGIN;

-- 1) Backfill de las 8 cuentas auth-only (id + email; resto de NOT NULL tienen default)
INSERT INTO public.user_profiles (id, email, created_at)
SELECT au.id, au.email, au.created_at
FROM auth.users au
WHERE au.id IN (
  '35ca8d80-cc5a-4829-a89e-d7496f4d9c26', -- mcasadocano@gmail.com
  'd5fceacb-2261-473f-aeba-5b864713fd79', -- ricardopf1987@gmail.com
  'a659cf4e-e8da-4499-8535-8f850157d253', -- riicar23@gmail.com
  '6fb8c018-f223-46ca-a74d-45f626a73831', -- saezirenej4@gmail.com
  'b96f1e3c-eca4-4e48-9160-1ac9f6ffabe2', -- dreamnetworkspain@gmail.com
  '9ac5cbfd-49e7-4702-b707-e4e9eaf3f515', -- blumesainversiones@gmail.com
  'faa6284c-408d-469e-9f7d-c0b4670aef63', -- eresprocom@gmail.com
  'd9de0f61-dae6-47b8-871f-4c7b22e5c2da'  -- faqmakemoney@gmail.com
)
AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- 2) DELETE de huérfanas en las 2 tablas de archivo (frozen; sin pérdida real)
DELETE FROM public.law_question_first_attempts_pre_outbox t
 WHERE t.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id);
DELETE FROM public.question_first_attempts_pre_outbox t
 WHERE t.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id);

COMMIT;
