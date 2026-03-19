require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.59.2 Regencia inhabilitación Príncipe heredero mayor de edad
  const exp1 = `**Articulo 59.2 de la Constitucion Espanola - Regencia por inhabilitacion del Rey:**

> "Si el Rey se inhabilitare para el ejercicio de su autoridad y la imposibilidad fuere reconocida por las **Cortes Generales**, entrara a ejercer inmediatamente la Regencia el **Principe heredero** de la Corona, **si fuere mayor de edad**. Si no lo fuere, se procedera de la manera prevista en el apartado anterior, hasta que el Principe heredero alcance la mayoria de edad."

**Por que D es correcta (Principe heredero mayor de edad):**
El art. 59.2 CE establece un orden claro para la Regencia en caso de inhabilitacion del Rey: la primera persona llamada es el **Principe heredero**, siempre que sea **mayor de edad**. Es un ejercicio automatico ("entrara a ejercer inmediatamente"), sin necesidad de nombramiento por las Cortes. Solo si el Principe heredero es menor de edad se acude al sistema del art. 59.1 (padre/madre del Rey, o pariente mayor de edad mas proximo).

**Por que las demas son incorrectas:**

- **A)** "El pariente de mayor edad mas proximo a suceder." Falso: este es el orden de Regencia por **minoria de edad** del Rey (art. 59.1), en defecto del padre o madre del Rey. En caso de inhabilitacion, la preferencia es para el Principe heredero (art. 59.2), no para el pariente mas proximo.

- **B)** "La persona que designen las Cortes Generales." Falso: la designacion por las Cortes (art. 59.3) solo procede cuando **no hay ninguna persona** a quien corresponda la Regencia por las vias anteriores. Es la ultima opcion, no la primera.

- **C)** "El padre o la madre del Rey." Falso: el padre o madre del Rey tiene preferencia en la Regencia por **minoria de edad** (art. 59.1), no en la Regencia por inhabilitacion. En inhabilitacion, la preferencia es para el Principe heredero.

**Orden de Regencia segun el supuesto (art. 59 CE):**

| Supuesto | 1.a preferencia | 2.a preferencia | Ultima opcion |
|----------|----------------|----------------|---------------|
| **Minoria de edad** (59.1) | Padre/madre del Rey | Pariente mayor mas proximo | Cortes Generales (59.3) |
| **Inhabilitacion** (59.2) | **Principe heredero** (mayor de edad) | Si es menor: igual que 59.1 | Cortes Generales (59.3) |

**Clave:** Inhabilitacion = Principe heredero mayor de edad (art. 59.2). Minoria de edad = padre/madre del Rey (art. 59.1). Si no hay nadie = Cortes Generales designan 1, 3 o 5 personas (art. 59.3).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "75631ee2-ba4b-4051-9ca5-b5ac40b56b69");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.59.2 Regencia inhabilitacion Principe (" + exp1.length + " chars)");

  // #2 - CE art.54 Defensor del Pueblo Título Primero
  const exp2 = `**Articulo 54 de la Constitucion Espanola - Defensor del Pueblo:**

> "Una **ley organica** regulara la institucion del **Defensor del Pueblo**, como alto comisionado de las Cortes Generales, designado por estas para la defensa de los derechos comprendidos en **este Titulo**, a cuyo efecto podra supervisar la actividad de la Administracion, dando cuenta a las Cortes Generales."

**Por que D es correcta (Titulo Primero):**
El art. 54 CE se encuentra en el **Titulo I** ("De los derechos y deberes fundamentales", arts. 10-55). Cuando dice "los derechos comprendidos en **este Titulo**", se refiere al Titulo I. Por tanto, el Defensor del Pueblo esta designado para defender los derechos del Titulo Primero, que abarca desde el art. 10 (dignidad de la persona) hasta el art. 55 (suspension de derechos).

**Por que las demas son incorrectas:**

- **A)** "**Titulo Segundo**." Falso: el Titulo II (arts. 56-65) regula "De la Corona" (el Rey, sucesion, funciones). No contiene derechos fundamentales ni libertades publicas. El Defensor del Pueblo no defiende derechos del Titulo II.

