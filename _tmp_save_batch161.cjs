require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 4/2023 art.2 ámbito subjetivo todas correctas
  const exp1 = `**Articulo 2 de la Ley 4/2023 - Ambito de aplicacion:**

> "Esta Ley sera de aplicacion a **toda persona fisica o juridica**, de caracter **publico o privado**, que **resida, se encuentre o actue** en territorio espanol, **cualquiera que fuera** su nacionalidad, origen racial o etnico, religion, domicilio, residencia, edad, estado civil o situacion administrativa."

**Por que D es correcta (todas las anteriores):**
El art. 2 tiene un ambito de aplicacion **amplisimo**. Veamos que cada opcion queda cubierta:

- **A)** "Toda persona fisica **extranjera** que resida en territorio espanol." **SI**: el articulo dice "toda persona fisica... **cualquiera que fuera su nacionalidad**", por lo que incluye a los extranjeros que residan en Espana.

- **B)** "Toda persona juridica de caracter **privado** que actue en territorio espanol." **SI**: el articulo dice "toda persona... juridica, de caracter **publico o privado**, que... actue en territorio espanol". Las empresas privadas estan incluidas.

- **C)** "Todo menor de edad que se encuentre en territorio espanol." **SI**: el articulo dice "toda persona fisica... cualquiera que fuera su... **edad**". No excluye a los menores; de hecho, la ley tiene disposiciones especificas para menores trans.

Como las tres opciones individuales son correctas, la respuesta es **D) Todas son correctas**.

**Clave:** El art. 2 cubre a TODA persona (fisica/juridica, publica/privada, nacional/extranjera, mayor/menor) que resida, se encuentre o actue en Espana. No hay exclusion por nacionalidad, edad ni naturaleza juridica.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d0a5898f-fdc2-4c4e-a5e3-268894fc38a7");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 4/2023 art.2 ambito subjetivo (" + exp1.length + " chars)");

  // #2 - Ley 4/2023 art.2 ámbito aplicación persona física o jurídica
  const exp2 = `**Articulo 2 de la Ley 4/2023 - Ambito de aplicacion:**

> "Esta Ley sera de aplicacion a **toda persona fisica o juridica**, de caracter **publico o privado**, que **resida, se encuentre o actue** en territorio espanol, cualquiera que fuera su nacionalidad, origen racial o etnico, religion, domicilio, residencia, edad, estado civil o situacion administrativa."

**Por que D es correcta:**
La opcion D reproduce **literalmente** el art. 2: persona fisica o juridica, publica o privada, que resida, se encuentre o actue en territorio espanol, sin restriccion por nacionalidad ni otras circunstancias personales.

**Por que las demas son incorrectas:**

- **A)** Dice "**aunque no resida ni actue** en territorio espanol". Falso: el art. 2 exige que la persona **resida, se encuentre o actue** en territorio espanol. Es un requisito de conexion territorial. Sin esa vinculacion con Espana, la ley no se aplica.

- **B)** Dice "**Solo** a las **personas fisicas**". Falso: el art. 2 dice "persona fisica **o juridica**". La ley tambien se aplica a personas juridicas (empresas, asociaciones, etc.), no solo a personas fisicas. La palabra "solo" la hace incorrecta.

- **C)** Dice "**Solo** a las **personas juridicas**, de caracter publico o privado, que **residan**". Contiene **dos errores**: (1) dice "solo personas juridicas" cuando incluye tambien a las fisicas; (2) dice solo "residan" cuando el articulo dice "resida, **se encuentre o actue**", ofreciendo tres nexos territoriales alternativos, no solo la residencia.

**Los tres nexos territoriales del art. 2 (alternativos):**
1. **Residir** en territorio espanol
2. **Encontrarse** en territorio espanol
3. **Actuar** en territorio espanol

Basta con cumplir **uno** de los tres.

**Clave:** Personas fisicas Y juridicas + publicas Y privadas + residir O encontrarse O actuar en Espana. Cuidado con las opciones que limitan a "solo fisicas" o "solo juridicas" o eliminan el requisito territorial.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "9e98164c-8542-450e-b390-07a603e13bfb");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 4/2023 art.2 ambito aplicacion (" + exp2.length + " chars)");

  // #3 - Ley 4/2023 art.3 inducción concreta directa eficaz
  const exp3 = `**Articulo 3.d de la Ley 4/2023 - Induccion a la discriminacion:**

> "Induccion a la discriminacion, al odio o a la violencia: Toda conducta que de manera **concreta**, **directa** y **eficaz** haga surgir en otra persona una actuacion discriminatoria."

**Por que D es correcta (concreta, directa y eficaz):**
El art. 3.d exige tres requisitos acumulativos para que exista induccion: la conducta debe ser (1) **concreta** (dirigida a un fin determinado), (2) **directa** (sin intermediarios) y (3) **eficaz** (capaz de producir el resultado). Los tres deben concurrir.

**Por que las demas son incorrectas:**

- **A)** Dice "**generica**, consciente y eficaz". Contiene **dos errores**: (1) dice "generica" cuando el articulo dice "**concreta**" (lo contrario); (2) dice "consciente" cuando el articulo dice "**directa**". Una conducta "generica" no cumpliria el requisito de concrecion que exige la ley.

- **B)** Dice "**generica o concreta**, directa o **indirecta** y **suficiente**". Contiene **tres errores**: (1) anade "generica" como alternativa cuando solo vale "concreta"; (2) anade "indirecta" como alternativa cuando solo vale "directa"; (3) dice "suficiente" en vez de "**eficaz**". Ademas, usa disyuntivas ("o") cuando los requisitos son acumulativos.

- **C)** Dice "individual, concreta, **indirecta** y suficiente". Contiene **tres errores**: (1) anade "individual" (no aparece en el articulo); (2) dice "indirecta" en vez de "**directa**"; (3) dice "suficiente" en vez de "**eficaz**". Ademas son 4 requisitos en vez de los 3 del articulo.

**Los tres requisitos de la induccion (art. 3.d):**
1. **Concreta** (no generica)
2. **Directa** (no indirecta)
3. **Eficaz** (no solo "suficiente" o "consciente")

**Clave:** Induccion = concreta + directa + eficaz. Las trampas sustituyen estos adjetivos por sinonimos aparentes (generica, indirecta, suficiente, consciente) que no coinciden con el texto legal.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "cb640d74-5df5-463a-b00a-3882163c3b2f");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 4/2023 art.3 induccion (" + exp3.length + " chars)");
})();
