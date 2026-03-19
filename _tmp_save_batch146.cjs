require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/1981 art.2 Comision Mixta funcion relacionarse con Defensor
  const exp1 = `**Articulo 2.Dos de la LO 3/1981 (Defensor del Pueblo):**

> "Se designara en las Cortes Generales una Comision Mixta Congreso-Senado encargada de **relacionarse con el Defensor del Pueblo** e **informar a los respectivos Plenos** en cuantas ocasiones sea necesario."

**Por que D es correcta (relacionarse con el Defensor del Pueblo):**
El art. 2.2 atribuye a la Comision Mixta dos funciones: (1) **relacionarse** con el Defensor del Pueblo, y (2) **informar** a los Plenos de las Camaras. La opcion D recoge la primera funcion.

**Por que las demas son incorrectas:**

- **A)** "Nombrar al Defensor del Pueblo, asi como a los adjuntos". Falso: la Comision Mixta **propone candidatos** (art. 2.3), pero no los nombra. Quien elige al Defensor son los **Plenos** del Congreso (3/5) y del Senado (3/5). Para los adjuntos, la Comision otorga **conformidad previa** (art. 2.6), pero es el Defensor quien los propone. La trampa confunde proponer/dar conformidad con nombrar.

- **B)** "Adoptar los acuerdos del Defensor del Pueblo, por mayoria absoluta". Doblemente falso: (1) los acuerdos de la Comision se adoptan por **mayoria simple** (art. 2.3), no absoluta; (2) son acuerdos de **la Comision**, no "del Defensor del Pueblo". La trampa cambia el tipo de mayoria y confunde el sujeto de los acuerdos.

- **C)** "Informar a los respectivos **organismos publicos**". Falso: el art. 2.2 dice "informar a los respectivos **Plenos**" (de las Camaras), no a "organismos publicos". La trampa cambia el destinatario de la informacion.

**Funciones de la Comision Mixta (art. 2 LO 3/1981):**
1. **Relacionarse** con el Defensor del Pueblo (art. 2.2)
2. **Informar** a los Plenos (art. 2.2)
3. **Proponer** candidatos (art. 2.3, acuerdos por mayoria simple)
4. **Conformidad previa** para nombrar adjuntos (art. 2.6)

**Clave:** Relacionarse con el Defensor e informar a los Plenos. No nombra (propone), no mayoria absoluta (simple), no organismos publicos (Plenos).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "fca18fb2-df6c-47b2-90e0-341662b68df2");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/1981 Comision Mixta relacionarse (" + exp1.length + " chars)");

  // #2 - LO 3/1981 art.2.5 sucesivas propuestas 3/5 Congreso + mayoria absoluta Senado
  const exp2 = `**Articulo 2 de la LO 3/1981 - Designacion del Defensor del Pueblo:**

**Primera ronda (art. 2.4):**
> 3/5 del Congreso + ratificacion por 3/5 del Senado (en 20 dias)

**Segunda ronda - sucesivas propuestas (art. 2.5):**
> "Caso de no alcanzarse las mencionadas mayorias, se procedera en nueva sesion de la Comision, y en el plazo maximo de un mes, a formular sucesivas propuestas. En tales casos, una vez conseguida la mayoria de los **tres quintos** en el Congreso, la designacion quedara realizada al alcanzarse la **mayoria absoluta** del Senado."

**Por que B es correcta (3/5 Congreso + mayoria absoluta Senado):**
En el procedimiento de sucesivas propuestas (segunda ronda), el art. 2.5 mantiene los **3/5 en el Congreso** pero rebaja la exigencia del Senado a **mayoria absoluta** (en vez de 3/5). Este mecanismo busca facilitar la designacion cuando no se logra unanimidad en ambas Camaras.

**Por que las demas son incorrectas (cambian las mayorias):**

- **A)** "Mayoria de los **dos tercios** en el Congreso + mayoria absoluta del Senado". Falso: el art. 2.5 dice "tres quintos" (3/5) en el Congreso, no "dos tercios" (2/3). 3/5 = 60%, 2/3 = 66,7%. La trampa sube la exigencia en el Congreso.

- **C)** "Mayoria de los **dos tercios** en el Congreso + **dos tercios** del Senado". Doblemente falso: cambia 3/5 por 2/3 tanto en Congreso como en Senado. Ademas, en la segunda ronda el Senado requiere mayoria absoluta, no cualificada.

- **D)** "Mayoria de los tres quintos en el Congreso + **dos tercios** del Senado". Falso: acierta en el Congreso (3/5) pero yerra en el Senado. El art. 2.5 dice "mayoria absoluta" del Senado, no "dos tercios".

**Mayorias para designar al Defensor del Pueblo:**

| Ronda | Congreso | Senado |
|-------|----------|--------|
| Primera (art. 2.4) | 3/5 | 3/5 |
| **Segunda (art. 2.5)** | **3/5** | **Mayoria absoluta** |

**Clave:** En sucesivas propuestas: 3/5 Congreso (se mantiene) + mayoria absoluta Senado (se rebaja). No "dos tercios" en ningun caso.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "74a30488-44a2-457e-8c72-d6358b601b6d");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/1981 art.2.5 sucesivas propuestas (" + exp2.length + " chars)");
})();
