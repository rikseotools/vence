require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.10 fundamentos orden político dignidad vs igualdad
  const exp1 = `**Articulo 10.1 de la Constitucion Espanola:**

> "La **dignidad** de la persona, los derechos **inviolables** que le son inherentes, el libre desarrollo de la personalidad, el respeto a la ley y a los **derechos de los demas** son fundamento del orden politico y de la paz social."

**Por que C es correcta:**
La opcion C reproduce textualmente el art. 10.1 CE: "La **dignidad** de la persona, los derechos **inviolables** que le son inherentes, el libre desarrollo de la personalidad, el respeto a la ley y a los **derechos de los demas**". Cada palabra coincide exactamente con el texto constitucional.

**Por que las demas son incorrectas (cambios sutiles de palabras):**

- **A)** Contiene **tres errores**: (1) dice "la **igualdad**" en vez de "la **dignidad**"; (2) omite la palabra "**inviolables**" (dice solo "los derechos que le son inherentes"); (3) dice "el respeto a la ley y al **resto del ordenamiento juridico**" en vez de "a los **derechos de los demas**". La trampa mezcla conceptos constitucionales reales (igualdad, ordenamiento juridico) para confundir.

- **B)** Cambia "la **dignidad**" por "la **igualdad**". Es una trampa muy sutil porque mantiene correctamente "inviolables" y "derechos de los demas", pero falla en la primera palabra clave. La dignidad (art. 10) y la igualdad (art. 14) son conceptos distintos.

- **D)** "La libertad, la justicia, la igualdad y el pluralismo politico" son los **valores superiores del ordenamiento** del art. **1.1** CE, no los fundamentos del orden politico del art. 10.1. La trampa confunde dos articulos fundamentales que a menudo se preguntan juntos.

**Art. 1.1 vs Art. 10.1 CE:**

| Art. 1.1 | Art. 10.1 |
|-----------|-----------|
| Valores **superiores** del ordenamiento | Fundamentos del **orden politico y paz social** |
| Libertad, justicia, igualdad, pluralismo politico | Dignidad, derechos inviolables, libre desarrollo, respeto a ley y derechos ajenos |

**Clave:** Dignidad (no igualdad), inviolables (no omitir), derechos de los demas (no ordenamiento juridico). No confundir art. 1.1 con art. 10.1.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "126a4299-a01b-46a7-991a-f0e243b04f59");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.10 dignidad fundamentos (" + exp1.length + " chars)");

  // #2 - LO 3/2018 art.85 libertad expresion dentro de rectificacion Internet
  const exp2 = `**Articulo 85 de la LO 3/2018 (LOPDGDD) - Derecho de rectificacion en Internet:**

> "1. Todos tienen derecho a la **libertad de expresion** en Internet."
>
> "2. Los responsables de redes sociales y servicios equivalentes adoptaran protocolos adecuados para posibilitar el ejercicio del **derecho de rectificacion** ante los usuarios que difundan contenidos que atenten contra el derecho al honor, la intimidad personal y familiar en Internet [...]"

**Por que D es correcta (Derecho de rectificacion en Internet):**
El art. 85 se titula "**Derecho de rectificacion en Internet**" y su apartado 1 establece: "Todos tienen derecho a la libertad de expresion en Internet." Por tanto, la mencion a la libertad de expresion en Internet se encuentra **dentro** del articulo que regula el derecho de rectificacion. La pregunta es de tipo estructural: en que derecho digital se encuadra la referencia a la libertad de expresion.

**Por que las demas son incorrectas (corresponden a otros articulos):**

- **A)** "Derecho de acceso universal a Internet" corresponde al art. **81** LOPDGDD. Trata sobre el acceso a Internet como servicio universal. No contiene la referencia a la libertad de expresion del art. 85.1.

- **B)** "Derecho a la actualizacion de informaciones en medios de comunicacion digitales" corresponde al art. **86** LOPDGDD. Regula la actualizacion de noticias desactualizadas en medios digitales, no la libertad de expresion.

- **C)** "Derecho a la seguridad digital" corresponde al art. **82** LOPDGDD. Se refiere a la seguridad de las comunicaciones y datos personales, no a la libertad de expresion.

**Derechos digitales de la LOPDGDD (Titulo X):**

| Articulo | Derecho |
|----------|---------|
| Art. 81 | Acceso universal a Internet |
| Art. 82 | Seguridad digital |
| Art. 85 | **Rectificacion en Internet** (incluye libertad de expresion, apt. 1) |
| Art. 86 | Actualizacion de informaciones digitales |

**Clave:** La libertad de expresion en Internet (art. 85.1) se ubica dentro del art. 85: "Derecho de **rectificacion** en Internet". No confundir con acceso universal (81), seguridad digital (82) ni actualizacion (86).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "451d612b-c0e1-4258-b9ce-b95d7e6f257c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/2018 art.85 rectificacion (" + exp2.length + " chars)");
})();
