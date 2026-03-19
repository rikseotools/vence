require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.57.2 Príncipe Heredero dignidad Príncipe de Asturias
  const exp1 = `**Articulo 57.2 de la Constitucion Espanola - Principe de Asturias:**

> "El Principe heredero, **desde su nacimiento** o **desde que se produzca el hecho que origine el llamamiento**, tendra la dignidad de Principe de Asturias y los demas titulos vinculados tradicionalmente al sucesor de la Corona de Espana."

**Por que D es correcta (A y C son correctas):**
El art. 57.2 CE contempla **dos momentos** en los que el Principe heredero adquiere la dignidad de Principe de Asturias:
1. **Desde su nacimiento** (opcion A) - cuando nace siendo ya heredero (por ejemplo, el primer hijo del Rey).
2. **Desde que se produzca el hecho que origine el llamamiento** (opcion C) - cuando el llamamiento a la sucesion se produce despues del nacimiento (por ejemplo, por fallecimiento o renuncia del anterior heredero).

Ambas son correctas porque el articulo usa la conjuncion disyuntiva "o", indicando que son **dos supuestos alternativos**. La opcion D ("Son correctas la A y la C") recoge ambos supuestos.

**Por que las demas son incorrectas:**

- **A)** "Desde su nacimiento." **Parcialmente correcta** pero incompleta: solo recoge uno de los dos supuestos del art. 57.2. No contempla el caso de que el llamamiento se produzca despues del nacimiento. Al ser una respuesta incompleta, no es la mejor opcion cuando existe D.

- **B)** "Desde que alcance la **mayoria de edad**." Falso: la mayoria de edad (18 anos, art. 12 CE) no tiene relacion con la adquisicion de la dignidad de Principe de Asturias. El heredero ostenta el titulo desde su nacimiento o llamamiento, independientemente de su edad. La mayoria de edad es relevante para ejercer como Rey (art. 59.1), pero no para el titulo de Principe.

- **C)** "Desde que se produzca el hecho que origine el llamamiento." **Parcialmente correcta** pero incompleta: solo recoge el segundo supuesto. No contempla el caso del heredero que lo es desde su nacimiento.

**Momentos de adquisicion de la dignidad de Principe de Asturias (art. 57.2 CE):**

| Supuesto | Ejemplo |
|----------|---------|
| **Desde su nacimiento** | Nace como primer hijo del Rey |
| **Desde el hecho del llamamiento** | El anterior heredero fallece o renuncia |

**Clave:** El art. 57.2 contempla dos momentos alternativos ("nacimiento" o "hecho del llamamiento"). Cuando una pregunta incluye opciones parcialmente correctas y una opcion que las agrupa, la respuesta suele ser la que agrupa ambas.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "b1a6f670-585c-4d53-8166-9d4d0fa24914");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.57.2 Principe Asturias (" + exp1.length + " chars)");

  // #2 - CE art.65.2 actos Rey exceptuados refrendo (Casa Real)
  const exp2 = `**Articulos 56.3 y 65.2 de la Constitucion Espanola - Refrendo y Casa Real:**

> Art. 56.3: "La persona del Rey es inviolable y no esta sujeta a responsabilidad. Sus actos estaran siempre **refrendados** en la forma establecida en el articulo 64, **careciendo de validez sin dicho refrendo, salvo lo dispuesto en el articulo 65, 2.**"
>
> Art. 65.2: "El Rey **nombra y releva libremente** a los miembros civiles y militares de su Casa."

**Por que A es correcta (nombrar miembros Casa Real no necesita refrendo):**
El art. 56.3 CE establece que todos los actos del Rey necesitan refrendo, **salvo lo dispuesto en el art. 65.2**. Este articulo permite al Rey nombrar y relevar **libremente** a los miembros de su Casa, lo que significa que estos actos **no requieren refrendo**. Es la unica excepcion expresamente prevista en la Constitucion al requisito general de refrendo.

**Por que las demas son incorrectas (si requieren refrendo):**

- **B)** "La **separacion de los Ministros**." Incorrecto como excepcion: la separacion de Ministros (art. 62.e CE: "Nombrar y separar a los miembros del Gobierno, a propuesta de su Presidente") es un acto del Rey que **si requiere refrendo** del Presidente del Gobierno (art. 64.1 CE).

