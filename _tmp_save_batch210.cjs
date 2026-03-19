require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 19/2013 art.15.1 datos protegidos salud/raza acceso
  const exp1 = `**Articulo 15 de la Ley 19/2013 (Transparencia) - Proteccion de datos personales:**

> Art. 15.1 (segundo parrafo): "Si la informacion incluyese datos personales que hagan referencia al **origen racial**, a la **salud** o a la **vida sexual**, incluyese datos **geneticos** o **biometricos** o contuviera datos relativos a la comision de **infracciones penales o administrativas** que no conllevasen la amonestacion publica al infractor, el acceso solo se podra autorizar en caso de que se cuente con el **consentimiento expreso** del afectado o si aquel estuviera amparado por una **norma con rango de Ley**."

**Por que A es correcta (consentimiento expreso O norma con rango de Ley):**
Para estos datos especialmente protegidos (raza, salud, vida sexual, geneticos, biometricos, infracciones), el art. 15.1 preve **dos vias** alternativas de acceso: el consentimiento expreso del afectado **o** que exista una norma con rango de Ley que lo ampare. Basta con una de las dos.

**Por que las demas son incorrectas:**

- **B)** "No se podra autorizar **en ningun caso**." Falso: el art. 15.1 si permite el acceso bajo las dos condiciones mencionadas (consentimiento expreso o norma con rango de Ley). No es una prohibicion absoluta.

- **C)** "Solo con el **consentimiento expreso** del afectado." Falso: omite la segunda via de acceso. El art. 15.1 permite tambien el acceso si esta amparado por una norma con rango de Ley, sin necesidad de consentimiento. La opcion C es incompleta.

- **D)** "Consentimiento expreso **y por escrito** del afectado o norma con rango de Ley." Falso: el "consentimiento expreso **y por escrito**" se exige en el **primer parrafo** del art. 15.1, que se refiere a datos aun mas sensibles: **ideologia, afiliacion sindical, religion o creencias**. Para los datos del segundo parrafo (raza, salud, etc.), basta con consentimiento "expreso", sin exigir que sea "por escrito".

**Dos niveles de proteccion en el art. 15.1:**

| Datos | Requisito de acceso |
|-------|---------------------|
| Ideologia, afiliacion sindical, religion, creencias | Consentimiento expreso **y por escrito** |
| **Raza, salud, vida sexual, geneticos, biometricos, infracciones** | **Consentimiento expreso O norma con rango de Ley** |

**Clave:** Raza/salud/vida sexual = consentimiento expreso (sin "por escrito") O norma con rango de Ley. Ideologia/religion = consentimiento expreso Y por escrito. No confundir los dos niveles.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e463c439-07c3-4b34-a08b-2b27d1412eee");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 19/2013 art.15.1 datos protegidos (" + exp1.length + " chars)");

  // #2 - Ley 19/2013 art.6bis inventario actividades tratamiento
  const exp2 = `**Articulo 6bis de la Ley 19/2013 (Transparencia) - Inventario de actividades de tratamiento:**

> Art. 6bis: "Los sujetos enumerados en el articulo 77.1 de la Ley Organica de Proteccion de Datos Personales y Garantia de los Derechos Digitales, publicaran su **inventario de actividades de tratamiento** en aplicacion del **articulo 31** de la citada Ley Organica."

**Nota sobre esta pregunta:**
Las opciones de esta pregunta hacen referencia al "articulo 30.1 del Reglamento (UE) 2016/679" (RGPD), mientras que el articulo real se remite al "articulo 31 de la LOPDGDD". Existe una relacion entre ambos preceptos (el art. 31 LOPDGDD desarrolla el registro de actividades del art. 30 RGPD), pero las opciones no reflejan con precision el texto legal.

**Por que B es la respuesta senalada como correcta:**
Entre las opciones presentadas, B es la que mas se ajusta al contenido del art. 6bis al hablar de publicar un inventario de actividades de tratamiento, sin anadir requisitos adicionales que el articulo no contempla (como mecanismos de anonimizacion, omision de datos sensibles o actualizacion periodica anual).

