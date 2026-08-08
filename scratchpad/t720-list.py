import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/scripts/backlog.cjs')
s = p.read_text()

VIEJO = """      if (revisadas.length) {
        const conProblemas = revisadas.filter((r) => REV.devueltaConProblemas(r)).length;
        console.log(`\\n⚖️  ${revisadas.length} YA REVISADA(S) — hay veredicto y falta tu decisión` +
                    (conProblemas ? ` (${conProblemas} con problemas)` : ''));
        for (const r of revisadas) console.log(REV.lineaRevisada(r));"""

NUEVO = """      if (revisadas.length) {
        const conProblemas = revisadas.filter((r) => REV.devueltaConProblemas(r)).length;
        // ── ¿CUÁLES DE ESTAS SIGUEN FUERA DE `main`? (T-720) ──────────────────────────────
        // `reviewed_at` se pone y no se quita nunca, así que una tarea MERGEADA al minuto
        // siguiente seguía saliendo aquí para siempre. Medido el 08/08 al vaciar la cola: de 36
        // con veredicto, **29 ya estaban en main**. Una lista con el 80% de fantasmas se deja de
        // creer, y con ella se ignoran las que sí piden merge.
        //
        // No se estrena columna ni comando: el dato es COMPROBABLE, así que se observa en vez de
        // declararlo. `indiceDeRamas` ya responde «¿qué ramas traen contenido que main no tiene?»
        // —por ÁRBOL, no por sha ni por nombre de rama, que es lo que sobrevive a un cherry-pick—
        // y `claseDeEspera` ya convierte eso en un veredicto. Aquí solo se consultan.
        //
        // Se paga solo si hay revisadas (~3 s, una vez para todas). Y es FAIL-OPEN: si no se
        // puede leer git, `claseDeEspera` devuelve `criterio` y se listan como hasta ahora — sin
        // medir no se afirma que algo esté integrado.
        let idx = null;
        try { idx = require('../lib/backlog/ramasDeTarea.cjs').indiceDeRamas(); } catch { idx = null; }
        const RAMAS = idx ? require('../lib/backlog/ramasDeTarea.cjs') : null;
        const claseDe = (r) => (RAMAS ? REV.claseDeEspera(r, RAMAS.hechosDeGit(r.id, idx)).clase : 'criterio');
        const integradas = revisadas.filter((r) => claseDe(r) === 'solo_cerrar');
        const pendientes = revisadas.filter((r) => !integradas.includes(r));

        console.log(`\\n⚖️  ${revisadas.length} YA REVISADA(S) — hay veredicto y falta tu decisión` +
                    (conProblemas ? ` (${conProblemas} con problemas)` : ''));
        if (integradas.length) {
          console.log(`   📦 ${integradas.length} ya SIN RAMA PENDIENTE (su trabajo parece estar en main — se cierran con \\`done\\`):`);
          console.log(`      ${integradas.map((r) => r.id).join(' ')}`);
          console.log(`   ⬇️  las que de verdad piden mirar el merge:`);
        }
        for (const r of pendientes) console.log(REV.lineaRevisada(r));"""

assert VIEJO in s, 'bloque de revisadas no encontrado'
p.write_text(s.replace(VIEJO, NUEVO, 1))
print('list ampliado')
