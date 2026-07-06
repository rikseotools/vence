-- Analizador de Competidores — Fase 1
--
-- Subsistema de inteligencia de mercado: catálogo DURADERO de academias/plataformas
-- competidoras, sus oposiciones, precios (con histórico) y TODAS sus URLs (sitemap),
-- con detección de cambios. Complementa —sin mezclarse con— el radar de señales OEP:
-- son entidades (estado), no eventos efímeros. La Capa 3 del radar se ALIMENTA de
-- estas tablas (adapter `competitor-db`).
--
-- Modelo escalable "muchas oposiciones × muchos precios × muchas URLs":
--   competitors 1─┬─* competitor_sources (N fuentes/competidor: sitemaps, listados…
--                 │                        con last_hash para detectar novedades — espejo
--                 │                        del `detection_sources` del radar)
--                 ├─* competitor_urls    (sitemap completo, tracking de URLs nuevas)
--                 ├─* competitor_courses (una por oposición que preparan) ─* competitor_prices
--                 └─* competitor_changes (log append-only de cambios detectados)
--
-- Diseño: docs/roadmap/analizador-competidores.md

-- 1) competitors --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text NOT NULL UNIQUE,
  name           text NOT NULL,
  base_url       text NOT NULL,
  tipo           text,          -- academia_presencial | plataforma_online | hibrida
  region         text,          -- CCAA/ciudad (texto libre, como user_profiles.ciudad)
  is_active      boolean NOT NULL DEFAULT true,
  notes          text,
  last_synced_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitors_tipo_check
    CHECK (tipo IS NULL OR tipo = ANY (ARRAY['academia_presencial','plataforma_online','hibrida']))
);
COMMENT ON TABLE public.competitors IS
  'Academias/plataformas competidoras. Fuente del crawl que alimenta la Capa 3 del radar. Panel /admin/competidores.';

-- 1b) competitor_sources  (N fuentes por competidor, con detección de cambios) -
-- Espejo del `detection_sources` del radar: cada fuente lleva su last_hash +
-- last_checked/last_success/last_error → si el hash de una fuente no cambió, ni
-- se re-parsea; y hay observabilidad por fuente. Un competidor puede tener varios
-- sitemaps, o un listado HTML si no tiene sitemap, o RSS/API.
CREATE TABLE IF NOT EXISTS public.competitor_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  source_type     text NOT NULL,   -- sitemap | sitemap_index | listing_html | rss | api
  url             text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  last_hash       text,            -- hash del contenido → detección de cambio (como radar)
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error      text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitor_sources_uniq UNIQUE (competitor_id, url),
  CONSTRAINT competitor_sources_type_check
    CHECK (source_type = ANY (ARRAY['sitemap','sitemap_index','listing_html','rss','api']))
);
CREATE INDEX IF NOT EXISTS idx_competitor_sources_active ON public.competitor_sources (competitor_id, is_active);
COMMENT ON TABLE public.competitor_sources IS
  'Fuentes a vigilar de cada competidor (sitemaps/listados/RSS). last_hash = detección de novedades por fuente (espejo de detection_sources del radar).';

-- 2) competitor_urls  (el analizador de sitemap) ------------------------------
-- Toda URL vista en el sitemap del competidor. Base de "han lanzado algo nuevo":
-- URL nueva = candidato de lanzamiento; content_hash cambiado = actualización.
CREATE TABLE IF NOT EXISTS public.competitor_urls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  url               text NOT NULL,
  url_type          text NOT NULL DEFAULT 'other',  -- oposicion | categoria | page | post | other
  content_hash      text,
  lastmod           timestamptz,                     -- <lastmod> del sitemap (si viene)
  is_active         boolean NOT NULL DEFAULT true,   -- false cuando desaparece del sitemap
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  -- Última vez que DESCARGAMOS+hasheamos la página (≠ last_seen, que es verla en
  -- el sitemap). Red de seguridad: re-chequear aunque el lastmod no se mueva.
  content_checked_at timestamptz,
  last_changed_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitor_urls_uniq UNIQUE (competitor_id, url)
);
CREATE INDEX IF NOT EXISTS idx_competitor_urls_type   ON public.competitor_urls (competitor_id, url_type);
CREATE INDEX IF NOT EXISTS idx_competitor_urls_active ON public.competitor_urls (competitor_id, is_active);
COMMENT ON TABLE public.competitor_urls IS
  'Sitemap completo de cada competidor. URL nueva o content_hash cambiado ⇒ competitor_changes.';

