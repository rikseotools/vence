require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LCSP art.3 consorcios como AAPP no ingresos de mercado
  const exp1 = `**Articulo 3.2.b) de la Ley 9/2017 (LCSP):**

> "Dentro del sector publico, y a los efectos de esta Ley, tendran la consideracion de Administraciones Publicas las siguientes entidades: [...] b) Los consorcios y otras entidades de derecho publico [...] siempre que [...] **no se financien mayoritariamente con ingresos de mercado**. Se entiende que se financian mayoritariamente con ingresos de mercado cuando tengan la consideracion de productor de mercado de conformidad con el Sistema Europeo de Cuentas."

**Por que B es correcta:**
Para que un consorcio o entidad de derecho publico sea considerado **Administracion Publica** a efectos de la LCSP (y no simplemente "sector publico"), debe cumplir un requisito fundamental: **no financiarse mayoritariamente con ingresos de mercado**. Es decir, su financiacion debe provenir de presupuestos publicos, transferencias o tasas, no de la venta de bienes o servicios en competencia.

**Por que las demas son incorrectas (cada una altera o invierte el criterio):**

- **A)** "Que se financien mayoritariamente con ingresos [...] como contrapartida a la entrega de bienes o a la prestacion de servicios". Falso: esto describe exactamente lo **contrario** del requisito. Si se financian mayoritariamente con ingresos de mercado (venta de bienes/servicios), **no** son Administracion Publica a efectos de la LCSP, sino entes del sector publico con otro regimen.

- **C)** "Que hayan sido creadas especificamente para satisfacer necesidades de interes general que tengan caracter **industrial o mercantil**". Falso: el art. 3.2.b) exige lo contrario: necesidades de interes general que **no tengan** caracter industrial o mercantil. La trampa omite el "no".

- **D)** "Que tengan la consideracion de **productor de mercado**". Falso: es justo lo contrario. El art. 3.2.b) dice que "no se financien mayoritariamente con ingresos de mercado" y anade que se entiende que se financian con ingresos de mercado cuando son "productor de mercado" segun el SEC. Ser productor de mercado **excluye** la consideracion de Administracion Publica.

**Clave:** Consorcio = Administracion Publica solo si NO se financia mayoritariamente con ingresos de mercado. Las trampas invierten la negacion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f76ac962-881e-42c0-a81f-c032f4a0fc41");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.3 consorcios AAPP (" + exp1.length + " chars)");

  // #2 - CE art.120.2 procedimiento predominantemente oral
  const exp2 = `**Articulo 120.2 de la Constitucion Espanola:**

> "El procedimiento sera **predominantemente oral**, sobre todo en materia criminal."

**Por que C es correcta (predominantemente oral):**
El art. 120.2 CE dice "**predominantemente** oral", lo que significa que la oralidad es el principio general, pero no exclusivo. Hay fases escritas en todos los procedimientos (demanda, contestacion, documentos). La palabra clave es "predominantemente": la oralidad prevalece, pero no es absoluta.

**Por que las demas son incorrectas:**

- **A)** "Todas las fases del procedimiento se encauzaran en audiencia publica". Falso: el art. 120.1 CE dice que las actuaciones judiciales seran publicas, pero "con las **excepciones** que prevean las leyes de procedimiento". No todas las fases son publicas (ej: instruccion penal, deliberaciones judiciales). Ademas, la audiencia publica del art. 120.3 se refiere especificamente a las **sentencias**, no a todas las fases.

- **B)** "El procedimiento sera oral en **todas sus fases** en materia criminal". Falso: el art. 120.2 dice "sobre todo en materia criminal", lo que refuerza la oralidad en el ambito penal, pero NO dice "en todas sus fases". Incluso en materia penal hay fases escritas (querella, auto de apertura de juicio oral, escrito de calificaciones).

- **D)** "La oralidad del procedimiento debera estar justificada". Falso: es al reves. La oralidad es el **principio general** (no necesita justificacion); lo que necesitaria justificacion seria la excepcion a la oralidad. La CE no exige justificacion para la oralidad.

**Los tres principios del art. 120 CE:**
1. **Publicidad** de las actuaciones judiciales (con excepciones legales)
2. **Oralidad** predominante (sobre todo en materia criminal)
3. **Motivacion** de las sentencias + pronunciamiento en audiencia publica

**Clave:** "Predominantemente" oral (no absolutamente). "Sobre todo" en materia criminal (no exclusivamente).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "7fc7f0b0-903a-466d-a983-55f98f9dc083");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.120.2 oral predominante (" + exp2.length + " chars)");
})();