**Por que las demas son menos ajustadas:**

- **A)** Anade "mecanismos de **anonimizacion** de datos personales". Falso: el art. 6bis no menciona la anonimizacion como parte del inventario de actividades.

- **C)** Anade la "omision de **datos sensibles**". Falso: el art. 6bis no preve omitir datos sensibles del inventario. El inventario debe incluir todas las actividades de tratamiento.

- **D)** Anade "actualizacion periodica **anual**". Falso: el art. 6bis no establece una periodicidad concreta de actualizacion para el inventario.

**Clave:** El art. 6bis obliga a publicar el inventario de actividades de tratamiento. Se remite al art. 31 LOPDGDD (no directamente al art. 30 RGPD). No anade requisitos adicionales de anonimizacion, omision de datos ni periodicidad.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "172628fb-b2ab-4533-a39d-5e43834d6737");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 19/2013 art.6bis inventario (" + exp2.length + " chars)");

  // #3 - LOPJ art.61 Sala especial TS error judicial
  const exp3 = `**Articulo 61.1 de la LO 6/1985 (LOPJ) - Sala especial del Tribunal Supremo:**

> "Una Sala formada por el **Presidente del Tribunal Supremo**, los **Presidentes de Sala** y el **Magistrado mas antiguo** y el **mas moderno** de cada una de ellas conocera: [...] 5.o Del conocimiento de las pretensiones de declaracion de **error judicial** cuando este se impute a una Sala del Tribunal Supremo."

**Por que B es correcta:**
El art. 61.1 LOPJ describe la composicion exacta de la Sala especial del TS: el **Presidente del TS** + los **Presidentes de Sala** + el **Magistrado mas antiguo y el mas moderno** de cada Sala. La opcion B reproduce fielmente esta composicion.

**Por que las demas son incorrectas:**

- **A)** "Los **Presidentes de Sala** y el Magistrado de **mayor edad** y el **mas joven** de cada una." Falso por dos motivos: (1) **omite** al Presidente del Tribunal Supremo, que preside la Sala especial; (2) dice "mayor edad" y "mas joven" en lugar de "mas **antiguo**" y "mas **moderno**". La antiguedad se refiere al tiempo en el cargo, no a la edad biologica.

- **C)** "Presidente del TS, **Presidente de la Audiencia Nacional** y Presidentes de Sala." Falso: el Presidente de la Audiencia Nacional no forma parte de la Sala especial del TS. Ademas, omite a los Magistrados mas antiguo y mas moderno de cada Sala.

- **D)** "Presidente del TS, Presidentes de Sala y Magistrado de **mayor edad** y el **mas joven**." Falso: el art. 61.1 dice "mas **antiguo**" y "mas **moderno**", no "mayor edad" y "mas joven". La diferencia es clave: antiguo/moderno = antiguedad en el cargo; mayor edad/mas joven = edad biologica.

**Composicion de la Sala especial (art. 61.1 LOPJ):**

| Miembros | Detalle |
|----------|---------|
| Presidente del TS | Preside la Sala |
| Presidentes de Sala | De las 5 Salas del TS |
| Magistrado mas **antiguo** de cada Sala | Por antiguedad en el cargo |
| Magistrado mas **moderno** de cada Sala | El de incorporacion mas reciente |

**Competencias de esta Sala (art. 61.1):** revision de sentencias del TS, recusaciones del Presidente o Presidentes de Sala, responsabilidad civil, error judicial imputable a una Sala del TS, disolucion de partidos politicos.

**Clave:** Antiguo/moderno (antiguedad en el cargo), NO mayor edad/mas joven (edad biologica). Y siempre incluye al Presidente del TS.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "7a40a7e6-bdb4-4aca-a3f2-15e344277bfb");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LOPJ art.61 Sala especial TS (" + exp3.length + " chars)");
})();
