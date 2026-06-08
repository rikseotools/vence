-- 20260608_video_courses_law_id.sql
-- Vínculo explícito vídeo-curso ↔ ley (fuente única de verdad).
--
-- PROBLEMA QUE RESUELVE (caso María José / Valencia, 08/06/2026):
--   El banner de vídeo-curso en el temario se decidía con un mapping
--   `topicVideoCourses` HARDCODEADO y DUPLICADO en cada uno de los ~26
--   TopicContentView.tsx (uno por oposición). Frágil por diseño:
--     - Valencia se quedó SIN cursos (nadie portó el mapping a su archivo).
--     - Madrid mostraba el curso de Windows 11 cuando su temario es Windows 10
--       (mapping con versión equivocada).
--     - Cobertura incompleta e inconsistente (la mayoría solo mapeaba windows-11).
--
--   Con law_id, el curso se ata a SU ley. El fetcher del temario deriva los
--   cursos de un tema cruzando las leyes del tema (topic_scope, fuente de verdad)
--   con video_courses.law_id. Resultado: cualquier oposición cuyo temario
--   incluya "Word 365" muestra el curso AUTOMÁTICAMENTE, en la versión correcta,
--   sin mapping manual que olvidar.
--
-- AGNÓSTICO A SUPABASE: solo Postgres estándar (ADD COLUMN + FK + UPDATE).
-- Idempotente. Aplicar en prod solo tras revisión.

ALTER TABLE public.video_courses
  ADD COLUMN IF NOT EXISTS law_id UUID REFERENCES public.laws(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.video_courses.law_id IS
  'Ley a la que corresponde el curso. El temario deriva el banner cruzando topic_scope (leyes del tema) con esta columna. Fuente única — sustituye al mapping hardcodeado por oposición.';

-- Poblar los 7 cursos activos con su ley exacta (versión incluida).
UPDATE public.video_courses SET law_id = '86f671a9-4fd8-42e6-91db-694f27eb4292' WHERE slug = 'word-365';                 -- Word 365
UPDATE public.video_courses SET law_id = 'c7475712-5ae4-4bec-9bd5-ff646c378e33' WHERE slug = 'excel-365';                -- Excel 365
UPDATE public.video_courses SET law_id = 'b403019a-bdf7-4795-886e-1d26f139602d' WHERE slug = 'access-365';               -- Access 365
UPDATE public.video_courses SET law_id = 'c9df042b-15df-4285-affb-6c93e2a71139' WHERE slug = 'outlook-365';              -- Outlook 365
UPDATE public.video_courses SET law_id = '932efcfb-5dce-4bcc-9c6c-55eab19752b0' WHERE slug = 'windows-11';               -- Windows 11
UPDATE public.video_courses SET law_id = '9c0b25a4-c819-478c-972f-ee462d724a40' WHERE slug = 'explorador-windows-11';    -- Explorador Windows 11
UPDATE public.video_courses SET law_id = '7814de3a-7c9c-4045-88c2-d452b31f449a' WHERE slug = 'la-red-internet';          -- La Red Internet

-- Índice para el lookup del fetcher (law_id IN (...)).
CREATE INDEX IF NOT EXISTS idx_video_courses_law_id ON public.video_courses (law_id) WHERE law_id IS NOT NULL;