-- 3) competitor_courses -------------------------------------------------------
-- Una fila por oposición que prepara el competidor. oposicion_id NULL = GAP
-- (curso que ellos preparan y nosotros no catalogamos aún → señal de producto).
CREATE TABLE IF NOT EXISTS public.competitor_courses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id     uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  competitor_url_id uuid NOT NULL REFERENCES public.competitor_urls(id) ON DELETE CASCADE,
  oposicion_id      uuid REFERENCES public.oposiciones(id) ON DELETE SET NULL,
  raw_name          text NOT NULL,
  modalidad         text,   -- online | presencial | mixta
  region            text,
  is_active         boolean NOT NULL DEFAULT true,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitor_courses_url_uniq UNIQUE (competitor_url_id)
);
CREATE INDEX IF NOT EXISTS idx_competitor_courses_oposicion ON public.competitor_courses (oposicion_id);
CREATE INDEX IF NOT EXISTS idx_competitor_courses_active    ON public.competitor_courses (competitor_id, is_active);
COMMENT ON TABLE public.competitor_courses IS
  'Oposiciones que prepara cada competidor. oposicion_id NULL = gap (la preparan y nosotros no).';

-- 4) competitor_prices  (tipos de precio + histórico via is_current) ----------
-- Escala a "muchos precios por oposición": una fila por tipo × audiencia × periodo.
-- Histórico incluido: al cambiar un precio se marca is_current=false + superseded_at
-- y se inserta la fila nueva. La identidad de una línea de precio es
-- (course, price_kind, audience, period).
CREATE TABLE IF NOT EXISTS public.competitor_prices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_course_id uuid NOT NULL REFERENCES public.competitor_courses(id) ON DELETE CASCADE,
  price_kind           text NOT NULL,   -- matricula | cuota | intensivo | tasa | material | otro
  audience             text,            -- nuevo | antiguo | general
  amount_cents         integer,         -- NULL si no parseable (raw sí se guarda)
  period               text,            -- mensual | trimestral | unico | curso
  currency             text NOT NULL DEFAULT 'EUR',
  raw                  text,            -- literal tal cual se vio (trazabilidad)
  is_current           boolean NOT NULL DEFAULT true,
  captured_at          timestamptz NOT NULL DEFAULT now(),
  superseded_at        timestamptz,
  CONSTRAINT competitor_prices_kind_check
    CHECK (price_kind = ANY (ARRAY['matricula','cuota','intensivo','tasa','material','otro']))
);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_current ON public.competitor_prices (competitor_course_id, is_current);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_hist    ON public.competitor_prices (competitor_course_id, price_kind, captured_at DESC);
COMMENT ON TABLE public.competitor_prices IS
  'Precios por curso (matrícula/cuota/intensivo/tasa…). is_current=true = vigente; el resto es histórico.';

-- 5) competitor_changes  (log append-only de cambios) -------------------------
-- Backbone de "cuando lo actualicen, detectarlo fácilmente": feed de admin +
-- fuente de señales para el radar (lanzamientos/gaps).
CREATE TABLE IF NOT EXISTS public.competitor_changes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  change_type   text NOT NULL,  -- url_added|url_removed|url_modified|course_added|course_removed|price_changed
  url           text,
  course_id     uuid,           -- ref suelta (sin FK dura: el log sobrevive al borrado del curso)
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competitor_changes_type_check
    CHECK (change_type = ANY (ARRAY['url_added','url_removed','url_modified','course_added','course_removed','price_changed']))
);
CREATE INDEX IF NOT EXISTS idx_competitor_changes_recent ON public.competitor_changes (competitor_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_changes_type   ON public.competitor_changes (change_type, detected_at DESC);
COMMENT ON TABLE public.competitor_changes IS
  'Log append-only de cambios detectados por competidor (URLs, cursos, precios).';

-- 6) Seed: primer competidor (Tecnos Zubia, Granada) + su fuente sitemap -------
INSERT INTO public.competitors (slug, name, base_url, tipo, region)
VALUES (
  'tecnoszubia',
  'Tecnos Zubia',
  'https://www.tecnoszubia.es',
  'hibrida',
  'Granada (La Zubia)'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT id, 'sitemap_index', 'https://www.tecnoszubia.es/sitemap.xml'
FROM public.competitors WHERE slug = 'tecnoszubia'
ON CONFLICT (competitor_id, url) DO NOTHING;
