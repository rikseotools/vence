require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.68.5 sufragio españoles fuera España "la ley" reconocerá
  const exp1 = `**Articulo 68.5 de la Constitucion Espanola - Sufragio de espanoles en el extranjero:**

> "**La ley** reconocera y **el Estado** facilitara el ejercicio del derecho de sufragio a los espanoles que se encuentren fuera del territorio de Espana."

**Por que B es correcta (la ley):**
El art. 68.5 CE distingue dos verbos con dos sujetos diferentes:
- **"La ley reconocera"** = es la ley la que otorga el reconocimiento juridico del derecho
- **"El Estado facilitara"** = el Estado es quien pone los medios practicos (consulados, voto por correo, etc.)

La pregunta dice "reconocera", por lo que la respuesta es **la ley** (B), no el Estado.

**Por que las demas son incorrectas:**

- **A)** "El Estado". Falso para "reconocera": el Estado es el sujeto del verbo "**facilitara**", no de "reconocera". Es la trampa principal de esta pregunta, porque ambos aparecen en la misma frase. El Estado pone los medios, pero quien reconoce juridicamente el derecho es la ley.

- **C)** "El Reglamento de las Camaras". Falso: los Reglamentos del Congreso y del Senado regulan el funcionamiento interno de las Camaras legislativas. No reconocen derechos de sufragio. Ademas, el art. 68.5 dice "la ley", que tiene rango normativo diferente al de un reglamento parlamentario.

- **D)** "El Gobierno". Falso: el Gobierno ejerce la funcion ejecutiva (art. 97 CE). No tiene la potestad de "reconocer" derechos de sufragio, que corresponde al legislador (la ley).

**Clave:** "La **ley** reconocera" (reconocimiento juridico) vs "el **Estado** facilitara" (medios practicos). Son dos acciones y dos sujetos distintos en la misma frase del art. 68.5.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "86d7c9b4-1eee-42cb-8aa3-9613e5c85cc7");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.68.5 sufragio ley reconocera (" + exp1.length + " chars)");

  // #2 - Ley 19/2013 art.15.1 datos ideología consentimiento expreso y por escrito
  const exp2 = `**Articulo 15.1 de la Ley 19/2013 (Transparencia) - Datos especialmente protegidos:**

> "Si la informacion solicitada contuviera datos personales que revelen la **ideologia, afiliacion sindical, religion o creencias**, el acceso unicamente se podra autorizar en caso de que se contase con el **consentimiento expreso y por escrito** del afectado, a menos que dicho afectado hubiese hecho **manifiestamente publicos** los datos con anterioridad a que se solicitase el acceso."

**Por que A es correcta:**
El art. 15.1 establece dos unicas vias para autorizar el acceso a estos datos especialmente sensibles: (1) **consentimiento expreso y por escrito** del afectado, o (2) que el afectado haya **publicado manifiestamente** esos datos antes de la solicitud. La opcion A recoge ambas.

**Por que las demas son incorrectas:**

- **B)** Dice que basta una "norma con rango de ley" **sin consentimiento** del afectado. Falso para datos de ideologia/religion: el art. 15.1 exige consentimiento expreso y por escrito o publicacion previa. La habilitacion por norma con rango de ley se aplica a **otros** datos sensibles (origen racial, salud, vida sexual, art. 15.2), no a los de ideologia/religion del art. 15.1.

- **C)** Dice que basta un "interes publico superior" **independiente del consentimiento**. Falso: para datos de ideologia, religion, afiliacion sindical y creencias, el consentimiento expreso y por escrito es requisito esencial (salvo publicacion previa). No existe una clausula de "interes publico superior" que lo sustituya en el art. 15.1.

- **D)** Habla de "consentimiento **implicito**". Falso: el art. 15.1 exige consentimiento **expreso y por escrito**, no implicito. Ademas, anade que baste que "los datos esten relacionados con una funcion publica", condicion que no aparece en el articulo.

**Niveles de proteccion de datos en el art. 15:**

| Tipo de dato | Requisito de acceso | Apartado |
|-------------|---------------------|----------|
| **Ideologia, religion, afiliacion sindical, creencias** | **Consentimiento expreso y por escrito** (o publicacion previa) | Art. 15.**1** |
| Origen racial, salud, vida sexual | Consentimiento expreso o habilitacion legal | Art. 15.**2** |
| Datos no especialmente protegidos | Ponderacion (interes publico vs privacidad) | Art. 15.**3** |

**Clave:** Datos de ideologia/religion = consentimiento **expreso y por escrito**. No vale implicito, ni norma legal, ni interes publico.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "4f672090-7857-4be8-b697-f4a74d0e053c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 19/2013 art.15 datos ideologia (" + exp2.length + " chars)");

  // #3 - Ley 19/2013 art.26 principios buen gobierno CE y ordenamiento
  const exp3 = `**Articulo 26.1 de la Ley 19/2013 (Transparencia) - Principios de buen gobierno:**

> "Las personas comprendidas en el ambito de aplicacion de este titulo observaran en el ejercicio de sus funciones lo dispuesto en la **Constitucion Espanola** y en el **resto del ordenamiento juridico** y promoveran el respeto a los derechos fundamentales y a las libertades publicas."

**Por que B es correcta (actuar de acuerdo con la CE y el ordenamiento juridico):**
El art. 26.1 establece como principio basico de buen gobierno que los altos cargos actuen conforme a la Constitucion y el resto del ordenamiento juridico. Es el principio de **legalidad** aplicado a la conducta de quienes ejercen funciones publicas de alto nivel.

**Por que las demas son incorrectas:**

- **A)** "Actuar **unicamente** segun sus criterios personales". Falso: es exactamente lo contrario del principio de legalidad. El art. 26.1 exige actuar conforme al ordenamiento juridico, no segun criterios personales. Los altos cargos deben ajustar su actuacion a la ley, no a sus preferencias individuales.

- **C)** "Priorizar los intereses **particulares** sobre los **generales**". Falso: el art. 26.2.a establece principios como la transparencia, eficacia y economica. Ademas, el art. 26.2.b.1 exige "no contraer obligaciones economicas ni intervenir en operaciones financieras [...] cuando pueda suponer un conflicto de intereses con su puesto". Los intereses generales prevalecen siempre.

- **D)** "Mantener la confidencialidad **absoluta** en todas las actuaciones". Falso: la propia Ley 19/2013 es la Ley de **Transparencia**, que promueve la publicidad activa y el acceso a la informacion. La confidencialidad absoluta seria contraria al espiritu de la ley. La transparencia, no el secretismo, es el principio rector.

**Clave:** Buen gobierno = actuar conforme a la CE y al ordenamiento juridico, promover derechos fundamentales. No confundir con criterios personales, intereses particulares ni secretismo.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "08b7b28e-ac6a-4b6d-81bb-6a469a88c6a2");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 19/2013 art.26 buen gobierno (" + exp3.length + " chars)");
})();
