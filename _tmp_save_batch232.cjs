require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 9/2017 art.63 contratos menores publicación trimestral
  const exp1 = `**Articulo 63.4 de la Ley 9/2017 (LCSP) - Publicacion de contratos menores:**

> "La publicacion de la informacion relativa a los **contratos menores** debera realizarse **al menos trimestralmente**."

**Por que C es correcta (al menos trimestralmente):**
El art. 63.4 LCSP establece que la informacion sobre contratos menores debe publicarse en el perfil de contratante con una periodicidad minima **trimestral** (cada 3 meses). Esta obligacion de transparencia garantiza el acceso publico a la actividad contractual, especialmente relevante en contratos menores que no requieren licitacion publica.

**Por que las demas son incorrectas (periodicidad diferente):**

- **A)** "Al menos **semestralmente**." Falso: semestral (cada 6 meses) es una periodicidad menor que la exigida por la ley. El art. 63.4 exige al menos cada 3 meses, no cada 6.

- **B)** "Al menos **anualmente**." Falso: anual (cada 12 meses) es una periodicidad mucho menor que la exigida. Una publicacion anual no garantizaria la transparencia que persigue la ley.

- **D)** "Al menos **bienalmente**." Falso: bienal (cada 2 anos) es una periodicidad muy inferior a la exigida. Ademas, el termino "bienalmente" no es habitual en la legislacion de contratacion publica.

**Periodicidad de publicacion (art. 63 LCSP):**

| Tipo de contrato | Periodicidad minima |
|-----------------|-------------------|
| **Contratos menores** | **Trimestral** (cada 3 meses) |
| Resto de contratos | Publicacion inmediata en perfil contratante |

**Recordatorio - Contratos menores (art. 118 LCSP):**

| Tipo | Importe maximo |
|------|---------------|
| Obras | Menos de 40.000 euros |
| Resto (suministros, servicios) | Menos de 15.000 euros |

**Clave:** Contratos menores = publicacion al menos trimestral (art. 63.4 LCSP). La trampa esta en ofrecer plazos mas largos (semestral, anual, bienal) que parecen razonables pero no son los que dice la ley.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ca459ffa-6535-4078-bedb-889f4fa39506");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.63 contratos menores trimestral (" + exp1.length + " chars)");
})();
