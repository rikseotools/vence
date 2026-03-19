require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.116 Consejo Ministros estado sitio
  const exp1 = `**Articulo 116 de la Constitucion Espanola** (Estados excepcionales):

| Estado | Quien lo declara | Articulo |
|--------|-----------------|----------|
| **Alarma** | **Gobierno** (Consejo de Ministros) | 116.2 |
| **Excepcion** | **Gobierno**, con autorizacion previa del Congreso | 116.3 |
| **Sitio** | **Congreso** (mayoria absoluta), a propuesta del Gobierno | 116.4 |

**Por que C es la INCORRECTA (NO corresponde al Consejo de Ministros):**
El estado de **sitio** lo declara el **Congreso de los Diputados** por mayoria absoluta, a propuesta exclusiva del Gobierno. El Consejo de Ministros solo **propone**, pero no declara. Es la unica de las tres situaciones donde la declaracion corresponde al legislativo, no al ejecutivo.

**Por que las demas son correctas (SI corresponden al Consejo de Ministros):**

- **A)** "Aprobar proyectos de Ley y remitirlos al Congreso". SI: art. 5.1.b) de la Ley 50/1997 y art. 88 CE. El Gobierno aprueba proyectos de ley que remite a las Cortes.

- **B)** "Aprobar el Proyecto de Ley de PGE". SI: art. 5.1.b) de la Ley 50/1997 y art. 134.1 CE. Los PGE los elabora el Gobierno y los examina y aprueba las Cortes.

- **D)** "Declarar el estado de excepcion". SI: art. 116.3 CE. El Gobierno declara el estado de excepcion, aunque necesita autorizacion previa del Congreso.

**Clave:** Alarma y excepcion = Gobierno declara. Sitio = Congreso declara (a propuesta del Gobierno).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7e07a93d-ca13-4b08-a078-d6dd08f88a4a");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.116 estado sitio (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.47 nulidad pleno derecho
  const exp2 = `**Articulo 47.1.f) de la Ley 39/2015** (Nulidad de pleno derecho):

> "Son nulos de pleno derecho [...] **f)** Los actos **expresos o presuntos** contrarios al ordenamiento juridico por los que se adquieren **facultades o derechos** cuando se **carezca de los requisitos esenciales** para su adquisicion."

**Por que D es correcta:**
La opcion D reproduce literalmente el art. 47.1.f): los actos contrarios al ordenamiento por los que se adquieren derechos sin requisitos esenciales son **nulos de pleno derecho**, no simplemente anulables.

**Por que las demas son incorrectas:**

- **A)** "Son nulos de pleno derecho" (sin mas). Falso como respuesta generica: no todos los actos contrarios al ordenamiento son nulos de pleno derecho. La nulidad de pleno derecho (art. 47) es la excepcion; la regla general es la **anulabilidad** (art. 48.1: "son anulables los actos que incurran en cualquier infraccion del ordenamiento juridico").

- **B)** "Son, en todo caso, anulables". Falso: no "en todo caso". Hay supuestos del art. 47 que son nulos de pleno derecho, no meramente anulables. La anulabilidad es la regla general, pero tiene excepciones.

- **C)** "Son anulables cuando se adquieren facultades sin requisitos esenciales". Falso: este supuesto concreto (adquirir derechos sin requisitos esenciales) es de **nulidad de pleno derecho** (art. 47.1.f), no de anulabilidad.

**Nulidad vs anulabilidad:**
- **Nulidad** (art. 47): casos tasados, graves, efectos desde el inicio, imprescriptible
- **Anulabilidad** (art. 48): regla general, cualquier infraccion del ordenamiento`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "5f7241f8-4596-4dc1-9ac8-960550d5010f");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.47 nulidad (" + exp2.length + " chars)");
})();
