require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.153 control actividad CCAA cuatro órganos
  const exp1 = `**Articulo 153 de la Constitucion Espanola - Control de la actividad de las CCAA:**

> "El control de la actividad de los organos de las Comunidades Autonomas se ejercera:
> a) Por el **Tribunal Constitucional**, el relativo a la constitucionalidad de sus disposiciones normativas con fuerza de ley.
> b) Por el **Gobierno**, previo dictamen del Consejo de Estado, el del ejercicio de funciones delegadas (art. 150.2).
> c) Por la **jurisdiccion contencioso-administrativa**, el de la administracion autonoma y sus normas reglamentarias.
> d) Por el **Tribunal de Cuentas**, el economico y presupuestario."

**Por que C es correcta:**
El art. 153 CE enumera exactamente **cuatro** organos de control: (1) Tribunal Constitucional, (2) Gobierno, (3) jurisdiccion contencioso-administrativa, y (4) Tribunal de Cuentas. La opcion C los reproduce fielmente.

**Por que las demas son incorrectas:**

- **A)** Incluye las **Cortes Generales** y el **Tribunal Supremo**, pero omite el Gobierno y la jurisdiccion contencioso-administrativa. Las Cortes Generales no figuran en el art. 153 como organo de control de las CCAA (aunque el Senado sea camara de representacion territorial). El Tribunal Supremo tampoco aparece como tal.

- **B)** Incluye el **Tribunal Europeo de Derechos Humanos**, que es un organo internacional (Consejo de Europa), no previsto en la CE para el control de las CCAA. Ademas incluye el Tribunal Supremo (no mencionado en el art. 153) y omite el Gobierno y la jurisdiccion contencioso-administrativa.

- **D)** Sustituye el Gobierno por el "organo **fiscalizador contable** de la CA" y la jurisdiccion contencioso-administrativa por el "Tribunal **Superior** de Justicia". El art. 153 no menciona organos autonomicos de fiscalizacion ni TSJ especificamente; habla del Gobierno estatal y de la jurisdiccion contencioso-administrativa en general.

**Los 4 controles del art. 153 CE:**

| Organo | Materia que controla |
|--------|---------------------|
| **Tribunal Constitucional** | Constitucionalidad de leyes autonomicas |
| **Gobierno** (con dictamen del Consejo de Estado) | Funciones delegadas (art. 150.2) |
| **Jurisdiccion contencioso-administrativa** | Administracion autonoma y reglamentos |
| **Tribunal de Cuentas** | Control economico y presupuestario |

**Clave:** Son 4 organos: TC, Gobierno, contencioso-administrativa y Tribunal de Cuentas. No incluye Cortes, TS, TEDH ni organos autonomicos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7cbf649c-72f8-41ec-9bad-a2d8f6aa5094");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.153 control CCAA (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.102 ejecución subsidiaria no personalísimos
  const exp2 = `**Articulo 102.1 de la Ley 39/2015 (LPAC) - Ejecucion subsidiaria:**

> "Habra lugar a la ejecucion subsidiaria cuando se trate de actos que por **no ser personalisimos** puedan ser realizados por **sujeto distinto del obligado**."

**Por que B es correcta:**
La ejecucion subsidiaria procede cuando concurren dos condiciones: (1) el acto **no es personalisimo** (no requiere que lo haga el obligado en persona), y (2) por ello **puede** ser realizado por un sujeto distinto. La Administracion ejecuta el acto por si o a traves de terceros, a costa del obligado.

**Por que las demas son incorrectas (trampas de redaccion):**

- **A)** Dice "**deban** ser realizados por el obligado". Falso: el art. 102 dice "puedan ser realizados por **sujeto distinto del obligado**", exactamente lo contrario. Si debieran ser realizados por el obligado, serian actos personalisimos y procederia la compulsion sobre las personas (art. 104), no la ejecucion subsidiaria.

