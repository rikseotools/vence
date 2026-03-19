require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.86 Decreto-ley extraordinaria y urgente necesidad
  const exp1 = `**Articulo 86.1 de la Constitucion Espanola - Decretos-leyes:**

> "En caso de **extraordinaria y urgente necesidad**, el Gobierno podra dictar disposiciones legislativas provisionales que tomaran la forma de **Decretos-leyes** y que no podran afectar al ordenamiento de las instituciones basicas del Estado, a los derechos, deberes y libertades de los ciudadanos regulados en el Titulo I, al regimen de las Comunidades Autonomas ni al Derecho electoral general."

**Por que A es correcta (Decreto-ley):**
El art. 86.1 CE establece que las disposiciones legislativas que el Gobierno dicta en casos de extraordinaria y urgente necesidad adoptan la forma de **Decretos-leyes**. Son normas con rango de ley, provisionales, que deben ser convalidadas por el Congreso en 30 dias (art. 86.2).

**Por que las demas son incorrectas:**

- **B)** "**Real decreto legislativo**." Falso: los Reales Decretos Legislativos son el producto de la **delegacion legislativa** (arts. 82-85 CE), no de la urgencia. Las Cortes delegan en el Gobierno para que elabore textos articulados o refundidos. No tienen que ver con la "extraordinaria y urgente necesidad".

- **C)** "**Ley de emergencia**." Falso: la CE no contempla ninguna norma llamada "ley de emergencia". No existe esta figura en el sistema de fuentes espanol. La forma constitucional para la legislacion de urgencia es el Decreto-ley.

- **D)** "**Ley organica**." Falso: las leyes organicas las aprueban las Cortes Generales por mayoria absoluta del Congreso (art. 81 CE), no el Gobierno. Ademas, el art. 86.1 prohibe que los Decretos-leyes afecten a materias propias de Ley Organica (derechos del Titulo I, regimen CCAA, derecho electoral).

**Normas con rango de ley dictadas por el Gobierno:**

| Figura | Base | Presupuesto |
|--------|------|-------------|
| **Decreto-ley** | **Art. 86** | **Extraordinaria y urgente necesidad** |
| Real Decreto Legislativo | Arts. 82-85 | Delegacion legislativa de las Cortes |

**Clave:** Urgencia = Decreto-ley (art. 86). Delegacion = Real Decreto Legislativo (arts. 82-85). No confundir ambas figuras.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "8af0b889-c9eb-4421-bba4-43a19934ca6c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.86 Decreto-ley (" + exp1.length + " chars)");

  // #2 - CE art.82/81 delegación legislativa INCORRECTA régimen electoral
  const exp2 = `**Articulos 81 y 82 de la Constitucion Espanola - Leyes organicas y delegacion legislativa:**

> Art. 81.1: "Son leyes organicas las relativas al desarrollo de los derechos fundamentales y de las libertades publicas, las que aprueben los **Estatutos de Autonomia** y el **regimen electoral general** [...]"
>
> Art. 82.1: "Las Cortes Generales podran delegar en el Gobierno la potestad de dictar normas con rango de ley sobre materias determinadas **no incluidas en el articulo anterior** [art. 81]."

**Por que C es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion C dice que las Cortes pueden delegar en el Gobierno para "aprobar el **regimen electoral general**." Falso: el regimen electoral general es materia reservada a **Ley Organica** (art. 81.1 CE). El art. 82.1 excluye expresamente de la delegacion legislativa las materias del art. 81. Por tanto, el Gobierno no puede dictar normas sobre regimen electoral general por delegacion.

**Por que las demas SI son correctas:**

- **A)** "Los Estatutos de Autonomia se aprobaran por **leyes organicas**." **Correcto**: el art. 81.1 CE incluye los Estatutos de Autonomia entre las materias de Ley Organica.

- **B)** "La delegacion legislativa se otorgara por una **ley ordinaria** cuando se trate de **refundir** varios textos legales." **Correcto**: el art. 82.2 CE dice: "la delegacion legislativa debera otorgarse [...] por una ley ordinaria cuando se trate de refundir varios textos legales en uno solo." Ley ordinaria = refundicion. Ley de bases = textos articulados.

- **D)** "La aprobacion de las leyes organicas exigira **mayoria absoluta del Congreso**." **Correcto**: el art. 81.2 CE establece que "la aprobacion, modificacion o derogacion de las leyes organicas exigira mayoria absoluta del Congreso, en una votacion final sobre el conjunto del proyecto."

**Delegacion legislativa (art. 82 CE):**

| Finalidad | Instrumento de delegacion | Producto |
|-----------|--------------------------|----------|
| Textos articulados | Ley de bases | Real Decreto Legislativo |
| Refundicion | Ley ordinaria | Real Decreto Legislativo |
| **Materias de LO (art. 81)** | **No cabe delegacion** | - |

**Clave:** El regimen electoral general es materia de Ley Organica (art. 81), por lo que no cabe delegacion legislativa al Gobierno (art. 82.1 lo excluye).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "37bc661f-ec78-43e6-a474-7d72461bd630");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.82 delegacion electoral (" + exp2.length + " chars)");
})();
