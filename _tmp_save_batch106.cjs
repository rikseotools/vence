require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.86.3 DL tramitar como proyecto de ley urgencia
  const exp1 = `**Articulo 86.3 de la Constitucion Espanola:**

> "Durante el plazo establecido en el apartado anterior, las Cortes podran tramitarlos como **proyectos de ley** por el **procedimiento de urgencia**."

**Por que B es correcta (proyectos de ley + procedimiento de urgencia):**
El art. 86.3 CE permite que, ademas de convalidar o derogar un Decreto-ley (art. 86.2), las Cortes puedan decidir tramitarlo como si fuera un **proyecto de ley**, lo que permite introducir **enmiendas** (cosa que la convalidacion no permite). Pero dada la urgencia que motivo el DL, la tramitacion debe hacerse por **procedimiento de urgencia**, no ordinario.

**Por que las demas son incorrectas (cada una cambia un elemento):**

- **A)** "Proyectos de ley por el procedimiento **ordinario**". Falso: el art. 86.3 dice expresamente "procedimiento de **urgencia**", no ordinario. Tiene logica: si el DL se dicto por "extraordinaria y urgente necesidad" (art. 86.1), su tramitacion como ley debe ser igualmente urgente.

- **C)** "**Proposiciones** de ley por el procedimiento ordinario". Doble error: dice "proposiciones" en vez de "proyectos" y "ordinario" en vez de "urgencia". Las proposiciones de ley son de origen parlamentario; aqui se trata de un DL del Gobierno que se tramita como proyecto (origen gubernamental).

- **D)** "**Proposiciones** de ley por el procedimiento de urgencia". Un error: dice "proposiciones" en vez de "proyectos". El procedimiento de urgencia es correcto, pero la denominacion es incorrecta.

**Diferencia clave:**
- **Proyecto de ley**: origen en el Gobierno (el DL es del Gobierno)
- **Proposicion de ley**: origen en las Camaras o en las CCAA

**DL tras su promulgacion (art. 86 CE):**
1. Convalidacion o derogacion por el Congreso en **30 dias** (art. 86.2)
2. Opcionalmente: tramitacion como **proyecto de ley** por **procedimiento de urgencia** (art. 86.3)

**Clave:** "Proyectos de ley" (no proposiciones) + "procedimiento de urgencia" (no ordinario).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d7d0a261-97bf-447b-aee9-677001889aa4");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.86.3 DL urgencia (" + exp1.length + " chars)");
})();
