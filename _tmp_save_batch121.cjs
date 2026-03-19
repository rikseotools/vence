require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.80 sesion plenaria puerta cerrada mayoria absoluta
  const exp1 = `**Articulo 80 de la Constitucion Espanola:**

> "Las sesiones plenarias de las Camaras seran **publicas**, salvo acuerdo en contrario de cada Camara, adoptado por **mayoria absoluta** o con arreglo al Reglamento."

**Por que C es correcta (mayoria absoluta):**
La regla general es que las sesiones plenarias son **publicas** (principio de publicidad parlamentaria). Sin embargo, SI es posible celebrar una sesion a puerta cerrada si la Camara lo acuerda por **mayoria absoluta** de sus miembros, o conforme a lo que establezca su Reglamento.

**Por que las demas son incorrectas:**

- **A)** "No, en ningun caso". Falso: el art. 80 CE SI permite sesiones a puerta cerrada. "En ningun caso" es demasiado absoluto. La publicidad es la regla general, pero tiene excepcion.

- **B)** "Por mayoria de **tres quintos**". Falso: el art. 80 CE exige **mayoria absoluta**, no tres quintos. Tres quintos es la mayoria requerida para otros actos parlamentarios (ej: eleccion de vocales del CGPJ, Magistrados del TC), pero no para sesiones a puerta cerrada.

- **D)** "Por **mayoria simple**". Falso: la mayoria simple no es suficiente. Al tratarse de una excepcion al principio de publicidad, se requiere una mayoria **cualificada** (absoluta), no la simple. La mayoria simple es la regla general para los acuerdos (art. 79.2 CE), pero cerrar la sesion exige mas.

**Mayorias en la CE:**

| Mayoria | Significado | Ejemplo |
|---------|-------------|---------|
| Simple | Mas votos a favor que en contra (de los presentes) | Regla general (art. 79.2) |
| **Absoluta** | Mitad +1 de los miembros totales | **Puerta cerrada** (art. 80) |
| 3/5 | Tres quintos de los miembros | Vocales CGPJ, Magistrados TC |
| 2/3 | Dos tercios | Reforma agravada (art. 168) |

**Clave:** Sesion a puerta cerrada = mayoria absoluta (no simple, no 3/5). La publicidad es la regla; la excepcion requiere mayoria cualificada.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "229f1270-aa52-4fef-abd1-890b48ed007c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.80 puerta cerrada (" + exp1.length + " chars)");

  // #2 - LOTC art.32 recurso inconstitucionalidad 40 vs 50 Diputados
  const exp2 = `**Articulo 32.1 de la LOTC (LO 2/1979):**

> "Estan legitimados para el ejercicio del recurso de inconstitucionalidad [...]:
> a) El Presidente del Gobierno.
> b) El Defensor del Pueblo.
> c) **Cincuenta** Diputados.
> d) **Cincuenta** Senadores."

**Por que B es la INCORRECTA (y por tanto la respuesta):**
La opcion B dice "**Cuarenta** Diputados", pero el art. 32.1.c) LOTC exige **Cincuenta** Diputados (50), no cuarenta (40). La trampa es cambiar el numero: 40 suena plausible pero no es el dato correcto. El numero 50 se aplica tanto a Diputados como a Senadores.

**Por que las demas SI estan legitimadas (art. 32.1):**

- **A)** "El Presidente del Gobierno". **SI**: art. 32.1.a). El Presidente puede recurrir cualquier norma con fuerza de ley.

- **C)** "El Defensor del Pueblo". **SI**: art. 32.1.b). El Defensor del Pueblo esta legitimado para interponer recurso de inconstitucionalidad como garantia de los derechos de los ciudadanos.

- **D)** "Cincuenta Senadores". **SI**: art. 32.1.d). 50 Senadores pueden interponer el recurso, igual que 50 Diputados.

**Legitimados para el recurso de inconstitucionalidad (art. 32 LOTC):**
- Presidente del Gobierno
- Defensor del Pueblo
- **50** Diputados (no 40)
- **50** Senadores
- Organos ejecutivos y Asambleas de CCAA (solo para normas que afecten a su autonomia)

**Clave:** Son 50 Diputados y 50 Senadores, no 40. La trampa tipica es cambiar el numero.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "c9737a31-0cd0-49b5-b1a9-812698b7600f");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOTC art.32 recurso inconst 50 diputados (" + exp2.length + " chars)");
})();