- **C)** Dice "por **ser** personalisimos puedan ser realizados por sujeto distinto". Contradictorio: si un acto **es** personalisimo, por definicion **no puede** ser realizado por otro. La opcion invierte "no ser" por "ser" creando una frase logicamente imposible.

- **D)** Dice "por **ser** personalisimos **no** puedan ser realizados por sujeto distinto". Describe correctamente los actos personalisimos, pero la ejecucion subsidiaria es para lo contrario: actos **no** personalisimos. Los actos personalisimos que no admiten ejecucion por tercero se imponen mediante **multa coercitiva** (art. 103) o **compulsion sobre las personas** (art. 104).

**Medios de ejecucion forzosa (arts. 100-104 LPAC):**

| Medio | Cuando procede |
|-------|---------------|
| Apremio sobre el patrimonio | Obligaciones pecuniarias |
| **Ejecucion subsidiaria** | **Actos NO personalisimos** |
| Multa coercitiva | Actos personalisimos o imposibles por otro medio |
| Compulsion sobre las personas | Obligaciones personalisimas de no hacer o soportar |

**Clave:** Ejecucion subsidiaria = actos NO personalisimos que PUEDEN ser realizados por otro. Cuidado con las trampas de "ser/no ser" y "deban/puedan".`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "f6a06fba-a682-4176-af0e-1a0091b1dac6");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.102 ejecucion subsidiaria (" + exp2.length + " chars)");

  // #3 - LO 3/2007 art.5 no discriminación requisito profesional esencial
  const exp3 = `**Articulo 5 de la LO 3/2007 (Ley de Igualdad) - Igualdad de trato en el acceso al empleo:**

> "No constituira discriminacion en el acceso al empleo, incluida la formacion necesaria, una diferencia de trato basada en una caracteristica relacionada con el sexo cuando, debido a la naturaleza de las actividades profesionales concretas o al contexto en el que se lleven a cabo, dicha caracteristica constituya un **requisito profesional esencial y determinante**, siempre y cuando el **objetivo sea legitimo** y el **requisito proporcionado**."

**Por que D es correcta:**
El art. 5 LO 3/2007 establece una **excepcion** al principio de no discriminacion: cuando una caracteristica ligada al sexo es un requisito profesional esencial, la diferencia de trato **no** es discriminatoria, siempre que se cumplan dos condiciones acumulativas: (1) objetivo legitimo y (2) requisito proporcionado. Ejemplo: contratar exclusivamente actrices para un papel femenino.

**Por que las demas son incorrectas:**

- **A)** "No, en ningun supuesto". Falso: el propio art. 5 reconoce que **si** hay supuestos en los que la diferencia de trato basada en el sexo no es discriminatoria. "En ningun supuesto" es demasiado absoluto y contradice la excepcion prevista en la ley.

- **B)** "Si, siempre y en todo caso". Falso: afirma que la diferencia de trato **siempre** constituye discriminacion, lo que ignora la excepcion del art. 5. La ley permite la diferencia cuando el requisito es esencial, el objetivo es legitimo y la medida es proporcionada.

- **C)** "Si, salvo que la diferencia de trato sea consentida por el empleado". Falso: el consentimiento del empleado no es el criterio que usa la ley. El art. 5 habla de **requisito profesional esencial**, **objetivo legitimo** y **proporcionalidad**, no del consentimiento del afectado. La discriminacion no se "subsana" porque el afectado la acepte.

**Requisitos para que la diferencia de trato NO sea discriminatoria (art. 5):**
1. Que sea un **requisito profesional esencial y determinante**
2. Que el **objetivo sea legitimo**
3. Que el requisito sea **proporcionado**
Los tres deben concurrir simultaneamente.

**Clave:** No toda diferencia de trato por sexo es discriminatoria. La excepcion requiere requisito esencial + objetivo legitimo + proporcionalidad. Ni "nunca" ni "siempre": depende de estos tres criterios.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "ac8743b8-f2f9-4cbe-ba0a-2c8b3f4c35f9");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LO 3/2007 art.5 no discriminacion (" + exp3.length + " chars)");
})();
