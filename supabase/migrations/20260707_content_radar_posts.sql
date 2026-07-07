-- Radar de contenido social: top posts de competidores (Instagram) por engagement.
-- Poblado semanalmente por la tarea Fargate `vence-content-radar` vía Meta
-- Business Discovery. El panel /admin/radar-contenido lee de aquí; el badge
-- cuenta las recomendaciones no vistas (seen=false).
-- Ver docs/runbooks/radar-contenido-social.md

CREATE TABLE IF NOT EXISTS public.content_radar_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permalink         text NOT NULL UNIQUE,          -- clave de dedup entre refrescos
  competitor_name   text NOT NULL,
  handle            text NOT NULL,
  followers_count   integer,
  caption           text,
  media_type        text,                          -- IMAGE | VIDEO | CAROUSEL_ALBUM
  like_count        integer NOT NULL DEFAULT 0,
  comments_count    integer NOT NULL DEFAULT 0,
  engagement        integer NOT NULL DEFAULT 0,    -- likes + comments
  engagement_rate   numeric,                       -- engagement / followers
  posted_at         timestamptz,
  rank_kind         text,                          -- 'absolute' | 'rate' (por qué entró al top)
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  seen              boolean NOT NULL DEFAULT false  -- para el badge (recomendación nueva)
);

CREATE INDEX IF NOT EXISTS idx_content_radar_unseen
  ON public.content_radar_posts (seen, engagement DESC);
CREATE INDEX IF NOT EXISTS idx_content_radar_posted
  ON public.content_radar_posts (posted_at DESC);
