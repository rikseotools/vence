# scripts/_archive

Scripts one-off (imports/checks/diagnósticos de contenido ya ejecutados) que leían la
**Supabase congelada** (`NEXT_PUBLIC_SUPABASE_URL=auth.vence.es`, snapshot post-cutover 04/07/2026).

Archivados el 15/07/2026 **antes** de decomisar la instancia Supabase, para evitar que una
ejecución manual devuelva datos STALE en silencio. La fuente de verdad viva es **RDS**
(`DATABASE_URL`); las utilidades vivas se repuntaron con el shim `scripts/lib/pg-agnostic-client.cjs`
o a `postgres` directo.

Si necesitas reutilizar alguno, reescríbelo contra RDS (patrón: `postgres(process.env.DATABASE_URL, {ssl:'require'})`
o el shim) — NO lo ejecutes tal cual (leería el snapshot congelado).
