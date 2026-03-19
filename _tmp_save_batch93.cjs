require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/1981 art.9 Defensor del Pueblo de oficio o a instancia de parte
  const exp1 = `**Articulo 9.1 de la LO 3/1981 del Defensor del Pueblo:**

> "El Defensor del Pueblo podra iniciar y proseguir **de oficio o a peticion de parte**, cualquier investigacion conducente al esclarecimiento de los actos y resoluciones de la Administracion publica y sus agentes, en relacion con los ciudadanos [...]"

**Por que D es correcta (de oficio o a instancia de parte):**
El art. 9.1 establece que el Defensor del Pueblo tiene dos vias para iniciar investigaciones:
1. **De oficio**: por iniciativa propia, sin necesidad de que nadie se lo pida
2. **A peticion de parte**: cuando un ciudadano presenta una queja

Ambas vias son validas e independientes. No se limita a una sola.

**Por que las demas son incorrectas:**

- **A)** "**Exclusivamente** de oficio". Falso: la palabra "exclusivamente" es incorrecta. El Defensor puede actuar de oficio, pero tambien a peticion de parte. El art. 9.1 menciona expresamente ambas posibilidades.

- **B)** "**Unicamente** a instancia de parte". Falso: igual que la anterior, la palabra "unicamente" limita una potestad que es doble. El Defensor no necesita esperar a que un ciudadano se queje; puede investigar por iniciativa propia.

- **C)** "A instancia del interesado o por solicitud de la **Comision Mixta Congreso-Senado**". Falso: aunque existe una Comision Mixta de relaciones con el Defensor del Pueblo, el art. 9.1 no la menciona como via de inicio de investigaciones. Las dos vias son "de oficio" y "a peticion de parte", no la Comision Mixta.

**Inicio de investigaciones del Defensor del Pueblo (art. 9.1):**
- **De oficio**: por iniciativa propia
- **A peticion de parte**: por queja de un ciudadano
- Las dos son posibles (nunca "exclusivamente" una)

**Clave:** "De oficio O a peticion de parte" (no exclusivamente una). La Comision Mixta no es una via de inicio de investigaciones.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "09ee2fc4-4b72-4273-9b49-0dcd366f565d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/1981 Defensor Pueblo (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.3.c capacidad de obrar grupos afectados
  const exp2 = `**Articulo 3.c) de la Ley 39/2015:**

> "Tendran capacidad de obrar ante las Administraciones Publicas: [...] c) Los **grupos de afectados**, las uniones y entidades sin personalidad juridica y los patrimonios independientes o autonomos, cuando **la ley** asi lo declare expresamente."

**Por que D es correcta (cuando la ley lo declare expresamente):**
Los grupos de afectados y entidades sin personalidad juridica no tienen capacidad de obrar automatica. Necesitan que una **ley** (en sentido formal, aprobada por las Cortes o el Parlamento autonomico) les reconozca expresamente esa capacidad. No basta con cualquier norma; debe ser una **ley**.

**Por que las demas son incorrectas:**

- **A)** "No tendran capacidad de obrar". Falso: SI pueden tener capacidad de obrar, pero condicionada a que una ley lo declare expresamente. No es una prohibicion absoluta; es una capacidad condicionada.

- **B)** "Cuando una **disposicion de caracter general** asi lo declare". Falso: el art. 3.c) dice "la **ley**", no "disposicion de caracter general". Una "disposicion de caracter general" es un termino mas amplio que incluiria reglamentos y ordenes ministeriales. El articulo exige especificamente una ley.

- **C)** "Cuando un **reglamento** asi lo declare". Falso: un reglamento es una norma de rango inferior a la ley, aprobada por el poder ejecutivo. El art. 3.c) exige una **ley**, no un reglamento. El reglamento no puede atribuir capacidad de obrar a estos grupos.

**Capacidad de obrar ante las AAPP (art. 3 Ley 39/2015):**

| Sujeto | Capacidad |
|--------|-----------|
| Personas fisicas/juridicas | Segun normas civiles (art. 3.a) |
| Menores de edad | Para derechos que el ordenamiento permita sin asistencia (art. 3.b) |
| **Grupos de afectados** | Solo cuando una **ley** lo declare expresamente (art. 3.c) |

**Clave:** "La ley" (no reglamento, no disposicion general). Es una reserva de ley para reconocer capacidad a entes sin personalidad.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "cff46c0d-d963-4e4f-bd20-9fc55c6a3ef5");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 capacidad grupos (" + exp2.length + " chars)");

  // #3 - CE art.149.1.12 competencia exclusiva pesas y medidas
  const exp3 = `**Articulo 149.1.12a de la Constitucion Espanola:**

> "El Estado tiene competencia exclusiva sobre las siguientes materias: [...] 12.a **Legislacion sobre pesas y medidas**, determinacion de la hora oficial."

**Por que C es correcta (legislacion sobre pesas y medidas):**
"Pesas y medidas" es materia de competencia **exclusiva** del Estado segun el art. 149.1.12a CE. Esto tiene logica: las unidades de medida y los patrones de peso deben ser uniformes en todo el territorio para garantizar la seguridad juridica en el comercio y la industria.

**Por que las demas son incorrectas (son competencias autonómicas, no exclusivas del Estado):**

- **A)** "Sanidad e higiene". Falso: la sanidad es una **competencia compartida**. El art. 149.1.16a CE da al Estado solo las "bases y coordinacion general de la sanidad" y la "sanidad exterior". Pero el art. 148.1.21a permite a las CCAA asumir competencias en "sanidad e higiene". No es exclusiva del Estado.

- **B)** "Asistencia social". Falso: la asistencia social es una **competencia autonomica**. El art. 148.1.20a CE permite a las CCAA asumir "asistencia social". No aparece en el art. 149.1 como competencia estatal. De hecho, es una de las competencias mas claramente autonomicas.

- **D)** "Ordenacion del territorio, urbanismo y vivienda". Falso: son competencias **autonomicas**. El art. 148.1.3a CE permite a las CCAA asumir "ordenacion del territorio, urbanismo y vivienda". No figuran como competencia exclusiva del Estado en el art. 149.1.

**Ejemplos de competencias:**

| Materia | Competencia |
|---------|-------------|
| **Pesas y medidas** | **Exclusiva Estado** (149.1.12a) |
| Sanidad | Compartida (bases Estado, gestion CCAA) |
| Asistencia social | **CCAA** (148.1.20a) |
| Urbanismo y vivienda | **CCAA** (148.1.3a) |

**Clave:** Las opciones A, B y D son competencias de las CCAA (art. 148.1). Solo "pesas y medidas" es exclusiva del Estado (149.1.12a).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "1b9b780c-9200-43dc-b402-6335700dd564");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.149.1 pesas y medidas (" + exp3.length + " chars)");
})();