- **C)** "El nombramiento del **Presidente del Gobierno**." Incorrecto como excepcion: el nombramiento del Presidente (art. 62.d CE) **si requiere refrendo**, en este caso del Presidente del Congreso de los Diputados (art. 64.1 CE), ya que no hay Presidente del Gobierno saliente que pueda refrendar.

- **D)** "La acreditacion de los **embajadores extranjeros** en Espana." Incorrecto como excepcion: el art. 63.1 CE establece que "El Rey acredita a los embajadores y otros representantes diplomaticos." Este acto **si requiere refrendo** del Ministro de Asuntos Exteriores o del Presidente del Gobierno.

**Refrendo de actos del Rey:**

| Acto | Refrendo |
|------|----------|
| Nombrar/relevar miembros Casa Real (art. 65.2) | **NO (unica excepcion)** |
| Separar Ministros (art. 62.e) | Si - Presidente del Gobierno |
| Nombrar Presidente del Gobierno (art. 62.d) | Si - Presidente del Congreso |
| Acreditar embajadores (art. 63.1) | Si - Ministro Exteriores/Presidente |

**Clave:** El art. 56.3 CE exceptua expresamente el art. 65.2 del requisito de refrendo. Es la unica excepcion constitucional: el Rey nombra y releva libremente a los miembros de su Casa.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "5a0795d0-ec67-4403-941c-0498c0af6062");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.65.2 refrendo excepcion Casa Real (" + exp2.length + " chars)");

  // #3 - CE art.65.1 Título II respuesta correcta (presupuestos Casa Real)
  const exp3 = `**Articulo 65.1 de la Constitucion Espanola - Presupuesto de la Casa Real:**

> "El Rey recibe de los Presupuestos del Estado una **cantidad global** para el sostenimiento de su Familia y Casa, y **distribuye libremente** la misma."

**Por que A es correcta (cantidad global, distribucion libre):**
La opcion A reproduce literalmente el art. 65.1 CE. El Rey recibe una cantidad global (no partidas desglosadas) de los Presupuestos del Estado y la distribuye libremente (sin necesidad de justificacion ni control previo). Esta es una de las manifestaciones de la autonomia de la Casa Real.

**Por que las demas son incorrectas (alteran el texto constitucional):**

- **B)** "Corresponde al Rey declarar la guerra y hacer la paz, previa autorizacion del **Congreso de los Diputados**." Falso: el art. 63.3 CE dice "previa autorizacion de las **Cortes Generales**", no solo del Congreso. Las Cortes Generales incluyen tanto el Congreso como el Senado (art. 66.1 CE). La autorizacion debe ser de ambas Camaras, no solo del Congreso.

- **C)** "El Rey ejerce el derecho de gracia con arreglo a la ley, que **podra autorizar indultos generales**." Falso: el art. 62.i) CE dice exactamente lo contrario: "Ejercer el derecho de gracia con arreglo a la ley, que **no podra autorizar indultos generales**." La Constitucion prohibe expresamente los indultos generales; solo caben indultos particulares (individuales).

- **D)** "El Rey **presta el consentimiento** del Estado para obligarse por medio de tratados." Falso: el art. 63.2 CE dice que "al Rey corresponde **manifestar el consentimiento** del Estado para obligarse internacionalmente por medio de tratados." La palabra correcta es "**manifestar**", no "prestar". El Rey manifiesta (exterioriza) un consentimiento que ha sido autorizado previamente por las Cortes (art. 94 CE).

**Errores tipicos en preguntas sobre el Titulo II CE:**

| Articulo | Texto correcto | Trampa habitual |
|----------|---------------|-----------------|
| Art. 63.3 | Cortes **Generales** | Congreso de los Diputados |
| Art. 62.i) | **No** podra autorizar indultos generales | Podra autorizar |
| Art. 63.2 | **Manifestar** el consentimiento | Prestar el consentimiento |
| Art. 65.1 | Cantidad **global**, distribuye **libremente** | (correcto tal cual) |

**Clave:** La opcion A cita literalmente el art. 65.1 CE. Las demas alteran palabras clave: "Congreso" por "Cortes Generales", eliminan el "no" en indultos generales, o cambian "manifestar" por "prestar".`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "a22230f3-07c1-4a47-9b70-eec0ada3fb1a");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.65.1 Titulo II presupuesto Casa Real (" + exp3.length + " chars)");
})();
