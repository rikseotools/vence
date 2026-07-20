# Runbook — Incisos anulados por el TC (o disposiciones derogadas) sin nota de vigencia

**Frase-gatillo:** *"revisa los incisos anulados"* (o *"revisa las disposiciones anuladas"*).

## Qué problema resuelve

Un artículo importado del BOE consolidado puede contener un **inciso que el Tribunal
Constitucional declaró inconstitucional y nulo** (o una parte derogada) que **nuestro
import no marcó**. Si la clave de una pregunta apunta a ese inciso anulado, damos por
**válido lo que ya no está vigente**.

**Caso origen (19/07):** art. **126.2 LBRL** — el inciso que permitía al Alcalde nombrar
como miembros de la Junta de Gobierno Local a personas **no concejales** fue declarado
inconstitucional y nulo por la **STC 103/2013** (BOE-A-2013-5446). Nuestro artículo no
tenía la nota y la clave daba el inciso anulado como correcto → una impugnación (Alfonso)
se respondió mal antes de reabrir como bug.

**Hueco que cubre:** ni el **monitor BOE** (ve cambios *futuros*), ni **completitud-leyes**
(ve artículos que *faltan*), ni el radar de epígrafes (mira *materia*) vigilaban la
**vigencia de incisos ya anulados** en el consolidado.

## Cómo funciona el detector

Fuente robusta = **API datosabiertos del BOE**:
`…/legislacion-consolidada/id/<BOE-ID>/analisis` → `data[0].referencias.posteriores[0]
.posterior[]`, cada una con `relacion.texto` (`SE DECLARA`), `id_norma` (BOE de la
sentencia) y `texto` (describe qué se declara y sobre qué artículos).

- Lógica pura + testeada: `lib/laws/annulledProvisions.ts` (13 tests).
- Script: `scripts/audit-annulled-provisions.cjs`.
- Filtra a `SE DECLARA` con `inconstitucional`/`nulidad`, extrae los artículos **anulados**
  (mirando la palabra ANTES de cada `art. N`, para no coger los *mantenidos* — `constitucionalidad
  del art. 130` — ni las **referencias cruzadas** a otras normas — `art. 1.17 de la Ley 27/2013`).
- Cruza con nuestros artículos: flaguea los que **servimos SIN nota de vigencia**.

## Procedimiento (Claude en el bucle)

```bash
# una ley concreta
node scripts/audit-annulled-provisions.cjs --law "Ley 7/1985"
# lote (prioriza leyes que sirven en temas vivos); --emit escribe a observable_events
node scripts/audit-annulled-provisions.cjs --limit 40 [--emit]
```

Para **cada hallazgo** (`article_annulled_unmarked`):

1. **Verifica el inciso concreto contra la sentencia** (WebFetch a la STC por su `id_norma`,
   o el `texto` de la referencia): ¿qué parte exacta se anuló y qué quedó vigente?
2. **Añade la nota de vigencia** al artículo (`articles.content`), en nuestro formato:
   `[Nota de vigencia: el inciso … fue declarado inconstitucional y nulo por la STC N/AAAA,
   de … (BOE-A-…), por vulnerar el art. … CE. En consecuencia, …]`.
3. **REVISA la clave de las preguntas de ese artículo**: ninguna debe dar por válido el
   inciso anulado. Si alguna lo hace → re-clave / neutralizar enunciado / `needs_human`.
4. **NUNCA auto-corregir la clave** — revisión humana (como en el caso art. 126.2 LBRL).

## Alcance / estado

- v1: leyes **nacionales** con `boe_url` de BOE consolidado (la API datosabiertos las cubre).
  Regionales (boletines autonómicos) no tienen esta API → quedan fuera de v1.
- **Barrido completo (384 leyes)** = **cron incremental** (hermano del de completitud), no
  un one-shot (rate limits del BOE). Pendiente de cablear al sweep/cron.
- Hallazgos abiertos en LBRL al construirlo (20/07): art. **104 bis** (STC 54/2017), art.
  **26** (STC 111/2016), art. **57 bis** (STC 41/2016) — revisar.

Relacionado: `docs/roadmap/verificacion-completitud-leyes.md`, memoria del incidente Alfonso.
