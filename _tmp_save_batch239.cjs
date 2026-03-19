require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.18.1 colaboración personas excepciones
  const exp1 = `**Articulo 18.1 de la Ley 39/2015 - Colaboracion de las personas:**

> "Las personas [...] facilitaran a la Administracion los informes, inspecciones y otros actos de investigacion que requieran para el ejercicio de sus competencias, **salvo** que la revelacion de la informacion solicitada atentara contra el **honor, la intimidad personal o familiar** o supusieran la comunicacion de **datos confidenciales de terceros** de los que tengan conocimiento por servicios profesionales de diagnostico, asesoramiento o defensa."

**Por que D es correcta (B y C son correctas):**
El art. 18.1 establece dos excepciones a la obligacion de colaborar con la Administracion, ambas igualmente validas:
1. Cuando atentara contra el **honor** o la **intimidad personal o familiar** (opcion B).
2. Cuando supusiera revelar **datos confidenciales de terceros** conocidos por actividad profesional (opcion C).

Ambas excepciones estan conectadas por "o" en el texto del articulo, lo que significa que cualquiera de las dos es suficiente para no estar obligado a colaborar. La opcion D recoge correctamente que tanto B como C son verdaderas.

**Por que las demas son incorrectas o incompletas:**

- **A)** "**Siempre** y en cualquier caso." Falso: el art. 18.1 establece expresamente excepciones ("salvo que..."). La palabra "siempre" es demasiado absoluta y contradice el texto legal.

- **B)** Es correcta pero **incompleta**: solo recoge la primera excepcion (honor e intimidad), omitiendo la segunda (datos confidenciales de terceros).

- **C)** Es correcta pero **incompleta**: solo recoge la segunda excepcion (datos confidenciales de terceros), omitiendo la primera (honor e intimidad).

**Excepciones a la obligacion de colaborar (art. 18.1 Ley 39/2015):**

| Excepcion | Bien protegido |
|-----------|---------------|
| 1.a | **Honor e intimidad** personal/familiar |
| 2.a | **Datos confidenciales de terceros** (actividad profesional) |

**Clave:** La colaboracion con la Administracion es la regla general, pero tiene dos excepciones: honor/intimidad y datos confidenciales profesionales. Cuando ambas opciones aparecen por separado, la respuesta es "las dos son correctas".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7126d021-8010-43c7-a66d-844d699bfe2d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.18 colaboracion excepciones (" + exp1.length + " chars)");

  // #2 - Ley 40/2015 art.3.1 responsabilidad gestión pública
  const exp2 = `**Articulo 3.1 de la Ley 40/2015 - Principios de actuacion de las AAPP:**

> "Deberan respetar en su actuacion y relaciones los siguientes principios: [...] g) **Responsabilidad por la gestion publica**."

**Por que C es correcta (publica):**
El art. 3.1.g) de la Ley 40/2015 establece literalmente el principio de "responsabilidad por la gestion **publica**". Las Administraciones Publicas deben responder de su gestion ante los ciudadanos, lo cual se enmarca en la transparencia y rendicion de cuentas propias del servicio publico.

**Por que las demas son incorrectas (adjetivo diferente):**

- **A)** "Responsabilidad por la gestion **privada**." Falso: el principio se refiere a la gestion "publica", no "privada". Las AAPP gestionan intereses generales (publicos), no privados. La gestion privada es propia de empresas, no de Administraciones.

- **B)** "Responsabilidad por la gestion **economica**." Falso: el art. 3.1.g) dice "publica", no "economica". Aunque la gestion economica es parte de la gestion publica, el principio del art. 3.1 usa el adjetivo generico "publica" que abarca todos los ambitos de actuacion administrativa.

- **D)** "Responsabilidad por la gestion **institucional**." Falso: el art. 3.1.g) dice "publica", no "institucional". "Institucional" no aparece como adjetivo en este principio del art. 3.1.

**Principios del art. 3.1 Ley 40/2015 (seleccion):**

| Letra | Principio |
|-------|-----------|
| a) | Servicio efectivo a los ciudadanos |
| b) | Simplicidad, claridad y proximidad |
| c) | Participacion, objetividad y transparencia |
| d) | Racionalizacion y agilidad |
| e) | Buena fe, confianza legitima y lealtad institucional |
| f) | Eficiencia en asignacion de recursos publicos |
| **g)** | **Responsabilidad por la gestion publica** |
| h) | Planificacion y direccion por objetivos |

**Clave:** Responsabilidad por la gestion "publica" (no privada, economica ni institucional). El art. 3.1.g) usa exactamente ese adjetivo.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "d9d25ba6-d96d-4ebe-883d-2717a6514ab4");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 40/2015 art.3 responsabilidad publica (" + exp2.length + " chars)");
})();
