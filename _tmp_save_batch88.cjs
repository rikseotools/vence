require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.108 Gobierno responde solidariamente ante el Congreso
  const exp1 = `**Articulo 108 de la Constitucion Espanola:**

> "El Gobierno responde **solidariamente** en su gestion politica ante el **Congreso de los Diputados**."

**Por que C es correcta (Congreso de los Diputados):**
El art. 108 CE es muy breve pero contiene dos claves:
1. El Gobierno responde ante el **Congreso** (no ante el Senado, ni ante ambas Camaras)
2. La responsabilidad es **solidaria** (todo el Gobierno responde como un bloque)

Esto se conecta con los mecanismos de control: la **mocion de censura** (art. 113) y la **cuestion de confianza** (art. 112) se plantean ante el **Congreso**, no ante el Senado.

**Por que las demas son incorrectas:**

- **A)** "Las **Cortes Generales**". Falso y trampa frecuente: las Cortes Generales son el Congreso + el Senado (art. 66.1 CE). Pero la responsabilidad politica del Gobierno es solo ante el **Congreso**, no ante las Cortes Generales en su conjunto. El Senado no puede exigir responsabilidad politica al Gobierno.

- **B)** "El Pleno del Consejo General del Poder Judicial". Falso: el CGPJ es el organo de gobierno del Poder Judicial (art. 122 CE). No tiene ninguna relacion con la responsabilidad politica del Gobierno, que es un mecanismo del poder legislativo sobre el ejecutivo.

- **D)** "El Senado". Falso: el Senado puede interpelar y preguntar al Gobierno, pero NO puede exigirle responsabilidad politica. No puede presentar mocion de censura ni cuestion de confianza. Esos mecanismos son exclusivos del Congreso.

**Responsabilidad politica del Gobierno (art. 108 CE):**
- Responde ante: **Congreso de los Diputados** (no Senado, no Cortes Generales)
- Forma: **solidariamente** (todo el Gobierno junto)
- Mecanismos: mocion de censura (art. 113) y cuestion de confianza (art. 112)

**Clave:** Congreso (no Cortes Generales). La trampa clasica es confundir "Cortes Generales" con "Congreso".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a69b00db-3dc1-403a-81bc-b4d44db9352b");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.108 responsabilidad Gobierno (" + exp1.length + " chars)");

  // #2 - CE art.167 reforma 1992 referendum no obligatorio
  const exp2 = `**Articulo 167 de la Constitucion Espanola (reforma ordinaria):**

> "167.3. Aprobada la reforma por las Cortes Generales, sera sometida a **referendum** para su ratificacion cuando asi lo soliciten, dentro de los quince dias siguientes a su aprobacion, **una decima parte de los miembros de cualquiera de las Camaras**."

**Por que B es correcta:**
En 1992 se modifico el art. 13.2 CE (para permitir el sufragio pasivo de extranjeros en elecciones municipales, requisito del Tratado de Maastricht). Esta reforma se hizo por el **art. 167** (reforma ordinaria) porque el art. 13 no esta entre los articulos protegidos por el art. 168.

En la reforma ordinaria (art. 167), el referendum **no es obligatorio**: solo se celebra si lo solicita **1/10 de los miembros** de cualquiera de las Camaras en los 15 dias siguientes. En 1992 nadie lo solicito (hubo consenso total), por lo que no se celebro referendum.

**Por que las demas son incorrectas:**

- **A)** "Si, porque se trataba de un caso de reforma del art. 167". Error en la consecuencia: aunque es correcto que se aplico el art. 167, el referendum en el 167 es **facultativo**, no obligatorio. Esta opcion acierta el procedimiento pero yerra en el caracter del referendum.

- **C)** "Si, porque se trataba de un caso de revision del art. 168". Doble error: no se aplico el art. 168 (que es para Titulo Preliminar, Seccion 1a Cap. II Titulo I, y Titulo II), y ademas la pregunta ya contiene la conclusion erronea de que era obligatorio.

- **D)** "No era obligatoria... al ser un caso de revision del art. 168". Error en el procedimiento: acierta en que no hubo referendum obligatorio, pero dice que fue por el art. 168, cuando en realidad fue por el art. 167. En el art. 168 el referendum SI es obligatorio.

**Reforma vs Revision constitucional:**

| Aspecto | Art. 167 (reforma) | Art. 168 (revision) |
|---------|-------------------|-------------------|
| Ambito | Cualquier articulo no protegido | T. Preliminar, Sec. 1a Cap. II T. I, Titulo II |
| Referendum | **Facultativo** (si 1/10 lo pide) | **Obligatorio** |
| Mayorias | 3/5 de cada Camara | 2/3 + disolucion + 2/3 nuevas Camaras |

**Clave:** Art. 167 = referendum facultativo. Art. 168 = referendum obligatorio. En 1992 se uso el 167 y nadie pidio referendum.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "5d8fb750-d2ff-4828-aebf-b0e0ebcb9101");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.167 reforma 1992 (" + exp2.length + " chars)");

  // #3 - Ley 40/2015 art.30 prescripcion infracciones
  const exp3 = `**Articulo 30.1 de la Ley 40/2015:**

> "Si estas no fijan plazos de prescripcion, las infracciones **muy graves** prescribiran a los **tres anos**, las **graves** a los **dos anos** y las **leves** a los **seis meses**; las sanciones impuestas por faltas muy graves prescribiran a los tres anos, las impuestas por faltas graves a los dos anos y las impuestas por faltas leves al ano."

**Por que D es correcta (3 anos, 2 anos, 6 meses):**
El art. 30.1 establece los plazos **supletorios** de prescripcion de infracciones (se aplican cuando la ley especifica no fija plazos):
- Muy graves: **3 anos**
- Graves: **2 anos**
- Leves: **6 meses**

**Por que las demas son incorrectas (cambian los plazos):**

- **A)** "Muy graves 3 meses, graves 2 meses, leves 1 mes". Falso: cambia **anos** por **meses** en todos los plazos. 3 meses para una infraccion muy grave seria absurdamente corto. La trampa es cambiar la unidad de tiempo.

- **B)** "Muy graves 1 ano, graves 6 meses, leves 3 meses". Falso: reduce todos los plazos significativamente. Ni las muy graves ni las graves tienen estos plazos en el art. 30.

- **C)** "Muy graves 3 anos, graves 2 anos, leves **1 ano**". Falso: las muy graves y graves estan bien, pero cambia las leves de **6 meses** a **1 ano**. Trampa sutil: 1 ano es el plazo de prescripcion de las **sanciones** leves, no de las **infracciones** leves.

**Prescripcion art. 30.1 Ley 40/2015 (plazos supletorios):**

| Gravedad | **Infracciones** | **Sanciones** |
|----------|-----------------|--------------|
| Muy graves | 3 anos | 3 anos |
| Graves | 2 anos | 2 anos |
| **Leves** | **6 meses** | **1 ano** |

**Clave:** La trampa principal es la opcion C: confunde el plazo de infracciones leves (6 meses) con el de sanciones leves (1 ano). Los plazos de infracciones y sanciones son iguales salvo en las leves.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "c1f23c9b-a178-4713-8e51-025a28051192");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 40/2015 prescripcion infracciones (" + exp3.length + " chars)");
})();
