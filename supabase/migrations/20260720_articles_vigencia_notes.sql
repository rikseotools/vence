-- T-048 — capturar las NOTAS DE VIGENCIA del BOE al importar leyes.
--
-- Problema: cuando el TC anula un inciso y el legislador no reforma el texto, el BOE mantiene la
-- frase en el articulado, la resalta con <strong> y le añade nota al pie. Nuestros importadores
-- hacían `replace(/<[^>]+>/g,' ')` → se llevaban resaltado Y nota, y guardábamos el inciso muerto
-- como texto plano válido. Es la raíz del incidente art. 126.2 LBRL / STC 103/2013 (19/07).
--
-- Hasta ahora no había DÓNDE guardarlo: `articles` no tiene ningún campo de vigencia.
--
-- Por qué columna aparte y NO marcadores dentro de `content`: las explicaciones de las preguntas
-- citan el articulado LITERALMENTE (blockquote verbatim). Inyectar marcadores en `content` rompería
-- esas citas y los checks de literalidad. `content` no se toca.
--
-- Forma del JSONB (la produce lib/laws/boeVigencia.ts):
--   {
--     "notes": [ { "clase": "nota_pie_2",
--                  "texto": "Se declara inconstitucional y nulo el inciso destacado …",
--                  "ref": "BOE-A-2013-2167",
--                  "esAnulacion": true } ],
--     "annulledFragments": [ "Asimismo, toda devolución acordada …" ],
--     "capturedAt": "2026-07-20T00:00:00Z",
--     "sourceBlock": "a58"
--   }
--
-- Additiva y NULL por defecto: los artículos ya importados quedan como están (NULL = "no lo
-- sabemos", que es la verdad) y se van rellenando al re-importar o al pasar el auditor.
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS vigencia_notes JSONB;

COMMENT ON COLUMN articles.vigencia_notes IS
  'Notas de vigencia del BOE (modificaciones, derogaciones, anulaciones del TC) + incisos '
  'destacados como anulados. NULL = no capturado todavía (no equivale a "sin notas"). '
  'Lo produce lib/laws/boeVigencia.ts al importar. Ver T-048.';

-- Índice parcial: solo interesan los que TIENEN anulación, que son pocos (~6% de las leyes con
-- sentencia del TC). Sirve al guardarraíl de generación y al panel de salud de contenido.
CREATE INDEX IF NOT EXISTS idx_articles_vigencia_anulados
  ON articles USING GIN (vigencia_notes)
  WHERE vigencia_notes IS NOT NULL;
