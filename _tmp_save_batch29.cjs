require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.54 Defensor del Pueblo da cuenta
  const exp1 = `**Articulo 54 de la Constitucion Espanola:**

> "Una ley organica regulara la institucion del Defensor del Pueblo, como alto comisionado de las **Cortes Generales**, designado por estas para la defensa de los derechos comprendidos en este Titulo, a cuyo efecto podra supervisar la actividad de la Administracion, **dando cuenta a las Cortes Generales**."

**Por que A es correcta:**
El art. 54 CE es claro: el Defensor del Pueblo da cuenta de su actividad a las **Cortes Generales** (ambas Camaras). Es logico porque es un "comisionado" de las Cortes, es decir, actua por delegacion de ellas.

**Por que las demas son incorrectas:**

- **B)** "Al Congreso de los Diputados". Falso: el art. 54 dice "Cortes Generales", que incluyen Congreso **y** Senado. No es solo al Congreso. La Comision Mixta Congreso-Senado es la que mantiene la relacion ordinaria con el Defensor.

- **C)** "Al Gobierno". Falso: el Defensor del Pueblo supervisa precisamente la **actividad de la Administracion** (dirigida por el Gobierno). No tendria sentido que rindiera cuentas ante quien debe supervisar. Su independencia exige reportar al legislativo, no al ejecutivo.

- **D)** "Al Tribunal Constitucional". Falso: aunque el Defensor del Pueblo puede interponer recursos de inconstitucionalidad y de amparo ante el TC (art. 162 CE), no rinde cuentas ante el. El TC es un organo jurisdiccional, no de control politico.

**Clave:** El Defensor del Pueblo es comisionado de las Cortes Generales y ante ellas rinde cuentas.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "3b4eea0c-45d0-4255-a220-0b230cd4b20b");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.54 Defensor Pueblo (" + exp1.length + " chars)");

  // #2 - CE art.124 Ministerio Fiscal
  const exp2 = `**Articulo 124.1 de la Constitucion Espanola:**

> "El Ministerio Fiscal [...] tiene por mision promover la accion de la justicia en defensa de la legalidad, de los derechos de los ciudadanos y del interes publico tutelado por la ley, **de oficio o a peticion de los interesados**, asi como velar por la independencia de los Tribunales y procurar ante estos la satisfaccion del interes social."

**Por que C es correcta:**
El art. 124.1 establece que el Ministerio Fiscal promueve la accion de la justicia "de oficio **o** a peticion de los interesados". Son dos vias alternativas, no excluyentes.

**Por que las demas son incorrectas:**

- **A)** "De oficio". Incompleta: solo menciona una de las dos vias. El art. 124.1 dice "de oficio **o** a peticion de los interesados". Falta la segunda via.

- **B)** "No tiene dicha mision". Falso: el art. 124.1 atribuye expresamente al Ministerio Fiscal la mision de "promover la accion de la justicia".

- **D)** "A peticion de los interesados". Incompleta: solo menciona una via. El Ministerio Fiscal puede actuar de oficio (sin que nadie se lo pida) **o** a peticion de los interesados. Falta la primera via.

**Misiones del Ministerio Fiscal (art. 124.1):**
1. Promover la accion de la justicia (de oficio o a peticion)
2. Defensa de la legalidad
3. Defensa de los derechos de los ciudadanos
4. Defensa del interes publico tutelado por la ley
5. Velar por la independencia de los Tribunales
6. Procurar la satisfaccion del interes social`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "82c8e774-74bc-4847-9e3e-0ecd53ba46aa");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.124 Ministerio Fiscal (" + exp2.length + " chars)");

  // #3 - Ley 50/1997 art.8 Comision General SE y Subsecretarios
  const exp3 = `**Articulo 8.2 de la Ley 50/1997** (Comision General de Secretarios de Estado y Subsecretarios):

> "La Comision General de Secretarios de Estado y Subsecretarios [...] tendra como funciones: a) El examen de todos los asuntos que vayan a someterse a aprobacion del Consejo de Ministros [...] b) El **analisis o discusion** de aquellos asuntos que, **afectando a varios Ministerios**, sean sometidos a la Comision **por su presidente**."

**Por que B es correcta:**
La opcion B reproduce fielmente el art. 8.2.b): el analisis o discusion de asuntos que afecten a varios Ministerios, sometidos por el Presidente. Es una funcion de coordinacion interministerial.

**Por que las demas son incorrectas:**

- **A)** "Examen de los **ascensos**". Falso: el art. 8.2.a) habla del "examen de todos los **asuntos**" que se sometan al Consejo de Ministros, no de "ascensos". Sustituye "asuntos" por "ascensos", que es mucho mas restrictivo.

- **C)** "Asuntos que son competencia del Consejo de Ministros o sus Comisiones Delegadas". Falso: la Comision General examina los asuntos **que vayan a someterse** al Consejo, pero no "los que son competencia" de este. Ademas, anade "o sus Comisiones Delegadas", que no aparece en esta funcion del art. 8.2.

- **D)** "Examen de los **nombramientos**". Falso: el art. 8.2.a) habla del "examen de todos los **asuntos**", no especificamente de "nombramientos". Similar a la opcion A, restringe indebidamente el ambito.

**Funciones de la Comision General (art. 8.2):**
- a) Examen de **todos los asuntos** para el Consejo de Ministros
- b) Analisis de asuntos **interministeriales** sometidos por su presidente`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "228d463a-33af-4065-a4d5-b20ee6e2ab89");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 50/1997 art.8 Comision General (" + exp3.length + " chars)");
})();
