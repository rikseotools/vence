require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.56 Rey comunidad historica
  const exp1 = `**Articulo 56.1 de la Constitucion Espanola:**

> "El Rey es el Jefe del Estado, simbolo de su unidad y permanencia, arbitra y modera el funcionamiento regular de las instituciones, asume la mas alta representacion del Estado espanol en las relaciones internacionales, especialmente con las naciones de su **comunidad historica**, y ejerce las funciones que le atribuyen expresamente la Constitucion y las leyes."

**Por que B es correcta (naciones de su comunidad historica):**
El art. 56.1 CE utiliza la expresion "comunidad **historica**" para referirse a las naciones con las que Espana tiene vinculos historicos especiales (paises de America Latina, Portugal, Filipinas, etc.). Es una referencia al pasado compartido, no a criterios geograficos ni culturales genericos.

**Por que las demas son incorrectas:**

- **A)** "Naciones iberoamericanas". Falso: aunque las naciones iberoamericanas forman parte de esa comunidad historica, la CE no usa esa expresion. Es un concepto mas restrictivo que "comunidad historica", que tambien podria incluir otros paises con vinculos historicos.

- **C)** "Naciones de la Union Europea". Falso: la CE de 1978 no menciona la Union Europea (que se creo como tal en 1992 con Maastricht). Ademas, las relaciones con la UE no se enmarcan en el concepto de "comunidad historica" sino en la integracion politica europea.

- **D)** "Naciones de su comunidad cultura". Falso: la CE dice "comunidad **historica**", no "comunidad cultura". Ademas, la expresion gramaticalmente correcta seria "comunidad cultural" (con la "l" final). Esta opcion cambia la palabra clave del articulo.

**Funciones del Rey (art. 56.1 CE):**
- Jefe del Estado
- Simbolo de unidad y permanencia
- Arbitra y modera las instituciones
- Mas alta representacion en relaciones internacionales (especialmente **comunidad historica**)
- Funciones atribuidas por CE y leyes`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7479b7c6-05f4-42f4-8fd5-4ace3bcf1578");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.56 Rey comunidad historica (" + exp1.length + " chars)");

  // #2 - CE art.157 recursos financieros CCAA - senale no recogido
  const exp2 = `**Articulo 157.1 de la Constitucion Espanola** (Recursos de las CCAA):

> "a) Impuestos cedidos total o parcialmente por el Estado; **recargos sobre impuestos estatales** y otras participaciones en los ingresos del Estado.
> b) Sus propios impuestos, tasas y contribuciones especiales.
> c) Transferencias de un Fondo de Compensacion interterritorial [...]
> d) Rendimientos procedentes de su patrimonio e ingresos de derecho privado.
> e) El producto de las **operaciones de credito**."

**Por que C es la respuesta (NO esta recogido):**
La opcion C dice: "Recargos sobre **sus propios** impuestos, tasas y contribuciones especiales."

Pero el art. 157.1.a) dice: "Recargos sobre **impuestos estatales**."

La trampa esta en el cambio de una palabra: **"estatales"** se sustituye por **"propios"**. Los recargos son sobre impuestos del **Estado**, no sobre los impuestos propios de la Comunidad Autonoma. Tiene logica: los recargos son un "extra" que la CCAA cobra sobre un impuesto que gestiona el Estado.

**Por que las demas SI estan recogidas en el art. 157.1:**

- **A)** "Sus propios impuestos, tasas y contribuciones especiales". **SI**: art. 157.1.b). Las CCAA pueden crear sus propios tributos.

- **B)** "Impuestos cedidos total o parcialmente por el Estado". **SI**: art. 157.1.a). Ejemplo: parte del IRPF o IVA cedido a las CCAA.

- **D)** "El producto de las operaciones de credito". **SI**: art. 157.1.e). Las CCAA pueden endeudarse mediante operaciones de credito.

**Clave:** La trampa es el cambio de "impuestos **estatales**" por "sus **propios** impuestos". Los recargos se aplican sobre tributos del Estado, no sobre los tributos propios de la CCAA.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "25f2986a-abfe-451c-abd1-55e9d2ab0663");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.157 recursos CCAA (" + exp2.length + " chars)");

  // #3 - CE art.149 competencia exclusiva Estado
  const exp3 = `**Articulo 149.1.9a de la Constitucion Espanola:**

> "El Estado tiene competencia exclusiva sobre [...] 9.a **Legislacion sobre propiedad intelectual e industrial**."

**Por que D es correcta (propiedad intelectual e industrial):**
La legislacion sobre propiedad intelectual e industrial es competencia **exclusiva del Estado** segun el art. 149.1.9a CE. Esto garantiza un regimen uniforme de patentes, marcas, derechos de autor, etc., en todo el territorio nacional.

**Por que las demas son incorrectas (son competencias de las CCAA, no del Estado):**

- **A)** "Promocion del deporte y adecuada utilizacion del ocio". Falso como competencia exclusiva del Estado: es una competencia que las CCAA pueden asumir segun el **art. 148.1.19a CE**. El Estado no tiene competencia exclusiva sobre ello.

- **B)** "Sanidad e higiene". Falso como competencia exclusiva del Estado: la "sanidad e higiene" aparece en el **art. 148.1.21a CE** como asumible por las CCAA. El Estado solo tiene competencia exclusiva sobre "sanidad exterior" y "bases y coordinacion general de la sanidad" (art. 149.1.16a), no sobre la sanidad en general.

- **C)** "Asistencia social". Falso como competencia exclusiva del Estado: la asistencia social es competencia asumible por las CCAA segun el **art. 148.1.20a CE**. De hecho, es una de las competencias que todas las CCAA han asumido en sus Estatutos.

**Clave para distinguir art. 148 vs 149:**
- Art. **148**: competencias que las **CCAA pueden asumir** (deporte, sanidad, asistencia social, turismo...)
- Art. **149**: competencias **exclusivas del Estado** (defensa, relaciones internacionales, legislacion mercantil, propiedad intelectual...)
- Si la materia aparece en el art. 148, NO es exclusiva del Estado.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "bcd0f215-d5c2-48a6-bcbd-3e86d8de4ad7");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.149 propiedad intelectual (" + exp3.length + " chars)");
})();
