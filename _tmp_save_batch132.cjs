require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE publicacion BOE y entrada en vigor 29 diciembre 1978
  const exp1 = `**Disposicion Final de la Constitucion Espanola:**

> "Esta Constitucion entrara en vigor el mismo dia de la publicacion de su texto oficial en el Boletin Oficial del Estado."

**Por que A es correcta (29 de diciembre de 1978):**
La CE se publico en el BOE el **29 de diciembre de 1978** y, segun su propia Disposicion Final, entro en vigor **ese mismo dia**. No hay vacatio legis: publicacion y vigor coinciden.

**Fechas clave de la CE:**
- **31 octubre 1978**: aprobada por las Cortes
- **6 diciembre 1978**: aprobada en **referendum** por el pueblo espanol
- **27 diciembre 1978**: **sancionada** por el Rey ante las Cortes
- **29 diciembre 1978**: publicada en el **BOE** y **entrada en vigor**

**Por que las demas son incorrectas:**

- **B)** "El 7 de diciembre de 1978". Falso: el 7 de diciembre no corresponde a ningun hito de la CE. El dia anterior (6 de diciembre) es la fecha del referendum, que se celebra como **Dia de la Constitucion**. La trampa confunde el dia del referendum con el de publicacion.

- **C)** "El 27 de diciembre de 1978". Falso: el 27 de diciembre es la fecha de **sancion regia**, no de publicacion ni de entrada en vigor. El Rey sanciono la CE dos dias antes de su publicacion en el BOE.

- **D)** "El 29 de diciembre se publico en el BOE, entrando en vigor un dia despues". Falso: la CE entro en vigor el **mismo dia** de su publicacion (29 de diciembre), no al dia siguiente. Su Disposicion Final no establece ningun plazo de vacatio legis.

**Clave:** Publicacion + entrada en vigor = 29 de diciembre de 1978 (mismo dia). Referendum = 6 de diciembre. Sancion = 27 de diciembre.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "1ea9beef-af32-4d6f-adc4-c8b85fa3fcff");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE 29 diciembre BOE vigor (" + exp1.length + " chars)");

  // #2 - LOREG art.179 concejales 20.000 residentes = 17
  const exp2 = `**Articulo 179.1 de la LO 5/1985 (LOREG) - Escala de concejales:**

> | Residentes | Concejales |
> |-----------|-----------|
> | Hasta 100 | 3 |
> | 101 a 250 | 5 |
> | 251 a 1.000 | 7 |
> | 1.001 a 2.000 | 9 |
> | 2.001 a 5.000 | 11 |
> | 5.001 a 10.000 | 13 |
> | **10.001 a 20.000** | **17** |
> | 20.001 a 50.000 | 21 |
> | 50.001 a 100.000 | 25 |

**Por que B es correcta (17 concejales):**
Un municipio con **20.000 residentes** esta en el tramo "de 10.001 a 20.000", al que corresponden **17 concejales**. 20.000 es exactamente el limite superior de este tramo, por lo que se incluye en el (no en el siguiente).

**Por que las demas son incorrectas:**

- **A)** "13". Falso: 13 concejales corresponden al tramo "de 5.001 a 10.000". Un municipio de 20.000 residentes esta por encima de este tramo.

- **C)** "25". Falso: 25 concejales corresponden al tramo "de 50.001 a 100.000". Un municipio de 20.000 residentes esta muy por debajo de este tramo.

- **D)** "21". Falso: 21 concejales corresponden al tramo "de **20.001** a 50.000". Como el municipio tiene exactamente 20.000 (no 20.001), esta en el tramo inferior (10.001 a 20.000 = 17). La trampa esta en confundir 20.000 con 20.001.

**Clave:** 20.000 residentes = tramo 10.001-20.000 = **17** concejales. Cuidado: si fueran 20.001, serian 21. El limite superior se incluye en el tramo.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "6bd9ce5c-e37f-48e0-900f-c0670da8cebd");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOREG art.179 concejales 17 (" + exp2.length + " chars)");
})();