- **B)** "Todos los comprendidos en el texto constitucional con independencia del titulo." Falso: el art. 54 es preciso y dice "los derechos comprendidos en **este Titulo**" (el Primero). No se extiende a derechos reconocidos en otros Titulos (como los principios rectores del Titulo I Cap. III, que si estan incluidos, o derechos de otras partes de la CE).

- **C)** "**Titulo Octavo**." Falso: el Titulo VIII (arts. 137-158) regula "De la Organizacion Territorial del Estado" (CCAA, provincias, municipios). No contiene un catalogo de derechos individuales que el Defensor del Pueblo deba proteger.

**Estructura de Titulos de la CE (relevantes):**

| Titulo | Contenido | Arts. |
|--------|-----------|-------|
| **Titulo I** | **Derechos y deberes fundamentales** | **10-55** |
| Titulo II | De la Corona | 56-65 |
| Titulo VIII | Organizacion Territorial | 137-158 |

**Clave:** Art. 54 CE = Defensor del Pueblo defiende derechos del **Titulo I** (este Titulo). Es "alto comisionado de las Cortes Generales" y se regula por ley organica (LO 3/1981).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ef6049a5-aea2-4678-8b8c-7fa91aa816ec");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.54 Defensor Pueblo Titulo I (" + exp2.length + " chars)");

  // #3 - CE art.24 tutela efectiva - incorrecta: obligado declarar parentesco
  const exp3 = `**Articulo 24.2 de la Constitucion Espanola - Tutela judicial efectiva:**

> "Asimismo, todos tienen derecho al Juez ordinario predeterminado por la ley, a la **defensa y a la asistencia de letrado**, a ser **informados de la acusacion** formulada contra ellos, a un proceso publico sin dilaciones indebidas y con todas las garantias, a utilizar los medios de prueba pertinentes para su defensa, a **no declarar contra si mismos**, a **no confesarse culpables** y a la presuncion de inocencia."
>
> "La ley regulara los casos en que, por razon de **parentesco** o de secreto profesional, **no se estara obligado a declarar** sobre hechos presuntamente delictivos."

**Por que D es incorrecta (y por tanto la respuesta correcta):**
La pregunta pide senalar la respuesta **incorrecta**. La opcion D dice "Cualquiera puede estar **obligado** a declarar sobre casos en los que exista parentesco". Esto es **falso** segun el art. 24.2 CE, que establece exactamente lo contrario: por razon de parentesco **no se estara obligado a declarar**. El parentesco es una causa de exencion de la obligacion de declarar, no de imposicion.

**Por que las demas son correctas (estan en el art. 24.2):**

- **A)** "Todos tienen derecho a **no confesarse culpables**." Correcto: el art. 24.2 CE reconoce expresamente el derecho a no confesarse culpable. Es una garantia procesal fundamental.

- **B)** "Todos tienen derecho a la **defensa y a la asistencia de letrado**." Correcto: el art. 24.2 CE lo reconoce expresamente. Es una de las garantias esenciales del proceso.

- **C)** "Todos tienen derecho a ser **informados de la acusacion** formulada contra ellos." Correcto: el art. 24.2 CE lo reconoce expresamente. Nadie puede ser juzgado sin conocer de que se le acusa.

**Garantias del art. 24.2 CE (resumen):**

| Garantia | Contenido |
|----------|-----------|
| Juez predeterminado por ley | Juez ordinario, no tribunales especiales |
| Defensa y asistencia de letrado | Derecho a abogado |
| Informacion de la acusacion | Conocer los cargos |
| Proceso publico sin dilaciones | Sin retrasos indebidos |
| Medios de prueba pertinentes | Proponer y practicar pruebas |
| No declarar contra si mismo | Derecho al silencio |
| No confesarse culpable | Presuncion de inocencia activa |
| Presuncion de inocencia | Culpabilidad debe probarse |
| **Parentesco/secreto profesional** | **Exencion de declarar** (no obligacion) |

**Clave:** Por parentesco o secreto profesional **NO se esta obligado a declarar** (art. 24.2 CE). La opcion D invierte el sentido del precepto: dice que se puede estar "obligado", cuando la CE dice lo contrario.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "834b6884-b8f3-42bf-90ba-c79e625fade3");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.24 tutela efectiva parentesco (" + exp3.length + " chars)");
})();
