-- Cache versioning agnóstico (Postgres/Drizzle) para invalidación cross-instancia.
--
-- Contexto: en AWS el frontend corre como N contenedores Next.js standalone,
-- cada uno con su propio `unstable_cache` EN MEMORIA. `revalidateTag()` solo
-- invalida la instancia que atiende la petición del endpoint /api/admin/revalidate
-- → las demás siguen sirviendo lo viejo (cross-instance roto). El
-- ARCHITECTURE_ROADMAP ya lo preveía: en AWS la invalidación por tag requiere
-- "hook propio ... versioned cache pattern".
--
-- Este es ese hook, agnóstico y sin dependencia de Redis/Supabase: un contador
-- de versión por tag en Postgres. Todas las instancias LEEN la misma versión;
-- invalidar = incrementar la versión (atómico). El wrapper `versionedCache`
-- (lib/cache/versionedCache.ts) mete la versión en la clave del unstable_cache,
-- así que al subir la versión TODAS las instancias fallan el caché y recomputan.
--
-- Precedente del patrón counter-table en Postgres puro:
-- docs/roadmap/materialized-stats-aggregates.md ("agnóstico de Supabase").
--
-- Additiva y NO destructiva.

CREATE TABLE IF NOT EXISTS public.cache_versions (
  tag        text        PRIMARY KEY,
  version    bigint      NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.cache_versions IS 'Contador de versión por tag para invalidación cross-instancia del cache (versioned cache keys). Ver lib/cache/versionStore.ts.';
COMMENT ON COLUMN public.cache_versions.tag     IS 'Tag lógico del cache (ej. test-counts, temario, landing).';
COMMENT ON COLUMN public.cache_versions.version IS 'Se incrementa en cada invalidación. La clave del unstable_cache incluye este valor.';

-- Función atómica de incremento + upsert. SECURITY DEFINER para poder invocarse
-- también desde roles con permisos mínimos si hiciera falta; la escritura normal
-- va por getAdminDb() (Drizzle) con el rol de servicio.
CREATE OR REPLACE FUNCTION public.bump_cache_version(p_tag text)
RETURNS bigint
LANGUAGE sql
AS $$
  INSERT INTO public.cache_versions (tag, version, updated_at)
  VALUES (p_tag, 1, now())
  ON CONFLICT (tag) DO UPDATE
    SET version = public.cache_versions.version + 1,
        updated_at = now()
  RETURNING version;
$$;

COMMENT ON FUNCTION public.bump_cache_version(text) IS 'Incrementa (o crea) el contador de versión de un tag de cache y devuelve el nuevo valor. Invalidación cross-instancia atómica.';
