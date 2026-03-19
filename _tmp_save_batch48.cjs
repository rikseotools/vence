require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RDL 1/2013 art.2 Normalizacion
  const exp1 = `**Articulo 2 del RDL 1/2013** (Definiciones):

Cada opcion corresponde a un **principio diferente** definido en el art. 2:

| Opcion | Principio | Letra art. 2 |
|--------|-----------|-------------|
| A | **Transversalidad** | art. 2.l |
| **B** | **Normalizacion** | **art. 2.i** |
| C | **Vida independiente** | art. 2.k |
| D | **Inclusion social** | art. 2.m |

**Por que B es correcta (Normalizacion):**

> "**Normalizacion**: es el principio en virtud del cual las personas con discapacidad deben poder llevar una vida **en igualdad de condiciones**, accediendo a los **mismos lugares, ambitos, bienes y servicios** que estan a disposicion de cualquier otra persona."

La normalizacion se centra en que las personas con discapacidad accedan a lo mismo que el resto, no a servicios especiales separados.

**Por que las demas son incorrectas (son otros principios):**

- **A)** Es la **transversalidad** (art. 2.l): las actuaciones de las Administraciones Publicas no se limitan a planes especificos para personas con discapacidad, sino que comprenden las **politicas generales** en cualquier ambito. Se refiere a como las Administraciones integran la discapacidad en todas sus politicas.

- **C)** Es la **vida independiente** (art. 2.k): la persona con discapacidad ejerce el **poder de decision sobre su propia existencia** y participa activamente en la vida de su comunidad. Se refiere a la autonomia personal y al libre desarrollo de la personalidad.

- **D)** Es la **inclusion social** (art. 2.m): la sociedad promueve valores compartidos para que todas las personas con discapacidad tengan oportunidades y recursos para participar **plenamente** en la vida politica, economica, social, etc.

**Clave para distinguirlos:**
- Normalizacion = acceder a lo **mismo** que los demas
- Transversalidad = politicas **generales** (no solo especificas)
- Vida independiente = **decidir** por si mismo
- Inclusion social = **participar** plenamente en la sociedad`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "74f77540-40b6-441c-a9ef-0685039e405e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RDL 1/2013 normalizacion (" + exp1.length + " chars)");

  // #2 - Ley 39/2006 art.15 atencion residencial
  const exp2 = `**Articulo 15.1.e) de la Ley 39/2006** (Catalogo de servicios - Servicio de Atencion Residencial):

> "Servicio de **Atencion Residencial**: Residencia de personas mayores en situacion de dependencia. Centro de atencion a personas en situacion de dependencia, en razon de los distintos tipos de discapacidad."

**Por que D es correcta (A y B son correctas):**
El Servicio de Atencion Residencial comprende **dos tipos** de centros:
1. **Residencia de personas mayores** en situacion de dependencia (opcion A)
2. **Centro de atencion** a personas en situacion de dependencia, segun tipos de discapacidad (opcion B)

Ambos estan incluidos en el art. 15.1.e), por lo que A y B son correctas.

**Por que C es incorrecta:**
El "**Centro de Dia de atencion especializada**" NO pertenece al Servicio de Atencion Residencial. Es una subcategoria del **Servicio de Centro de Dia y de Noche** (art. 15.1.d), que es un servicio diferente.

**Catalogo de servicios (art. 15.1 Ley 39/2006):**
| Servicio | Incluye |
|----------|---------|
| a) Prevencion y promocion | Prevencion de dependencia |
| b) Teleasistencia | Atencion a distancia |
| c) Ayuda a domicilio | Necesidades del hogar + cuidados personales |
| d) **Centro de Dia y de Noche** | Centro de Dia para mayores, **atencion especializada**, Centro de Noche |
| e) **Atencion Residencial** | **Residencia de mayores + Centro para discapacidad** |

**Clave:** Atencion especializada = Centro de Dia (art. 15.1.d), NO residencial (art. 15.1.e).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1bfd4fbb-a43c-415b-952d-0058e6dcd6c5");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2006 atencion residencial (" + exp2.length + " chars)");
})();
