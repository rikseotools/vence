require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.28 sanciones pecuniarias solidarias grado participacion
  const exp1 = `**Articulo 28.3 de la Ley 40/2015:**

> "Cuando el cumplimiento de una obligacion establecida por una norma con rango de Ley corresponda a varias personas conjuntamente, responderan de forma **solidaria** de las infracciones que, en su caso, se cometan y de las sanciones que se impongan. No obstante, cuando la sancion sea **pecuniaria** y sea posible se individualizara en la resolucion en funcion del **grado de participacion** de cada responsable."

**Por que C es correcta:**
El art. 28.3 establece dos reglas: (1) cuando hay varios responsables conjuntos, la responsabilidad es **solidaria**; (2) pero si la sancion es **pecuniaria** (economica), se individualiza segun el **grado de participacion**. La opcion C reproduce fielmente esta segunda regla.

**Por que las demas son incorrectas (cada una cambia un elemento clave):**

- **A)** "...se individualizara en funcion de la **capacidad economica** de cada responsable". Falso: el criterio es el "grado de **participacion**", no la "capacidad economica". La capacidad economica puede ser un criterio de graduacion de sanciones (art. 29.3), pero NO es el criterio de individualizacion del art. 28.3. La trampa es sustituir un concepto por otro.

- **B)** "...se individualizara en funcion de la **reincidencia** de cada responsable". Falso: la reincidencia es un criterio de **agravacion** de sanciones (art. 29.2.d), no de individualizacion de responsabilidad solidaria. Una cosa es agravar la sancion por reincidencia y otra es repartir la responsabilidad.

- **D)** "Cuando la sancion **no sea** pecuniaria...". Falso: es justo al reves. La individualizacion se aplica cuando la sancion **SI es pecuniaria** (dinero), porque las multas son divisibles. Cuando la sancion no es pecuniaria (inhabilitacion, cierre), no se puede dividir facilmente y se mantiene la solidaridad.

**Clave:** Sancion pecuniaria + varios responsables = individualizar por **grado de participacion** (no por capacidad economica ni reincidencia).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "9da8a5f0-09f8-4379-8788-89df7ace2b01");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.28 solidaria (" + exp1.length + " chars)");

  // #2 - CE art.68 + LOREG 52 circunscripciones 102 escanos
  const exp2 = `**Articulo 68.2 CE y articulo 162.2 LOREG:**

> CE art. 68.2: "La circunscripcion electoral es **la provincia**. Las poblaciones de **Ceuta y Melilla** estaran representadas cada una de ellas por **un Diputado**."

> LOREG art. 162.2: "A cada provincia le corresponde un **minimo inicial de dos Diputados**."

**Por que A es correcta (52 circunscripciones):**
El calculo es el siguiente:
- Espana tiene **50 provincias** + **Ceuta** + **Melilla** = **52 circunscripciones** electorales
- Cada provincia recibe un minimo de **2 Diputados**: 50 x 2 = **100 escanos**
- Ceuta recibe **1 Diputado** y Melilla recibe **1 Diputado**: 100 + 2 = **102 escanos**
- Esos **102 escanos** se reparten entre las **52 circunscripciones**
- Los **248 restantes** (350 - 102 = 248) se distribuyen en proporcion a la poblacion

**Por que las demas son incorrectas:**

- **B)** "48". Falso: 48 no corresponde a ninguna cifra del sistema electoral espanol. Ni es el numero de provincias (50) ni de circunscripciones (52). Podria confundir a quien reste Ceuta y Melilla de las provincias, pero Ceuta y Melilla tambien son circunscripciones.

- **C)** "54". Falso: seria sumar 50 provincias + 4, pero no hay 4 circunscripciones extra. Solo hay 2 ciudades autonomas (Ceuta y Melilla), no 4.

- **D)** "50". Falso: 50 son las **provincias**, pero las circunscripciones son **52** porque hay que sumar Ceuta y Melilla.

**Numeros clave del Congreso:**
- Diputados: entre 300 y 400 (actualmente **350**)
- Circunscripciones: **52** (50 provincias + Ceuta + Melilla)
- Minimo por provincia: **2** Diputados
- Ceuta y Melilla: **1** Diputado cada una
- Escanos fijos: **102** (100 + 2)
- Escanos por poblacion: **248**

**Clave:** 50 provincias + 2 ciudades autonomas = 52 circunscripciones. Los 102 primeros escanos se reparten a razon de 2 por provincia + 1 por ciudad autonoma.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "497895e0-7753-4a92-8b92-1aa5481ffe8a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.68 52 circunscripciones (" + exp2.length + " chars)");

  // #3 - Ley 50/1997 art.26 MAIN preceptiva legalmente vs reglamentariamente
  const exp3 = `**Articulo 26.3 de la Ley 50/1997 (Ley del Gobierno):**

> "El Centro Directivo competente elaborara con caracter **preceptivo** una **Memoria del Analisis de Impacto Normativo**."

**Por que B es correcta:**
El art. 26.3 establece que la Memoria del Analisis de Impacto Normativo (MAIN) es **preceptiva** (obligatoria). Esta memoria debe acompanar al proyecto normativo y analizar la necesidad, oportunidad, objetivos, alternativas, impacto economico y presupuestario, impacto de genero, etc.

**Por que las demas son incorrectas:**

- **A)** "En ningun caso podra omitirse ni abreviarse el tramite de audiencia a los ciudadanos". Falso: el art. 26.6 permite prescindir del tramite de audiencia en casos de **normas presupuestarias u organizativas** de la AGE, o cuando concurran **razones graves de interes publico**. Tambien puede abreviarse el plazo. No es un tramite absoluto.

- **C)** "En **algunos** casos, los proyectos de reglamento habran de ser informados por la Secretaria General Tecnica". Falso: el art. 26.5 dice "en **todo** caso", no "en algunos". El informe de la Secretaria General Tecnica es siempre preceptivo para los reglamentos. La trampa es cambiar "todo" por "algunos".

- **D)** "En todo caso, los proyectos de reglamentos habran de ser informados por la Secretaria General Tecnica, sin perjuicio del dictamen del Consejo de Estado en los casos **reglamentariamente** previstos". Falso: el art. 26.5 dice "en los casos **legalmente** previstos", no "reglamentariamente previstos". La intervencion del Consejo de Estado se regula por **ley** (LO 3/1980 del Consejo de Estado), no por reglamento. La trampa es sutil: cambia una sola palabra.

**Tramites del procedimiento de elaboracion de reglamentos (art. 26):**
1. Estudios y consultas previas
2. Consulta publica (portal web)
3. **MAIN** (preceptiva)
4. Informes y dictamenes (SGT **siempre** + Consejo de Estado en casos **legalmente** previstos)
5. Audiencia e informacion publica (salvo excepciones)

**Clave:** MAIN = preceptiva siempre. SGT = "en todo caso". Consejo de Estado = "legalmente" (no reglamentariamente).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "c2b99339-2d2e-4170-a39e-4834679db774");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 50/1997 art.26 MAIN (" + exp3.length + " chars)");
})();
