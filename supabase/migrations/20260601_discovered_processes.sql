-- ═══════════════════════════════════════════════════════════════════
-- Discovered processes — almacén de procesos selectivos detectados
-- por los sensores OEP que NO están (todavía) en el catálogo Vence.
--
-- Decisión 01/06/2026: separar "señal" (`oep_detection_signals`,
-- efímera, requiere acción admin) de "proceso descubierto" (esta tabla,
-- persistente, alimenta decisión de crear oposición Vence).
--
-- Cada proceso lleva su timeline en `discovered_process_milestones`.
-- Cuando Manuel decide crear la oposición Vence: el `promoted_to_oposicion_id`
-- queda relleno, manuel_status='promoted', y el contenido sirve de input
-- para el script de creación.
--
-- Aislada: sin FK desde otras tablas, sin RLS policies → solo
-- service_role puede leer/escribir.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.discovered_processes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identidad del proceso (suficiente para dedupe)
  region_name text NOT NULL,         -- "Dip. Cádiz", "Ayto. Las Palmas G.C.", "Cataluña"
  position_name text NOT NULL,       -- "Ayudante de Recaudación"
  position_subgrupo text,            -- "C1", "C2", "E", "A2", "A1"
  year integer,                      -- año de la convocatoria detectada
  boc_ref text,                      -- referencia al BOP/BOCM/BOE/DOGV/etc

  -- Datos del proceso
  plazas_libres integer,
  plazas_discapacidad integer,
  plazas_promocion_interna integer,
  estado_proceso text,               -- mismos valores que oposiciones.estado_proceso

  -- Hitos clave
  fecha_publicacion date,
  fecha_inscripcion_inicio date,
  fecha_inscripcion_fin date,
  fecha_examen date,

  -- Trazabilidad
  source_url text NOT NULL,          -- URL del scan donde se vio el proceso
  source_sensor text NOT NULL,       -- 'regional_scan', 'llm_semantic', 'generic_source'
  raw_extraction jsonb NOT NULL DEFAULT '{}',  -- snapshot crudo por si añadimos campos

  -- Lifecycle
  discovered_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  -- Decisión humana (Manuel)
  manuel_status text NOT NULL DEFAULT 'new',
  manuel_notes text,
  promoted_to_oposicion_id uuid REFERENCES public.oposiciones(id) ON DELETE SET NULL,
  promoted_at timestamptz,

  CONSTRAINT discovered_processes_manuel_status_check CHECK (
    manuel_status IN ('new', 'watching', 'irrelevant', 'promoted')
  ),
  CONSTRAINT discovered_processes_subgrupo_check CHECK (
    position_subgrupo IS NULL OR position_subgrupo IN ('A1', 'A2', 'B', 'C1', 'C2', 'E')
  ),
  CONSTRAINT discovered_processes_source_sensor_check CHECK (
    source_sensor IN ('regional_scan', 'llm_semantic', 'generic_source', 'pdf_extract', 'rss', 'boe_api')
  ),
  CONSTRAINT discovered_processes_promoted_consistency CHECK (
    (manuel_status = 'promoted' AND promoted_to_oposicion_id IS NOT NULL AND promoted_at IS NOT NULL)
    OR
    (manuel_status <> 'promoted' AND promoted_to_oposicion_id IS NULL)
  )
);

-- Dedupe natural: (region, posición, año, BOC). Si llega misma identidad
-- otra vez el sensor hace UPDATE last_seen_at + INSERT milestone, no nuevo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_processes_dedupe
  ON public.discovered_processes (
    region_name,
    position_name,
    COALESCE(year, -1),
    COALESCE(boc_ref, '')
  );

-- Vista admin más común: ver new+watching ordenados por última señal.
CREATE INDEX IF NOT EXISTS idx_discovered_processes_admin_view
  ON public.discovered_processes (manuel_status, last_seen_at DESC)
  WHERE manuel_status IN ('new', 'watching');

-- Filtros por categoría/region en admin.
CREATE INDEX IF NOT EXISTS idx_discovered_processes_region_position
  ON public.discovered_processes (region_name, position_name);

CREATE INDEX IF NOT EXISTS idx_discovered_processes_subgrupo
  ON public.discovered_processes (position_subgrupo)
  WHERE position_subgrupo IS NOT NULL;

-- Audit / búsqueda inversa: dado un proceso promoted, ¿qué oposición Vence?
CREATE INDEX IF NOT EXISTS idx_discovered_processes_promoted_fk
  ON public.discovered_processes (promoted_to_oposicion_id)
  WHERE promoted_to_oposicion_id IS NOT NULL;

-- Trigger updated_at automático
CREATE OR REPLACE FUNCTION public.tg_discovered_processes_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discovered_processes_updated_at ON public.discovered_processes;
CREATE TRIGGER trg_discovered_processes_updated_at
  BEFORE UPDATE ON public.discovered_processes
  FOR EACH ROW EXECUTE FUNCTION public.tg_discovered_processes_updated_at();

COMMENT ON TABLE public.discovered_processes IS
  'Procesos selectivos detectados por sensores OEP (BOPs, listados regionales, LLM scan). '
  'Persistente. Manuel revisa, decide qué promover a oposiciones Vence. '
  'Roadmap: docs/roadmap/deteccion-convocatorias-oeps-completo.md';


-- ═══════════════════════════════════════════════════════════════════
-- Milestones del proceso descubierto — timeline progresivo.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.discovered_process_milestones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id uuid NOT NULL REFERENCES public.discovered_processes(id) ON DELETE CASCADE,

  fecha date NOT NULL,
  titulo text NOT NULL,              -- "Bases publicadas", "Inscripción abierta", "Lista provisional admitidos"
  descripcion text,
  url_source text,                   -- URL específica del hito si distinta del source del proceso

  detected_at timestamptz NOT NULL DEFAULT NOW()
);

-- Anti-duplicado: si el sensor vuelve a ver el mismo (proceso, fecha, título)
-- no genera milestone nuevo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_milestones_dedupe
  ON public.discovered_process_milestones (process_id, fecha, titulo);

-- Timeline ordenado para vista admin.
CREATE INDEX IF NOT EXISTS idx_discovered_milestones_timeline
  ON public.discovered_process_milestones (process_id, fecha DESC, detected_at DESC);

COMMENT ON TABLE public.discovered_process_milestones IS
  'Hitos detectados de un proceso descubierto. '
  'Cada vez que el sensor ve novedad relevante (fecha publicación, plazos, examen, listas) inserta hito. '
  'UPSERT por (process_id, fecha, titulo) evita duplicados al re-scanear.';
