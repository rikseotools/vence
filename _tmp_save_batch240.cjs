require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RGPD art.4 tratamiento transfronterizo "Europa" vs "Unión"
  const exp1 = `**Articulo 4.23 del RGPD - Tratamiento transfronterizo:**

> "Se entendera por tratamiento transfronterizo:
> a) el tratamiento de datos personales realizado en el contexto de las actividades de establecimientos en mas de un Estado miembro de un responsable o un encargado del tratamiento **en la Union**, si el responsable o el encargado esta establecido en mas de un Estado miembro; o
> b) el tratamiento [...] realizado en el contexto de las actividades de **un unico establecimiento** de un responsable o un encargado del tratamiento en la Union, pero que afecta sustancialmente o es probable que afecte sustancialmente a interesados en mas de un Estado miembro."

**Por que D es la opcion INCORRECTA (y por tanto la respuesta):**
La opcion D dice "establecimientos en mas de un Estado miembro de un encargado del tratamiento en **Europa**, si el encargado esta establecido en mas de un Estado **europeo**." Falso: el art. 4.23.a) RGPD dice "en la **Union**" y "Estado **miembro**", no "en Europa" ni "Estado europeo". La diferencia es significativa: "la Union" se refiere a la UE (27 Estados miembros), mientras que "Europa" es un concepto geografico mas amplio que incluye paises no pertenecientes a la UE (Suiza, Noruega, Reino Unido, etc.).

**Por que las demas SI son correctas:**

- **A)** Describe correctamente el supuesto b) del art. 4.23: unico establecimiento de un encargado en la Union, pero que **es probable que afecte** sustancialmente a interesados en mas de un Estado miembro. La expresion "es probable que afecte" es literal del articulo.

- **B)** Describe el mismo supuesto b) pero con la variante "**afecta sustancialmente**" (en presente, no en probabilidad). Ambas formulaciones son correctas porque el art. 4.23.b) dice "afecta sustancialmente **o** es probable que afecte".

- **C)** Describe correctamente el supuesto a) del art. 4.23: establecimientos en mas de un Estado miembro de un responsable en la **Union**.

**Trampas en la opcion D:**

| Texto correcto (RGPD) | Opcion D (incorrecta) |
|-----------------------|----------------------|
| En la **Union** | En **Europa** |
| Estado **miembro** | Estado **europeo** |

**Clave:** El RGPD usa "Union" (UE) y "Estado miembro", no "Europa" ni "Estado europeo". Son terminos juridicos precisos que no deben confundirse con conceptos geograficos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7044d734-71a7-40d2-85be-7d0809babbb1");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RGPD art.4 transfronterizo Union Europa (" + exp1.length + " chars)");

  // #2 - RGPD art.35.7 evaluación impacto "responsable" vs "interesados"
  const exp2 = `**Articulo 35.7 del RGPD - Evaluacion de impacto (contenido minimo):**

> "La evaluacion debera incluir como minimo:
> a) una descripcion sistematica de las operaciones de tratamiento previstas y de los fines;
> b) una evaluacion de la **necesidad y proporcionalidad** de las operaciones;
> c) una evaluacion de los riesgos para los derechos y libertades de los **interesados**;
> d) las medidas previstas para afrontar los riesgos, incluidas garantias, medidas de seguridad y mecanismos."

**Por que C es la opcion INCORRECTA (y por tanto la respuesta):**
La opcion C dice "evaluacion de los riesgos para los derechos y libertades del **responsable de tratamiento de datos**." Falso: el art. 35.7.c) RGPD dice "de los **interesados**", no "del responsable de tratamiento". La evaluacion de impacto analiza los riesgos para las personas cuyos datos se tratan (interesados), no para el responsable. El responsable es quien debe proteger, no quien debe ser protegido.

**Por que las demas SI son correctas:**

- **A)** "Una evaluacion de la **necesidad y proporcionalidad** de las operaciones de tratamiento con respecto a su finalidad." **Correcto**: reproduce literalmente el art. 35.7.b) RGPD.

- **B)** "Las **medidas previstas** para afrontar los riesgos, incluidas garantias, medidas de seguridad y mecanismos que garanticen la proteccion de datos personales." **Correcto**: reproduce el art. 35.7.d) RGPD.

- **D)** "Una **descripcion sistematica** de las operaciones de tratamiento previstas y de los fines del tratamiento." **Correcto**: reproduce literalmente el art. 35.7.a) RGPD.

**Contenido minimo de la evaluacion de impacto (art. 35.7 RGPD):**

| Letra | Contenido |
|-------|-----------|
| a) | **Descripcion sistematica** de operaciones y fines |
| b) | Evaluacion de **necesidad y proporcionalidad** |
| c) | Evaluacion de riesgos para **interesados** (no responsable) |
| d) | **Medidas** para afrontar riesgos (garantias, seguridad) |

**Clave:** La evaluacion de impacto evalua riesgos para los INTERESADOS (personas cuyos datos se tratan), no para el responsable del tratamiento. La trampa sustituye "interesados" por "responsable".`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "82122ef9-4783-46ab-9c1c-e3f19d1bed1f");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RGPD art.35 evaluacion impacto interesados (" + exp2.length + " chars)");

  // #3 - LO 3/1981 art.2 Defensor del Pueblo Cortes Generales 5 años
  const exp3 = `**Articulo 2.1 de la LO 3/1981 - Eleccion del Defensor del Pueblo:**

> "El Defensor del Pueblo sera elegido por las **Cortes Generales** para un periodo de **cinco anos**, y se dirigira a las mismas a traves de los Presidentes del Congreso y del Senado, respectivamente."

**Por que D es correcta (Cortes Generales + 5 anos):**
El art. 2.1 de la LO 3/1981 establece dos datos clave: (1) el Defensor del Pueblo es elegido por las **Cortes Generales** (ambas Camaras conjuntamente, no solo el Congreso), y (2) su mandato es de **5 anos** (no 4). La opcion D combina correctamente ambos datos.

**Por que las demas son incorrectas (cambian organo o duracion):**

- **A)** "Elegido por el **Congreso de los Diputados** para un periodo de **4 anos**." Falso por dos motivos: (1) lo eligen las **Cortes Generales** (Congreso + Senado), no solo el Congreso; (2) el mandato es de **5** anos, no 4.

- **B)** "Elegido por el **Congreso de los Diputados** para un periodo de **5 anos**." Falso: acierta en la duracion (5 anos) pero yerra en el organo. Lo eligen las **Cortes Generales**, no solo el Congreso.

- **C)** "Elegido por las **Cortes Generales** para un periodo de **4 anos**." Falso: acierta en el organo (Cortes Generales) pero yerra en la duracion. El mandato es de **5** anos, no 4. Cuatro anos es la duracion de la legislatura, pero el mandato del Defensor no coincide con ella.

**Datos clave del Defensor del Pueblo:**

| Aspecto | Detalle |
|---------|---------|
| Elegido por | **Cortes Generales** (no solo Congreso) |
| Mandato | **5 anos** (no 4) |
| Mayoria requerida | 3/5 de cada Camara |
| Se dirige a | Presidentes del Congreso y Senado |
| Regulacion | LO 3/1981 (art. 54 CE) |

**Clave:** Cortes Generales (ambas Camaras) + 5 anos. Las trampas cambian "Cortes" por "Congreso" o "5" por "4". Las cuatro combinaciones posibles son las cuatro opciones de la pregunta.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "6f187eeb-17d8-4193-9e93-96c682c2ca5d");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LO 3/1981 art.2 DP Cortes 5 anos (" + exp3.length + " chars)");
})();
